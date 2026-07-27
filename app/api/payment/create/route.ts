// app/api/payment/create/route.ts
// 建立訂單 API（支援 Stripe 和 PAYUNi 雙金流）
// 驗證用戶登入狀態、課程存在性、重複購買檢查、建立訂單並產生付款會話

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createOrderSchema } from '@/lib/validations/checkout'
import { generateOrderNo } from '@/lib/payment/shared'
import { isPurchaseActive } from '@/lib/purchase/is-active'
import { getActivePaymentGateway } from '@/lib/payment/gateway-factory'
import { resolveAppUrl } from '@/lib/app-url'
import {
  checkRateLimit,
  getIdentifier,
  getRateLimitHeaders,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit'
import { calculatePrice } from '@/lib/utils/price'
import { getPostHogClient, flushPostHogInBackground } from '@/lib/posthog-server'
import { createSubscriptionCheckout } from '@/lib/subscription/service'
import { validateCoupon } from '@/lib/actions/coupons'
import { resolveCourseInviteToken } from '@/lib/actions/course-invites'
import { withCourseInviteOrderMetadata } from '@/lib/payment/course-invite-order-metadata'
import {
  executePostPaymentActions,
  grantPaidOrderAccess,
} from '@/lib/payment/post-payment-actions'
import { recordCouponRedemption } from '@/lib/payment/coupon-redemption'
import { validateCheckoutInvoiceBeforePayment } from '@/lib/invoice/preflight'
import {
  enqueueOrderInvoiceOutbox,
  processOrderInvoiceOutbox,
} from '@/lib/subscription/outbox'

const GUEST_SOURCE = 'checkout_email'

/**
 * 建立訂單 API
 * POST /api/payment/create
 *
 * 安全機制：
 * 1. Rate Limiting - 防止訂單濫發
 * 2. 身分驗證 - 已登入或未登入（未登入需提供 email，name 選填）
 * 3. 重複購買檢查 - 防止重複購買
 * 4. 待付款訂單復用 - 30 分鐘內的待付款訂單可復用
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 讀取登入狀態（未登入可走 guest checkout）
    const session = await auth()
    const loggedInUserId = session?.user?.id || null

    // 2. 解析並驗證請求資料
    const body = await request.json()
    const validationResult = createOrderSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: '請求資料格式錯誤', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const { courseId, bundleId, email, name, couponCode, invite, invoice, generalEmailConsent, marketingConsent, planId, recurringConsent } =
      validationResult.data

    // 3.5 訂閱結帳分支（AC-22~AC-31）
    // 帶 planId 即走訂閱路徑，與買斷路徑完全分流（買斷路徑零改動 AC-30）。
    // 阻擋規則（有效 Purchase / ACTIVE 訂閱 / PENDING 復用汰換）、consent 存證、
    // 建 PENDING 訂閱 + 首期 Order、呼叫 gateway 建立扣款會話，皆由 service 統一處理。
    if (planId) {
      // 訂閱僅限已登入正式會員；訪客 / guest shell 一律 4xx 拒絕（AC-24）
      if (!loggedInUserId) {
        return NextResponse.json(
          {
            error: '訂閱僅限已登入的正式會員，請先登入',
            code: 'SUBSCRIPTION_LOGIN_REQUIRED',
          },
          { status: 401 }
        )
      }

      if (!courseId) {
        return NextResponse.json(
          { error: '訂閱方案僅適用於單一課程', code: 'SUBSCRIPTION_COURSE_REQUIRED' },
          { status: 400 }
        )
      }

      // Rate limiting（沿用付款流程配額，防濫發訂閱單）
      const subIdentifier = getIdentifier(request, loggedInUserId)
      const subRateLimit = checkRateLimit(
        `payment:${subIdentifier}`,
        RATE_LIMIT_CONFIGS.payment
      )
      if (!subRateLimit.success) {
        return NextResponse.json(
          { error: '請求過於頻繁，請稍後再試' },
          { status: 429, headers: getRateLimitHeaders(subRateLimit) }
        )
      }

      // guest shell 用戶雖無登入 session（此處必為正式會員），仍以 DB 為準二次確認（AC-24）
      const subUser = await prisma.user.findUnique({
        where: { id: loggedInUserId },
        select: { isGuest: true },
      })

      const baseUrl = await resolveAppUrl({ request })
      const result = await createSubscriptionCheckout({
        userId: loggedInUserId,
        isGuest: subUser?.isGuest === true,
        courseId,
        planId,
        recurringConsent: recurringConsent === true,
        invoice: invoice ?? null,
        invite: invite ?? null,
        clientIpAddress:
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        clientUserAgent: request.headers.get('user-agent') || null,
        baseUrl,
      })

      if (!result.success) {
        // 阻擋原因碼對映 HTTP 狀態：登入/同意/gateway → 4xx；其餘商業阻擋 → 400
        const status =
          result.code === 'GUEST_NOT_ALLOWED' || result.code === 'NOT_LOGGED_IN'
            ? 401
            : result.code === 'GATEWAY_UNSUPPORTED'
              ? 400
              : 400
        return NextResponse.json(
          {
            error: result.error,
            code: result.code,
            // ALREADY_ACTIVE_PURCHASE 時附上可觀看至日期，供前端顯示阻擋訊息
            accessEndsAt:
              result.code === 'ALREADY_ACTIVE_PURCHASE'
                ? result.accessEndsAt ?? null
                : undefined,
          },
          { status, headers: getRateLimitHeaders(subRateLimit) }
        )
      }

      // PostHog：訂閱付款建立事件（plan_type = unlimited / fixed_term，AC-75）
      const posthog = await getPostHogClient()
      if (posthog) {
        const createdSub = await prisma.courseSubscription.findUnique({
          where: { id: result.data.subscriptionId },
          select: { planType: true },
        })
        const planTypeProp =
          createdSub?.planType === 'FIXED_TERM' ? 'fixed_term' : 'unlimited'
        posthog.capture({
          distinctId: loggedInUserId,
          event: 'payment_created',
          properties: {
            order_no: result.data.orderNo,
            subscription_id: result.data.subscriptionId,
            item_type: 'course',
            course_id: courseId,
            currency: 'TWD',
            plan_type: planTypeProp,
            identity_type: 'auth',
          },
        })
        flushPostHogInBackground(posthog)
      }

      const payment = result.data.payment
      return NextResponse.json(
        {
          orderNo: result.data.orderNo,
          subscriptionId: result.data.subscriptionId,
          paymentType: payment.type,
          checkoutUrl: payment.checkoutUrl,
          formData: payment.formData,
          userId: loggedInUserId,
        },
        { headers: getRateLimitHeaders(subRateLimit) }
      )
    }

    // 4. 決定此次購買對應的使用者
    let purchaserUserId = loggedInUserId
    let purchaserEmail = session?.user?.email || null
    const identityType: 'auth' | 'guest_shell' = loggedInUserId ? 'auth' : 'guest_shell'

    if (!purchaserUserId) {
      if (!email) {
        return NextResponse.json(
          {
            error: '請填寫 Email',
            code: 'GUEST_FIELDS_REQUIRED',
          },
          { status: 400 }
        )
      }

      const normalizedEmail = email.trim().toLowerCase()
      const trimmedName = name?.trim() || null

      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          email: true,
          password: true,
          isGuest: true,
          name: true,
          phone: true,
          accounts: {
            select: {
              provider: true,
            },
          },
        },
      })

      if (existingUser) {
        const providers = existingUser.accounts.map((account) => account.provider)
        const hasOAuthAccount = providers.some(
          (provider) => provider === 'google' || provider === 'apple'
        )

        if (!existingUser.isGuest && hasOAuthAccount) {
          return NextResponse.json(
            {
              error: '此 Email 已綁定社群登入，請使用 Google 或 Apple 快速登入',
              code: 'OAUTH_ACCOUNT_EXISTS',
              providers,
            },
            { status: 409 }
          )
        }

        if (!existingUser.isGuest && !!existingUser.password) {
          return NextResponse.json(
            {
              error: '此 Email 已註冊會員，請先登入後再購買',
              code: 'PASSWORD_ACCOUNT_EXISTS',
            },
            { status: 409 }
          )
        }

        purchaserUserId = existingUser.id
        purchaserEmail = existingUser.email

        const patchData: {
          name?: string
          generalEmailConsent?: boolean
          generalEmailConsentAt?: Date
          marketingConsent?: boolean
          marketingConsentAt?: Date
          marketingConsentSource?: string
          marketingConsentIp?: string
        } = {}
        if (!existingUser.name && trimmedName) {
          patchData.name = trimmedName
        }
        if (generalEmailConsent) {
          patchData.generalEmailConsent = true
          patchData.generalEmailConsentAt = new Date()
        }
        if (marketingConsent) {
          patchData.marketingConsent = true
          patchData.marketingConsentAt = new Date()
          patchData.marketingConsentSource = 'checkout'
          patchData.marketingConsentIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || 'unknown'
        }
        if (Object.keys(patchData).length > 0) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: patchData,
          })
        }
        if (generalEmailConsent || marketingConsent) {
          await prisma.emailConsentLog.createMany({
            data: [
              ...(generalEmailConsent
                ? [{
                    userId: existingUser.id,
                    email: normalizedEmail,
                    consentType: 'GENERAL' as const,
                    action: 'GRANTED' as const,
                    source: 'checkout',
                    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || 'unknown',
                  }]
                : []),
              ...(marketingConsent
                ? [{
                    userId: existingUser.id,
                    email: normalizedEmail,
                    consentType: 'MARKETING' as const,
                    action: 'GRANTED' as const,
                    source: 'checkout',
                    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || 'unknown',
                  }]
                : []),
            ],
          })
        }
      } else {
        const guestUser = await prisma.user.create({
          data: {
            email: normalizedEmail,
            ...(trimmedName ? { name: trimmedName } : {}),
            isGuest: true,
            guestSource: GUEST_SOURCE,
            generalEmailConsent: !!generalEmailConsent,
            generalEmailConsentAt: generalEmailConsent ? new Date() : null,
            marketingConsent: !!marketingConsent,
            marketingConsentAt: marketingConsent ? new Date() : null,
            marketingConsentSource: marketingConsent ? 'checkout' : null,
            marketingConsentIp: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || 'unknown',
            emailConsentLogs: {
              create: [
                {
                  email: normalizedEmail,
                  consentType: 'GENERAL',
                  action: generalEmailConsent ? 'GRANTED' : 'REVOKED',
                  source: 'checkout',
                  ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || 'unknown',
                },
                {
                  email: normalizedEmail,
                  consentType: 'MARKETING',
                  action: marketingConsent ? 'GRANTED' : 'REVOKED',
                  source: 'checkout',
                  ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || 'unknown',
                },
              ],
            },
          },
          select: {
            id: true,
            email: true,
          },
        })
        purchaserUserId = guestUser.id
        purchaserEmail = guestUser.email
      }
    }

    if (!purchaserUserId) {
      return NextResponse.json(
        { error: '無法建立購買身份，請稍後再試' },
        { status: 500 }
      )
    }

    if (loggedInUserId && (generalEmailConsent || marketingConsent)) {
      const ipAddress =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        request.headers.get('cf-connecting-ip') ||
        'unknown'
      await prisma.$transaction([
        prisma.user.update({
          where: { id: loggedInUserId },
          data: {
            ...(generalEmailConsent
              ? { generalEmailConsent: true, generalEmailConsentAt: new Date() }
              : {}),
            ...(marketingConsent
              ? {
                  marketingConsent: true,
                  marketingConsentAt: new Date(),
                  marketingConsentSource: 'checkout',
                  marketingConsentIp: ipAddress,
                }
              : {}),
          },
        }),
        ...(generalEmailConsent
          ? [
              prisma.emailConsentLog.create({
                data: {
                  userId: loggedInUserId,
                  email: purchaserEmail || session?.user?.email || '',
                  consentType: 'GENERAL',
                  action: 'GRANTED',
                  source: 'checkout',
                  ip: ipAddress,
                },
              }),
            ]
          : []),
        ...(marketingConsent
          ? [
              prisma.emailConsentLog.create({
                data: {
                  userId: loggedInUserId,
                  email: purchaserEmail || session?.user?.email || '',
                  consentType: 'MARKETING',
                  action: 'GRANTED',
                  source: 'checkout',
                  ip: ipAddress,
                },
              }),
            ]
          : []),
      ])
    }

    // 5. Rate Limiting 檢查
    const identifier = loggedInUserId
      ? getIdentifier(request, loggedInUserId)
      : `guest:${purchaserEmail || getIdentifier(request)}`
    const rateLimitResult = checkRateLimit(
      `payment:${identifier}`,
      RATE_LIMIT_CONFIGS.payment
    )

    if (!rateLimitResult.success) {
      const headers = getRateLimitHeaders(rateLimitResult)
      return NextResponse.json(
        { error: '請求過於頻繁，請稍後再試' },
        { status: 429, headers }
      )
    }

    // 6. 查詢購買商品（單課程或組合包）
    const course = courseId
      ? await prisma.course.findFirst({
          where: {
            id: courseId,
            status: {
              in: ['PUBLISHED', 'UNLISTED'],
            },
          },
        })
      : null

    const bundle = bundleId
      ? await prisma.bundle.findFirst({
          where: {
            id: bundleId,
            status: 'PUBLISHED',
            visibility: { in: ['PUBLIC', 'UNLISTED'] },
          },
          include: {
            courses: {
              orderBy: { order: 'asc' },
              select: {
                courseId: true,
                course: { select: { title: true } },
              },
            },
          },
        })
      : null

    if (courseId && !course) {
      return NextResponse.json(
        { error: '課程不存在或尚未發佈' },
        { status: 404 }
      )
    }

    if (bundleId && (!bundle || bundle.courses.length === 0)) {
      return NextResponse.json(
        { error: '組合包不存在或尚未發佈' },
        { status: 404 }
      )
    }

    let inviteOrderMetadata: {
      inviteId: string
      courseId: string
      consumedAt: null
    } | null = null

    if (course?.salesVisibility === 'INVITE_ONLY') {
      const inviteResolution = await resolveCourseInviteToken({
        token: invite,
        courseId: course.id,
        userEmail: purchaserEmail,
      })

      if (!inviteResolution.valid) {
        return NextResponse.json(
          {
            error: '此課程需要有效邀請連結才能購買',
            code: 'INVITE_REQUIRED',
          },
          { status: 403 }
        )
      }

      inviteOrderMetadata = {
        inviteId: inviteResolution.inviteId,
        courseId: course.id,
        consumedAt: null,
      }
    }

    const itemType = bundle ? 'bundle' : 'course'
    const itemTitle = bundle?.title ?? course!.title
    const itemSubtitle = bundle
      ? `組合包｜${bundle.courses.length} 門課程`
      : course!.subtitle
    const itemPrice = bundle?.price ?? course!.price
    const itemCourseIds = bundle
      ? bundle.courses.map((item) => item.courseId)
      : [course!.id]

    // 7. 檢查是否已購買過（改用 isPurchaseActive：過期 / 撤銷者放行回購，PRD §9）
    const purchaseRecords = await prisma.purchase.findMany({
      where: {
        userId: purchaserUserId,
        courseId: { in: itemCourseIds },
        revokedAt: null,
      },
      select: { courseId: true, revokedAt: true, expiresAt: true },
    })
    const existingPurchases = purchaseRecords.filter((p) => isPurchaseActive(p))

    if (!bundle && existingPurchases.length > 0) {
      return NextResponse.json(
        { error: '您已經購買過此課程' },
        { status: 400 }
      )
    }

    if (bundle && existingPurchases.length === itemCourseIds.length) {
      return NextResponse.json(
        { error: '您已經擁有此組合包內的所有課程' },
        { status: 400 }
      )
    }

    // 收款前以發票 provider 的官方 API 輔助驗證手機載具／愛心碼與欄位上限。
    // 明確無效會阻擋；財政部／provider 暫時維護則保留本地格式驗證並由 outbox 重試開票。
    const invoicePreflight = await validateCheckoutInvoiceBeforePayment({
      invoice: invoice ?? null,
      buyerEmail: purchaserEmail,
    })
    if (!invoicePreflight.success) {
      return NextResponse.json(
        { error: invoicePreflight.error, code: 'INVOICE_INVALID' },
        { status: 400, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    // 8. 計算當前價格
    const coursePrice = course
      ? calculatePrice({
          originalPrice: course.price,
          salePrice: course.salePrice,
          saleEndAt: course.saleEndAt,
          saleCycleEnabled: course.saleCycleEnabled,
          saleCycleDays: course.saleCycleDays,
        })
      : null
    const priceBeforeCoupon = bundle
      ? bundle.salePrice ?? bundle.price
      : coursePrice!.finalPrice
    const isOnSale = bundle ? bundle.salePrice != null : coursePrice!.isOnSale

    // 8.1 零元課程不走付款流程，引導使用免費註冊
    if (!bundle && priceBeforeCoupon === 0 && !couponCode) {
      return NextResponse.json(
        { error: '此課程目前為免費，請直接加入課程', code: 'FREE_COURSE' },
        { status: 400 }
      )
    }

    // 8.2 優惠券二次驗證
    let couponId: string | null = null
    let couponDiscount: number | null = null
    let currentAmount = priceBeforeCoupon

    if (couponCode) {
      const couponResult = await validateCoupon(
        couponCode,
        bundle ? { bundleId: bundle.id } : { courseId: course!.id },
        priceBeforeCoupon,
        purchaserUserId
      )

      if (!couponResult.valid) {
        return NextResponse.json(
          { error: couponResult.error, code: 'COUPON_INVALID' },
          { status: 400 }
        )
      }

      couponId = couponResult.couponId!
      couponDiscount = couponResult.discountAmount!
      currentAmount = couponResult.finalPrice!
    }

    // 8.3 只有實際需要導向金流時才初始化 gateway。
    // 這讓私密課程邀請驗證、免費訂單、格式錯誤等安全檢查不受金流設定狀態影響。
    let gateway: Awaited<ReturnType<typeof getActivePaymentGateway>> | null = null
    if (currentAmount > 0) {
      try {
        gateway = await getActivePaymentGateway()
      } catch {
        return NextResponse.json(
          { error: '金流系統尚未設定，請聯繫管理員' },
          { status: 500 }
        )
      }
    }

    // 9. 使用事務處理訂單建立/復用，避免競態條件
    const baseUrl = await resolveAppUrl({ request })

    const order = await prisma.$transaction(async (tx) => {
      const utmCookie = request.cookies.get('__utm')?.value
      let utmData: Record<string, string> = {}
      if (utmCookie) {
        try {
          utmData = JSON.parse(utmCookie)
        } catch {
          // 忽略解析錯誤
        }
      }

      const newsletterCookie = request.cookies.get('__newsletter_attr')?.value
      let newsletterAttribution: { campaignId: string; linkId: string } | null = null
      if (newsletterCookie) {
        try {
          const raw = JSON.parse(newsletterCookie) as {
            campaignId?: string
            linkId?: string
            clickedAt?: string
          }
          if (raw.campaignId && raw.linkId && raw.clickedAt) {
            const link = await tx.newsletterLink.findUnique({
              where: { id: raw.linkId },
              select: {
                id: true,
                campaignId: true,
                campaign: { select: { attributionWindowDays: true } },
              },
            })
            const clickedAt = new Date(raw.clickedAt)
            const maxAgeMs = Math.max(1, link?.campaign.attributionWindowDays || 7) * 24 * 60 * 60 * 1000
            if (
              link &&
              link.campaignId === raw.campaignId &&
              !Number.isNaN(clickedAt.getTime()) &&
              Date.now() - clickedAt.getTime() <= maxAgeMs
            ) {
              newsletterAttribution = { campaignId: link.campaignId, linkId: link.id }
            }
          }
        } catch {
          // 忽略解析錯誤
        }
      }

      // 檢查是否有待付款訂單（在事務內查詢以獲得一致性）
      // 注意：有優惠券時不復用舊訂單（因為優惠券狀態可能變化）
      if (!couponCode) {
        const pendingOrder = await tx.order.findFirst({
          where: {
            userId: purchaserUserId,
            ...(course ? { courseId: course.id } : { bundleId: bundle!.id }),
            status: 'PENDING',
            couponId: null,
            // 訂閱期款 Order 不進買斷復用（AC-30）：否則已登入用戶先發起訂閱、
            // 30 分鐘內對同課買斷結帳會復用該訂閱首期 Order 並灌入買斷 session
            subscriptionId: null,
            createdAt: {
              gte: new Date(Date.now() - 30 * 60 * 1000),
            },
          },
        })

        if (pendingOrder) {
          if (pendingOrder.amount !== currentAmount) {
            await tx.order.update({
              where: { id: pendingOrder.id },
              data: { status: 'CANCELLED' },
            })
            console.log(
              '[Payment Create] 價格變動，取消舊訂單:',
              pendingOrder.orderNo
            )
          } else {
            // 復用訂單時必須同步本次結帳的發票快照，不可沿用舊的統編／載具。
            const reusedOrder = await tx.order.update({
              where: { id: pendingOrder.id },
              data: {
                invoiceType: invoice?.invoiceType ?? null,
                invoiceCarrierType:
                  invoice?.invoiceType === 'PERSONAL' ? invoice.carrierType ?? null : null,
                invoiceCarrierId:
                  invoice?.invoiceType === 'PERSONAL' ? invoice.carrierId || null : null,
                invoiceTaxId: invoice?.invoiceType === 'COMPANY' ? invoice.taxId || null : null,
                invoiceTitle: invoice?.invoiceType === 'COMPANY' ? invoice.title || null : null,
                invoiceLoveCode:
                  invoice?.invoiceType === 'DONATION' ? invoice.loveCode || null : null,
                invoiceAddress:
                  invoice?.invoiceType === 'COMPANY' ? invoice.address || null : null,
                gatewayPaymentInstructions: inviteOrderMetadata
                  ? withCourseInviteOrderMetadata(
                      pendingOrder.gatewayPaymentInstructions,
                      inviteOrderMetadata
                    )
                  : pendingOrder.gatewayPaymentInstructions ?? undefined,
                newsletterCampaignId:
                  newsletterAttribution?.campaignId ?? pendingOrder.newsletterCampaignId,
                newsletterLinkId:
                  newsletterAttribution?.linkId ?? pendingOrder.newsletterLinkId,
              },
            })
            console.log('[Payment Create] 復用待付款訂單:', pendingOrder.orderNo)
            return reusedOrder
          }
        }
      }

      const orderNo = generateOrderNo()

      return tx.order.create({
        data: {
          orderNo,
          userId: purchaserUserId,
          courseId: course?.id ?? null,
          bundleId: bundle?.id ?? null,
          amount: currentAmount,
          // originalAmount = 商品定價（list price）。後台顯示的折扣以 originalAmount - amount 計算，
          // 已涵蓋「促銷折扣 + 優惠券折抵」兩者；couponDiscount 僅記錄優惠券折抵部分（兩者用途不同，故不互等）。
          originalAmount: itemPrice,
          couponId,
          couponDiscount,
          status: 'PENDING',
          paymentGateway: gateway?.type ?? null,
          // 臺灣電子發票買受人資訊（發票功能啟用時才有）
          invoiceType: invoice?.invoiceType ?? null,
          invoiceCarrierType:
            invoice?.invoiceType === 'PERSONAL' ? invoice.carrierType ?? null : null,
          invoiceCarrierId: invoice?.carrierId || null,
          invoiceTaxId: invoice?.taxId || null,
          invoiceTitle: invoice?.title || null,
          invoiceLoveCode: invoice?.loveCode || null,
          invoiceAddress: invoice?.address || null,
          gatewayPaymentInstructions: inviteOrderMetadata
            ? withCourseInviteOrderMetadata(null, inviteOrderMetadata)
            : undefined,
          clientIpAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
          clientUserAgent: request.headers.get('user-agent') || null,
          utmSource: utmData.utm_source || null,
          utmMedium: utmData.utm_medium || null,
          utmCampaign: utmData.utm_campaign || null,
          utmContent: utmData.utm_content || null,
          utmTerm: utmData.utm_term || null,
          newsletterCampaignId: newsletterAttribution?.campaignId || null,
          newsletterLinkId: newsletterAttribution?.linkId || null,
        },
      })
    })

    // 10. 折後價為零 — 跳過金流，直接完成
    if (currentAmount === 0) {
      await prisma.$transaction(async (tx) => {
        // 更新訂單為 PAID
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'PAID', paidAt: new Date() },
        })

        // 建立 Purchase 記錄
        await grantPaidOrderAccess({
          tx,
          order: {
            id: order.id,
            userId: purchaserUserId,
            courseId: course?.id ?? null,
            bundleId: bundle?.id ?? null,
          },
          paidAt: new Date(),
        })

        // 建立優惠券兌換記錄（冪等 + 上限原子化）
        if (couponId && couponDiscount) {
          await recordCouponRedemption(tx, {
            couponId,
            userId: purchaserUserId,
            orderId: order.id,
            amount: couponDiscount,
            campaignId: order.newsletterCampaignId,
          })
        }

        await enqueueOrderInvoiceOutbox(tx, {
          orderId: order.id,
          eventType: 'ISSUE_INVOICE',
        })
      })

      console.log('[Payment Create] 零元訂單直接完成:', order.orderNo)

      // 發票已與 PAID 狀態同一交易入 outbox；此處立即嘗試，失敗由 maintenance 重試。
      const invoiceResult = await processOrderInvoiceOutbox(order.id, 'ISSUE_INVOICE')
      if (!invoiceResult.success) {
        console.error('[Payment Create] 零元訂單發票待重試:', invoiceResult.error)
      }

      // 其他非財稅 side effects
      executePostPaymentActions({
        id: order.id,
        orderNo: order.orderNo,
        userId: purchaserUserId,
        courseId: course?.id ?? null,
        bundleId: bundle?.id ?? null,
        amount: 0,
        clientIpAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        clientUserAgent: request.headers.get('user-agent') || null,
      }).catch((err) =>
        console.error('[Payment Create] Post-payment actions 失敗:', err)
      )

      return NextResponse.json(
        {
          orderId: order.id,
          orderNo: order.orderNo,
          amount: 0,
          paymentType: 'free',
          userId: purchaserUserId,
        },
        { headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    if (!gateway) {
      return NextResponse.json(
        { error: '金流系統尚未設定，請聯繫管理員' },
        { status: 500 }
      )
    }

    // 11. 讀取 purchaser 的 name/phone（供 Shopline billing/customer 欄位使用）
    const purchaserProfile = await prisma.user.findUnique({
      where: { id: purchaserUserId },
      select: { name: true, phone: true },
    })

    // 12. 建立金流付款會話（金額 > 0）
    const paymentResult = await gateway.createPaymentSession({
      order: { id: order.id, orderNo: order.orderNo, amount: order.amount },
      course: { title: itemTitle, subtitle: itemSubtitle },
      customerEmail: purchaserEmail,
      customerName: purchaserProfile?.name ?? null,
      customerPhone: purchaserProfile?.phone ?? null,
      baseUrl,
      identityType,
      userId: purchaserUserId,
      courseId: course?.id ?? null,
      bundleId: bundle?.id ?? null,
      isOnSale: isOnSale && !couponCode,
      // 有優惠券時不用 Stripe 預建 Price，改用 price_data
      stripePriceId: course && !bundle && !couponCode ? course.stripePriceId : null,
      stripeSalePriceId:
        course && !bundle && !couponCode ? course.stripeSalePriceId : null,
      clientIpAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    })

    // 更新訂單的 gateway session ID
    if (paymentResult.gatewaySessionId) {
      await prisma.order.update({
        where: { id: order.id },
        data: { stripeSessionId: paymentResult.gatewaySessionId },
      })
    }

    console.log('[Payment Create] 訂單建立成功:', order.orderNo, `(${gateway.type})`)

    // PostHog: Track payment created
    const posthog = await getPostHogClient()
    if (posthog) {
      posthog.capture({
        distinctId: purchaserUserId,
        event: 'payment_created',
        properties: {
          order_id: order.id,
          order_no: order.orderNo,
          item_type: itemType,
          course_id: course?.id ?? null,
          course_title: course?.title,
          course_slug: course?.slug,
          bundle_id: bundle?.id ?? null,
          bundle_title: bundle?.title,
          bundle_slug: bundle?.slug,
          amount: order.amount,
          original_amount: order.originalAmount,
          currency: 'TWD',
          payment_gateway: gateway.type,
          identity_type: identityType,
          coupon_code: couponCode || null,
          coupon_discount: couponDiscount || null,
          // 買斷路徑（訂閱路徑另有分支，AC-75）
          plan_type: 'buyout',
        },
      })
      flushPostHogInBackground(posthog)
    }

    return NextResponse.json(
      {
        orderId: order.id,
        orderNo: order.orderNo,
        amount: order.amount,
        paymentType: paymentResult.type,
        checkoutUrl: paymentResult.checkoutUrl,
        formData: paymentResult.formData,
        // 回傳 purchaserUserId 讓前端可以 identify 訪客用戶，串接漏斗事件
        userId: purchaserUserId,
      },
      { headers: getRateLimitHeaders(rateLimitResult) }
    )
  } catch (error) {
    console.error('[Payment Create] 錯誤:', error)

    // 金流閘道明確拒絕時，回傳可讀的錯誤訊息給前端
    const message = error instanceof Error ? error.message : ''
    if (message.includes('SHOPLINE')) {
      const safeMessage = message.includes('需要顧客 Email')
        ? message
        : 'SHOPLINE Payments 建立付款失敗，請確認付款設定或稍後再試'
      return NextResponse.json({ error: safeMessage }, { status: 400 })
    }

    if (message.includes('PAYUNi') || message.includes('Stripe')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json(
      { error: '建立訂單失敗，請稍後再試' },
      { status: 500 }
    )
  }
}
