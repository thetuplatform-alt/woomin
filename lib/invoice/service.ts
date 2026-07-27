// lib/invoice/service.ts
// 電子發票核心服務：開立 / 作廢 / 折讓的編排邏輯。
//
// 這層「不是」Server Action（不加 'use server'），因為它同時被兩種呼叫端使用：
//   1. 付款成功 hook（lib/payment/post-payment-actions）— 系統觸發、無 session
//   2. 後台 Server Actions（lib/actions/einvoice）— 由管理員觸發、需權限
// 權限與稽核由呼叫端負責；本層只負責與加值中心互動 + 寫回 Invoice 狀態。

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getEInvoiceConfig, isEInvoiceConfigured } from './config'
import { createEcpayInvoiceProvider, createInvoiceProvider } from './provider'
import {
  buildIssueInput,
  buildAllowanceInput,
  normalizeProviderOrderId,
  type OrderInvoicePreference,
} from './issue'
import { isInvoiceError } from '@paid-tw/einvoice'
import { findProviderInvoiceByOrderId } from './query'
import { toProviderAllowanceOrderId } from './provider-order-id'
import { normalizeProviderVoidReason } from './provider-limits'
import { validateInvoicePreference } from './preflight'
import { resolveAppUrl } from '@/lib/app-url'

export interface InvoiceOpResult {
  success: boolean
  /** 已開立發票時回傳號碼。 */
  invoiceNumber?: string
  /** 因「已開立 / 未啟用 / 金額為 0」等情形而略過。 */
  skipped?: boolean
  /** 給後台操作顯示的補充說明。 */
  message?: string
  error?: string
}

const INVOICE_ATTEMPT_STALE_MS = 2 * 60 * 1000
const INVOICE_OPERATION_STALE_MS = 2 * 60 * 1000

const CLEAR_OPERATION = {
  operationType: null,
  operationAmount: null,
  operationBaseAllowanceTotal: null,
  operationStartedAt: null,
} as const

function toJson(value: unknown): Prisma.InputJsonValue {
  try {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue
  } catch {
    return {} as Prisma.InputJsonValue
  }
}

function errorMessage(e: unknown): string {
  if (isInvoiceError(e)) {
    return `[${e.code}] ${e.rawMessage || e.message}`
  }
  return e instanceof Error ? e.message : '未知錯誤'
}

function isDefinitiveProviderFailure(error: unknown): boolean {
  return (
    isInvoiceError(error) &&
    !['NETWORK', 'CONFLICT', 'UNKNOWN'].includes(error.code)
  )
}

function validateIssueResult(
  result: { invoiceNumber: string; randomCode: string; invoiceDate: Date; totalAmount: number },
  expectedAmount: number
): void {
  if (!/^[A-Z]{2}\d{8}$/.test(result.invoiceNumber)) {
    throw new Error(`加值中心回傳無效發票號碼：${result.invoiceNumber || '(空白)'}`)
  }
  if (!/^\d{4}$/.test(result.randomCode)) {
    throw new Error(`加值中心回傳無效隨機碼：${result.randomCode || '(空白)'}`)
  }
  if (!(result.invoiceDate instanceof Date) || Number.isNaN(result.invoiceDate.getTime())) {
    throw new Error('加值中心未回傳有效發票日期')
  }
  if (result.totalAmount !== expectedAmount) {
    throw new Error(
      `加值中心回傳發票金額 NT$${result.totalAmount} 與訂單 NT$${expectedAmount} 不符`
    )
  }
}

/** 取得訂單的品名（課程 / 組合包標題）與買受人資訊。 */
async function resolveOrderContext(order: {
  courseId: string | null
  bundleId: string | null
  userId: string
}): Promise<{ itemName: string; buyerName: string | null; buyerEmail: string | null }> {
  let itemName = '線上課程'
  if (order.bundleId) {
    const bundle = await prisma.bundle.findUnique({
      where: { id: order.bundleId },
      select: { title: true },
    })
    if (bundle?.title) itemName = bundle.title
  } else if (order.courseId) {
    const course = await prisma.course.findUnique({
      where: { id: order.courseId },
      select: { title: true },
    })
    if (course?.title) itemName = course.title
  }

  const user = await prisma.user.findUnique({
    where: { id: order.userId },
    select: { name: true, email: true },
  })

  return { itemName, buyerName: user?.name ?? null, buyerEmail: user?.email ?? null }
}

function orderPreference(order: {
  invoiceType: string | null
  invoiceCarrierType: string | null
  invoiceCarrierId: string | null
  invoiceTaxId: string | null
  invoiceTitle: string | null
  invoiceLoveCode: string | null
  invoiceAddress: string | null
}): OrderInvoicePreference {
  return {
    invoiceType: (order.invoiceType as OrderInvoicePreference['invoiceType']) ?? 'PERSONAL',
    carrierType: order.invoiceCarrierType,
    carrierId: order.invoiceCarrierId,
    taxId: order.invoiceTaxId,
    title: order.invoiceTitle,
    loveCode: order.invoiceLoveCode,
    address: order.invoiceAddress,
  }
}

/**
 * 替訂單開立電子發票（冪等）。
 *
 * 冪等保證：Invoice.orderId 為 @unique。同一訂單第二次呼叫：
 * - 若已 ISSUED → 直接回傳 skipped。
 * - 若 FAILED / 逾時 PENDING → 先查加值中心；已存在就回填，不存在才取得鎖後重送。
 * - 兩分鐘內的 PENDING 視為仍在處理，避免 webhook 與手動操作並發重複開立。
 */
export async function issueInvoiceForOrder(orderId: string): Promise<InvoiceOpResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { invoice: true },
  })
  if (!order) return { success: false, error: '找不到訂單' }
  if (order.status !== 'PAID') {
    if (order.status === 'REFUNDED') {
      return { success: true, skipped: true, message: '訂單已退款，不再新開發票。' }
    }
    return { success: false, error: '訂單尚未付款，無法開立發票' }
  }
  if (order.amount <= 0) return { success: true, skipped: true }

  // 已開立 → 略過
  if (order.invoice?.status === 'ISSUED') {
    return { success: true, skipped: true, invoiceNumber: order.invoice.invoiceNumber ?? undefined }
  }
  if (order.invoice?.status === 'VOIDED' || order.invoice?.status === 'ALLOWANCE') {
    return { success: false, error: '此訂單已有作廢或折讓紀錄，不能再次開立發票' }
  }

  const config = await getEInvoiceConfig()
  if (!config.enabled) return { success: true, skipped: true }
  if (!isEInvoiceConfigured(config)) {
    return { success: false, error: '電子發票尚未設定完整憑證' }
  }
  if (order.invoice && order.invoice.provider !== config.provider) {
    return {
      success: false,
      error: `此發票原本使用 ${order.invoice.provider}，目前設定為 ${config.provider}。為避免跨供應商重複開票，請先切回原供應商完成查詢或補開。`,
    }
  }

  const ctx = await resolveOrderContext(order)
  const provider = createInvoiceProvider(config)
  const preference = orderPreference(order)
  const preflight = await validateInvoicePreference({
    config,
    preference,
    buyerEmail: ctx.buyerEmail,
  })
  if (!preflight.success) return { success: false, error: preflight.error }

  const input = buildIssueInput({
    orderNo: order.orderNo,
    amount: order.amount,
    itemName: ctx.itemName,
    buyerName: ctx.buyerName,
    buyerEmail: ctx.buyerEmail,
    preference,
    provider: config.provider,
  })

  // 建立 / 取得 Invoice 列（PENDING）。orderId @unique 作為冪等鎖。
  let invoiceRowId = order.invoice?.id
  let ownsIssueAttempt = false
  if (!invoiceRowId) {
    try {
      const created = await prisma.invoice.create({
        data: {
          orderId: order.id,
          provider: config.provider,
          status: 'PENDING',
          amount: order.amount,
        },
        select: { id: true },
      })
      invoiceRowId = created.id
      ownsIssueAttempt = true
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await prisma.invoice.findUnique({ where: { orderId: order.id } })
        if (existing?.status === 'ISSUED') {
          return { success: true, skipped: true, invoiceNumber: existing.invoiceNumber ?? undefined }
        }
        return {
          success: false,
          error: '發票正在由另一個請求處理，請稍候再重新整理訂單狀態。',
        }
      } else {
        throw e
      }
    }
  }

  let submittedOrderIdLength: number | undefined
  try {
    // 本站客製：記錄本次送出的 MerchantOrderNo 長度，開立失敗時一併寫入下方 console.error，
    // 方便從 log 直接判斷是否為 ezPay 20 字限制相關問題（對應 lib/invoice/issue.ts 的
    // normalizeProviderOrderId workaround），不需要另外重現才能定位。
    submittedOrderIdLength = input.orderId.length
    if (order.invoice && !ownsIssueAttempt) {
      const isFreshPending =
        order.invoice.status === 'PENDING' &&
        Date.now() - order.invoice.updatedAt.getTime() < INVOICE_ATTEMPT_STALE_MS
      if (isFreshPending) {
        return {
          success: false,
          error: '發票仍在處理中，請稍候約兩分鐘後再重新整理。',
        }
      }

      // 失敗重試或逾時 PENDING：先查遠端，避免「遠端已成功、本地未寫入」時重複開票。
      const remote = await findProviderInvoiceByOrderId({
        client: provider,
        provider: config.provider,
        orderId: input.orderId,
        amount: order.amount,
      })
      if (remote) {
        if (!remote.invoiceNumber) throw new Error('加值中心查到發票，但未回傳發票號碼，已停止重複開立')
        if (remote.amount.totalAmount !== order.amount) {
          throw new Error(
            `加值中心既有發票金額 NT$${remote.amount.totalAmount} 與訂單 NT$${order.amount} 不符，已停止重複開立`
          )
        }

        const recoveredStatus =
          remote.status === 'VOIDED'
            ? ('VOIDED' as const)
            : remote.status === 'ALLOWANCE'
              ? ('ALLOWANCE' as const)
              : ('ISSUED' as const)
        await prisma.invoice.update({
          where: { id: invoiceRowId },
          data: {
            status: recoveredStatus,
            provider: config.provider,
            invoiceNumber: remote.invoiceNumber,
            randomCode: remote.randomCode,
            invoiceDate: remote.invoiceDate,
            amount: remote.amount.totalAmount,
            failReason: null,
            rawResponse: toJson(remote.raw),
          },
        })
        return {
          success: true,
          skipped: true,
          invoiceNumber: remote.invoiceNumber,
          message: '加值中心已有此發票，已安全同步回本地，未重複開立。',
        }
      }

      // 只有明確查無遠端發票後才搶占重試權；updatedAt 防止兩個管理員同時重送。
      const claimed = await prisma.invoice.updateMany({
        where: {
          id: invoiceRowId,
          status: order.invoice.status,
          updatedAt: order.invoice.updatedAt,
        },
        data: { status: 'PENDING', failReason: null, updatedAt: new Date() },
      })
      if (claimed.count !== 1) {
        return {
          success: false,
          error: '發票已由另一個請求接手處理，請重新整理訂單狀態。',
        }
      }
      ownsIssueAttempt = true
    }

    const result = await provider.issue(input)
    validateIssueResult(result, order.amount)

    await prisma.invoice.update({
      where: { id: invoiceRowId },
      data: {
        status: 'ISSUED',
        provider: config.provider,
        invoiceNumber: result.invoiceNumber,
        randomCode: result.randomCode,
        invoiceDate: result.invoiceDate,
        amount: result.totalAmount,
        failReason: null,
        rawResponse: toJson(result.raw),
        // 重新開立（例如先前作廢 / 折讓後重開）時，清掉舊的作廢 / 折讓痕跡，
        // 避免 status=ISSUED 卻殘留 voidedAt / allowanceNumber 的語意矛盾。
        voidedAt: null,
        allowanceNumber: null,
        allowanceAmount: null,
        allowanceTotal: 0,
        allowancePendingNumber: null,
        allowancePendingAmount: null,
        allowancePendingExpiresAt: null,
        ...CLEAR_OPERATION,
      },
    })

    return { success: true, invoiceNumber: result.invoiceNumber }
  } catch (e) {
    const message = errorMessage(e)
    console.error(
      `[einvoice] 開立失敗 provider=${config.provider} MerchantOrderNoLength=${submittedOrderIdLength ?? 'unknown'}: ${message}`
    )
    if (invoiceRowId) {
      const failureSourceStatus = ownsIssueAttempt
        ? ('PENDING' as const)
        : order.invoice?.status === 'FAILED'
          ? ('FAILED' as const)
          : ('PENDING' as const)
      // 只更新自己處理中的狀態，避免蓋掉另一條已同步成功／作廢／折讓的結果。
      await prisma.invoice
        .updateMany({
          where: { id: invoiceRowId, status: failureSourceStatus },
          data: { status: 'FAILED', failReason: message, rawResponse: toJson(isInvoiceError(e) ? e.raw : null) },
        })
        .catch(() => {})
    }
    return { success: false, error: message }
  }
}

/**
 * 若發票功能啟用且設定為自動開立，替訂單開立發票。
 * 失敗只記錄、不丟出（不可影響付款 / 開通流程）。
 */
export async function maybeAutoIssueForOrder(orderId: string): Promise<void> {
  try {
    const config = await getEInvoiceConfig()
    if (!config.enabled || !config.autoIssue) return
    const result = await issueInvoiceForOrder(orderId)
    if (!result.success) {
      console.error(`[einvoice] 自動開立失敗 order=${orderId}: ${result.error}`)
    }
  } catch (e) {
    console.error(`[einvoice] 自動開立例外 order=${orderId}:`, e)
  }
}

/** 作廢發票。發票需為已開立狀態。 */
export async function voidInvoiceForOrder(
  orderId: string,
  reason: string
): Promise<InvoiceOpResult> {
  const invoice = await prisma.invoice.findUnique({
    where: { orderId },
    include: { order: { select: { orderNo: true } } },
  })
  if (!invoice) return { success: false, error: '此訂單尚未開立發票' }
  if (!invoice.invoiceNumber) return { success: false, error: '發票號碼不存在' }
  if (invoice.status !== 'ISSUED') {
    return { success: false, error: '只有「已開立」的發票可以作廢' }
  }
  if (invoice.allowancePendingNumber) {
    return { success: false, error: '此發票有待買受人確認的線上折讓，不能同時作廢' }
  }

  const config = await getEInvoiceConfig()
  if (!isEInvoiceConfigured(config)) {
    return { success: false, error: '電子發票尚未設定完整憑證' }
  }
  if (invoice.provider !== config.provider) {
    return {
      success: false,
      error: `此發票由 ${invoice.provider} 開立，目前設定為 ${config.provider}，請切回原供應商再作廢。`,
    }
  }

  const provider = createInvoiceProvider(config)
  if (invoice.operationType) {
    if (invoice.operationType !== 'VOID') {
      return { success: false, error: '此發票正在處理折讓，請稍後再試' }
    }
    const isFresh =
      invoice.operationStartedAt != null &&
      Date.now() - invoice.operationStartedAt.getTime() < INVOICE_OPERATION_STALE_MS
    if (isFresh) return { success: false, error: '發票作廢正在處理中，請稍後再試' }

    // 前次呼叫可能已在加值中心成功，必須先查詢再決定是否重送。
    const remote = await findProviderInvoiceByOrderId({
      client: provider,
      provider: config.provider,
      orderId: normalizeProviderOrderId(invoice.order.orderNo, config.provider),
      amount: invoice.amount,
    })
    if (remote?.status === 'VOIDED') {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'VOIDED',
          voidedAt: new Date(),
          failReason: null,
          rawResponse: toJson(remote.raw),
          ...CLEAR_OPERATION,
        },
      })
      return {
        success: true,
        skipped: true,
        invoiceNumber: invoice.invoiceNumber,
        message: '加值中心已作廢，本地狀態已安全同步。',
      }
    }
    if (remote?.status !== 'ISSUED') {
      return { success: false, error: '無法確認前次作廢結果，已停止重複送出' }
    }
    await prisma.invoice.updateMany({
      where: { id: invoice.id, operationType: 'VOID' },
      data: CLEAR_OPERATION,
    })
  }

  const claimed = await prisma.invoice.updateMany({
    where: {
      id: invoice.id,
      status: 'ISSUED',
      operationType: null,
      allowancePendingNumber: null,
    },
    data: {
      operationType: 'VOID',
      operationStartedAt: new Date(),
      failReason: null,
    },
  })
  if (claimed.count !== 1) {
    return { success: false, error: '發票已由另一個請求接手處理，請重新整理' }
  }

  try {
    const result = await provider.void({
      invoiceNumber: invoice.invoiceNumber,
      reason: normalizeProviderVoidReason(config.provider, reason),
      // ECPay 要求原發票開立日期；ezPay 會忽略此欄位。
      date: invoice.invoiceDate ?? undefined,
    })
    const updated = await prisma.invoice.updateMany({
      where: { id: invoice.id, status: 'ISSUED', operationType: 'VOID' },
      data: {
        status: 'VOIDED',
        voidedAt: new Date(),
        failReason: null,
        rawResponse: toJson(result.raw),
        ...CLEAR_OPERATION,
      },
    })
    if (updated.count !== 1) throw new Error('作廢已成功，但本地發票狀態更新失敗')
    return { success: true, invoiceNumber: invoice.invoiceNumber }
  } catch (e) {
    const message = errorMessage(e)
    await prisma.invoice
      .updateMany({
        where: { id: invoice.id, operationType: 'VOID' },
        data: isDefinitiveProviderFailure(e)
          ? { ...CLEAR_OPERATION, failReason: message }
          : { failReason: `作廢結果待對帳：${message}` },
      })
      .catch(() => {})
    return { success: false, error: message }
  }
}

/** 開立折讓單（退款 / 退課沖銷）。預設全額折讓。 */
export async function allowanceInvoiceForOrder(
  orderId: string,
  allowanceAmount?: number
): Promise<InvoiceOpResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { invoice: true },
  })
  if (!order || !order.invoice) return { success: false, error: '此訂單尚未開立發票' }
  const invoice = order.invoice
  if (!invoice.invoiceNumber) return { success: false, error: '發票號碼不存在' }
  // 支援分次折讓：已開立（ISSUED）或已部分折讓（ALLOWANCE）皆可繼續折讓。
  if (invoice.status !== 'ISSUED' && invoice.status !== 'ALLOWANCE') {
    return { success: false, error: '只有「已開立」或「部分折讓」的發票可以折讓' }
  }
  if (invoice.allowancePendingNumber) {
    return {
      success: true,
      skipped: true,
      invoiceNumber: invoice.invoiceNumber,
      message: `線上折讓 ${invoice.allowancePendingNumber} 已寄出，正等待買受人確認。`,
    }
  }

  // 以「剩餘可折讓金額」為上限累計，避免多次折讓加總超過發票金額。
  const alreadyAllowed = invoice.allowanceTotal ?? 0
  const remaining = invoice.amount - alreadyAllowed
  if (remaining <= 0) {
    return { success: false, error: '此發票已全額折讓，無可折讓餘額' }
  }
  const amount = allowanceAmount && allowanceAmount > 0 ? allowanceAmount : remaining
  if (!Number.isInteger(amount)) {
    return { success: false, error: '折讓金額必須是整數新台幣' }
  }
  if (amount > remaining) {
    return { success: false, error: `折讓金額不可超過剩餘可折讓金額 NT$${remaining}` }
  }

  const config = await getEInvoiceConfig()
  if (!isEInvoiceConfigured(config)) {
    return { success: false, error: '電子發票尚未設定完整憑證' }
  }
  if (invoice.provider !== config.provider) {
    return {
      success: false,
      error: `此發票由 ${invoice.provider} 開立，目前設定為 ${config.provider}，請切回原供應商再折讓。`,
    }
  }

  // ezPay 查詢 API 無法還原多次部分折讓的單次金額，無法在網路不明時安全重試。
  // 目前金流退款也僅支援全額，因此 ezPay 限定一次全額折讓以確保冪等。
  if (config.provider === 'ezpay' && (alreadyAllowed !== 0 || amount !== invoice.amount)) {
    return { success: false, error: 'ezPay 為確保折讓冪等，目前僅支援一次全額折讓' }
  }

  const ctx = await resolveOrderContext(order)
  if (config.provider === 'ecpay' && !config.testMode && !ctx.buyerEmail) {
    return { success: false, error: 'ECPay 線上折讓必須有買受人 Email' }
  }

  if (invoice.operationType) {
    const isFresh =
      invoice.operationStartedAt != null &&
      Date.now() - invoice.operationStartedAt.getTime() < INVOICE_OPERATION_STALE_MS
    if (isFresh) return { success: false, error: '發票折讓正在處理中，請稍後再試' }

    let clearedForSafeRetry = false

    // ECPay Stage 使用一般折讓（Stage 不寄線上確認信）；可用折讓明細累計額
    // 判斷前次是否成功，避免 API 成功但本地寫入失敗後重複折讓。
    if (
      config.provider === 'ecpay' &&
      config.testMode &&
      invoice.operationType === 'ALLOWANCE' &&
      invoice.operationAmount != null &&
      invoice.operationBaseAllowanceTotal != null &&
      invoice.invoiceDate
    ) {
      const provider = createEcpayInvoiceProvider(config)
      let details: Awaited<ReturnType<typeof provider.getAllowanceList>> = []
      try {
        details = await provider.getAllowanceList({
          invoiceNumber: invoice.invoiceNumber,
          date: formatTaiwanDate(invoice.invoiceDate),
          dateType: 'ISSUE',
        })
      } catch (error) {
        if (!isInvoiceError(error) || error.code !== 'NOT_FOUND') throw error
      }
      const active = details.filter((detail) => !detail.voided)
      const remoteTotal = active.reduce((sum, detail) => sum + detail.totalAmount, 0)
      const expectedTotal =
        invoice.operationBaseAllowanceTotal + invoice.operationAmount
      if (remoteTotal === expectedTotal) {
        const latest = [...active].sort(
          (a, b) => b.allowanceDate.getTime() - a.allowanceDate.getTime()
        )[0]
        if (!latest) throw new Error('ECPay 已折讓但查不到折讓單明細')
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'ALLOWANCE',
            allowanceNumber: latest.allowanceNumber,
            allowanceAmount: invoice.operationAmount,
            allowanceTotal: expectedTotal,
            failReason: null,
            rawResponse: toJson(latest.raw),
            ...CLEAR_OPERATION,
          },
        })
        return {
          success: true,
          skipped: true,
          invoiceNumber: invoice.invoiceNumber,
          message: 'ECPay 已有此筆折讓，本地狀態已安全同步。',
        }
      }
      if (remoteTotal === invoice.operationBaseAllowanceTotal) {
        const cleared = await prisma.invoice.updateMany({
          where: {
            id: invoice.id,
            operationType: 'ALLOWANCE',
            operationAmount: invoice.operationAmount,
            operationBaseAllowanceTotal: invoice.operationBaseAllowanceTotal,
            operationStartedAt: invoice.operationStartedAt,
          },
          data: CLEAR_OPERATION,
        })
        if (cleared.count !== 1) {
          return { success: false, error: '折讓狀態已被其他請求更新，請重新整理' }
        }
        clearedForSafeRetry = true
      } else {
        return {
          success: false,
          error: `ECPay 遠端折讓累計 NT$${remoteTotal} 與本地快照不符，已停止重複折讓。`,
        }
      }
    }

    // ezPay 全額折讓可透過發票狀態安全收斂；分次折讓無法從查詢 API
    // 還原單次金額，故寧可停止也不重複折讓。
    if (
      config.provider === 'ezpay' &&
      invoice.operationType === 'ALLOWANCE' &&
      invoice.operationBaseAllowanceTotal === 0 &&
      invoice.operationAmount === invoice.amount
    ) {
      const provider = createInvoiceProvider(config)
      const remote = await findProviderInvoiceByOrderId({
        client: provider,
        provider: config.provider,
        orderId: normalizeProviderOrderId(order.orderNo, config.provider),
        amount: invoice.amount,
      })
      if (remote?.status === 'ALLOWANCE') {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'ALLOWANCE',
            allowanceAmount: invoice.amount,
            allowanceTotal: invoice.amount,
            failReason: null,
            rawResponse: toJson(remote.raw),
            ...CLEAR_OPERATION,
          },
        })
        return {
          success: true,
          skipped: true,
          invoiceNumber: invoice.invoiceNumber,
          message: '加值中心已有全額折讓，本地狀態已安全同步。',
        }
      }
      if (remote?.status === 'ISSUED') {
        // 查詢已明確證實遠端尚未折讓，代表前次不確定請求沒有生效；
        // 以完整 operation 快照 CAS 釋放鎖後才允許重送。
        const cleared = await prisma.invoice.updateMany({
          where: {
            id: invoice.id,
            operationType: 'ALLOWANCE',
            operationAmount: invoice.operationAmount,
            operationBaseAllowanceTotal: invoice.operationBaseAllowanceTotal,
          },
          data: CLEAR_OPERATION,
        })
        if (cleared.count !== 1) {
          return { success: false, error: '折讓狀態已被其他請求更新，請重新整理' }
        }
        clearedForSafeRetry = true
      }
    }
    if (!clearedForSafeRetry) {
      return {
        success: false,
        error: '前次折讓結果無法安全確認，已停止重複折讓；請先在加值中心後台對帳。',
      }
    }
  }

  const claimed = await prisma.invoice.updateMany({
    where: {
      id: invoice.id,
      status: invoice.status,
      allowanceTotal: alreadyAllowed,
      operationType: null,
      allowancePendingNumber: null,
    },
    data: {
      operationType: 'ALLOWANCE',
      operationAmount: amount,
      operationBaseAllowanceTotal: alreadyAllowed,
      operationStartedAt: new Date(),
      failReason: null,
    },
  })
  if (claimed.count !== 1) {
    return { success: false, error: '發票已由另一個請求接手處理，請重新整理' }
  }

  try {
    const allowanceId = toProviderAllowanceOrderId({
      provider: config.provider,
      orderNo: order.orderNo,
      alreadyAllowed,
      amount,
    })
    const input = buildAllowanceInput({
      provider: config.provider,
      invoiceNumber: invoice.invoiceNumber,
      allowanceId,
      originalOrderId: normalizeProviderOrderId(order.orderNo, config.provider),
      amount,
      itemName: ctx.itemName,
      invoiceDate: invoice.invoiceDate,
      buyerEmail: ctx.buyerEmail,
      taxExclusive: config.provider === 'ezpay' && order.invoiceType === 'COMPANY',
    })

    if (config.provider === 'ecpay' && !config.testMode) {
      const provider = createEcpayInvoiceProvider(config)
      const baseUrl = await resolveAppUrl()
      const result = await provider.allowanceOnline(input, {
        notifyMail: ctx.buyerEmail!,
        customerName: ctx.buyerName ?? undefined,
        reason: '訂單退款',
        returnUrl: `${baseUrl}/api/invoice/ecpay/allowance-notify`,
      })
      if (!/^\d{16}$/.test(result.allowanceNumber)) {
        throw new Error(`ECPay 回傳無效線上折讓單號：${result.allowanceNumber || '(空白)'}`)
      }
      if (!(result.expiresAt instanceof Date) || Number.isNaN(result.expiresAt.getTime())) {
        throw new Error('ECPay 未回傳有效線上折讓到期日期')
      }
      const updated = await prisma.invoice.updateMany({
        where: { id: invoice.id, operationType: 'ALLOWANCE' },
        data: {
          allowancePendingNumber: result.allowanceNumber,
          allowancePendingAmount: amount,
          allowancePendingExpiresAt: result.expiresAt,
          rawResponse: toJson(result.raw),
          failReason: null,
          ...CLEAR_OPERATION,
        },
      })
      if (updated.count !== 1) throw new Error('線上折讓已建立，但本地待確認狀態更新失敗')
      return {
        success: true,
        invoiceNumber: invoice.invoiceNumber,
        message: `線上折讓 ${result.allowanceNumber} 已寄送給買受人，確認後才會正式開立。`,
      }
    }

    const provider = createInvoiceProvider(config)
    const result = await provider.allowance(input)
    if (!result.allowanceNumber) throw new Error('加值中心未回傳折讓單號')
    if (result.totalAmount !== amount) {
      throw new Error(`加值中心回傳折讓金額 NT$${result.totalAmount} 與預期 NT$${amount} 不符`)
    }
    const updated = await prisma.invoice.updateMany({
      where: { id: invoice.id, operationType: 'ALLOWANCE' },
      data: {
        status: 'ALLOWANCE',
        allowanceNumber: result.allowanceNumber,
        allowanceAmount: amount, // 最近一次折讓金額
        allowanceTotal: alreadyAllowed + amount, // 累計已折讓金額
        failReason: null,
        rawResponse: toJson(result.raw),
        ...CLEAR_OPERATION,
      },
    })
    if (updated.count !== 1) throw new Error('折讓已成功，但本地發票狀態更新失敗')
    return { success: true, invoiceNumber: invoice.invoiceNumber }
  } catch (e) {
    const message = errorMessage(e)
    await prisma.invoice
      .updateMany({
        where: { id: invoice.id, operationType: 'ALLOWANCE' },
        data: isDefinitiveProviderFailure(e)
          ? { ...CLEAR_OPERATION, failReason: message }
          : { failReason: `折讓結果待對帳：${message}` },
      })
      .catch(() => {})
    return { success: false, error: message }
  }
}

/**
 * 退款時自動沖銷電子發票（H2）。
 *
 * 規則：
 * - 發票不存在 / 未開立 → 略過（skipped）。
 * - 發票開立於「同一張統一發票期別（雙月）」內 → 作廢（void）。
 * - 跨期別 → 開立全額折讓（allowance）。
 *
 * 失敗只回報、不丟出：呼叫端（退款流程）需據此告警，但不可因發票沖銷失敗而回滾退款。
 */
export async function syncInvoiceForRefund(
  orderId: string,
  reason: string
): Promise<InvoiceOpResult> {
  let invoice = await prisma.invoice.findUnique({
    where: { orderId },
    include: { order: { select: { orderNo: true } } },
  })
  if (!invoice) {
    return { success: true, skipped: true }
  }

  // 發票 API 可能已成功、但本地在儲存號碼前中斷。退款 outbox 不可直接略過，
  // 必須先以原 MerchantOrderNo / RelateNumber 查遠端，否則會留下未沖銷發票。
  if (!invoice.invoiceNumber && (invoice.status === 'PENDING' || invoice.status === 'FAILED')) {
    const config = await getEInvoiceConfig()
    if (!isEInvoiceConfigured(config) || config.provider !== invoice.provider) {
      return {
        success: false,
        error: `退款前無法對帳 ${invoice.provider} 發票，請確認原供應商憑證仍有效。`,
      }
    }
    const provider = createInvoiceProvider(config)
    const remote = await findProviderInvoiceByOrderId({
      client: provider,
      provider: config.provider,
      orderId: normalizeProviderOrderId(invoice.order.orderNo, config.provider),
      amount: invoice.amount,
    })
    if (!remote) {
      await prisma.invoice.updateMany({
        where: { id: invoice.id, invoiceNumber: null },
        data: {
          status: 'FAILED',
          failReason: '訂單已退款，且加值中心確認未曾開立此發票。',
        },
      })
      return { success: true, skipped: true }
    }
    if (!remote.invoiceNumber || remote.amount.totalAmount !== invoice.amount) {
      return { success: false, error: '加值中心發票號碼或金額與退款訂單不符，已停止自動沖銷。' }
    }
    if (remote.status === 'ALLOWANCE') {
      await prisma.invoice.updateMany({
        where: { id: invoice.id, invoiceNumber: null },
        data: {
          status: 'ALLOWANCE',
          invoiceNumber: remote.invoiceNumber,
          randomCode: remote.randomCode,
          invoiceDate: remote.invoiceDate,
          failReason: '加值中心已有折讓，但本地缺少折讓金額，請人工對帳。',
          rawResponse: toJson(remote.raw),
        },
      })
      return { success: false, error: '加值中心已有折讓，但本地缺少折讓金額，請人工對帳。' }
    }
    await prisma.invoice.updateMany({
      where: { id: invoice.id, invoiceNumber: null },
      data: {
        status: remote.status === 'VOIDED' ? 'VOIDED' : 'ISSUED',
        invoiceNumber: remote.invoiceNumber,
        randomCode: remote.randomCode,
        invoiceDate: remote.invoiceDate,
        voidedAt: remote.status === 'VOIDED' ? new Date() : null,
        failReason: null,
        rawResponse: toJson(remote.raw),
      },
    })
    invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      include: { order: { select: { orderNo: true } } },
    })
  }

  if (!invoice.invoiceNumber || invoice.status === 'VOIDED' || invoice.status === 'FAILED') {
    return { success: true, skipped: true }
  }
  if (invoice.allowancePendingNumber) {
    return {
      success: false,
      error: `折讓 ${invoice.allowancePendingNumber} 正等待買受人確認；系統會持續對帳。`,
    }
  }
  if (invoice.allowanceTotal >= invoice.amount) return { success: true, skipped: true }

  const issuedInSamePeriod =
    invoice.status === 'ISSUED' &&
    invoice.allowanceTotal === 0 &&
    invoice.invoiceDate != null &&
    isSameTaiwanInvoicePeriod(invoice.invoiceDate, new Date())

  return issuedInSamePeriod
    ? voidInvoiceForOrder(orderId, reason || '訂單退款')
    : allowanceInvoiceForOrder(orderId)
}

/**
 * 判斷兩個日期是否落在同一個台灣統一發票期別（雙月制：1-2、3-4、5-6、7-8、9-10、11-12 月）。
 * 同期別內的發票可作廢；跨期別只能開折讓。
 */
function isSameTaiwanInvoicePeriod(a: Date, b: Date): boolean {
  // 以台灣時區（UTC+8）判斷月份，避免 UTC 邊界把跨月誤判。
  const tw = (d: Date) => new Date(d.getTime() + 8 * 60 * 60 * 1000)
  const da = tw(a)
  const db = tw(b)
  return (
    da.getUTCFullYear() === db.getUTCFullYear() &&
    Math.floor(da.getUTCMonth() / 2) === Math.floor(db.getUTCMonth() / 2)
  )
}

function formatTaiwanDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}
