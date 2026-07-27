// lib/actions/einvoice.ts
// 臺灣電子發票 Server Actions
// 設定讀寫 + 測試連線、訂單開立 / 作廢 / 折讓「全部僅限 ADMIN」。
// 發票屬財稅 / 全站性質，且訂單可為跨課程的組合包，故不開放給講師（避免跨課程越權竄改發票）。

'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireOnlyAdminAuth } from '@/lib/require-admin'
import { SETTING_KEYS } from '@/lib/validations/settings'
import {
  einvoiceSettingsSchema,
  EINVOICE_PROVIDERS,
  type EInvoiceSettingsFormData,
  type EInvoiceProvider,
} from '@/lib/validations/einvoice'
import {
  getEInvoiceConfig,
  isEInvoiceConfigured,
  type EInvoiceConfig,
} from '@/lib/invoice/config'
import { createInvoiceProvider } from '@/lib/invoice/provider'
import { buildIssueInput, normalizeProviderOrderId } from '@/lib/invoice/issue'
import { getEInvoiceCredentialError } from '@/lib/invoice/credentials'
import { findProviderInvoiceByOrderId } from '@/lib/invoice/query'
import {
  issueInvoiceForOrder,
  voidInvoiceForOrder,
  allowanceInvoiceForOrder,
} from '@/lib/invoice/service'
import { isInvoiceError } from '@paid-tw/einvoice'
import type { AdminAction } from '@prisma/client'

async function upsertSetting(key: string, value: string): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

function maskTail(value: string, tail = 4): string {
  if (!value) return ''
  return `${'•'.repeat(Math.max(0, Math.min(12, value.length - tail)))}${value.slice(-tail)}`
}

async function logEInvoiceAction(
  adminId: string,
  action: AdminAction,
  targetType: string,
  targetId: string | undefined,
  details: Record<string, unknown>
) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action,
        targetType,
        targetId,
        details: JSON.parse(JSON.stringify(details)),
      },
    })
  } catch (error) {
    console.error('記錄發票操作日誌失敗:', error)
  }
}

// ---------------------------------------------------------------------------
// 設定（僅 ADMIN）
// ---------------------------------------------------------------------------

export interface EInvoiceSettingsView {
  enabled: boolean
  provider: EInvoiceProvider
  merchantId: string
  hashKeyHint: string
  hashIVHint: string
  testMode: boolean
  autoIssue: boolean
  sellerName: string
  sellerTaxId: string
  isConfigured: boolean
}

export async function getEInvoiceSettings(): Promise<EInvoiceSettingsView> {
  await requireOnlyAdminAuth()
  const config = await getEInvoiceConfig()
  return {
    enabled: config.enabled,
    provider: config.provider,
    merchantId: config.merchantId,
    hashKeyHint: maskTail(config.hashKey),
    hashIVHint: maskTail(config.hashIV),
    testMode: config.testMode,
    autoIssue: config.autoIssue,
    sellerName: config.sellerName,
    sellerTaxId: config.sellerTaxId,
    isConfigured: isEInvoiceConfigured(config),
  }
}

export async function updateEInvoiceSettings(
  data: EInvoiceSettingsFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireOnlyAdminAuth()
    const v = einvoiceSettingsSchema.parse(data)
    const stored = await getEInvoiceConfig()
    const hasNewHashKey = !!v.hashKey && !v.hashKey.includes('•')
    const hasNewHashIV = !!v.hashIV && !v.hashIV.includes('•')
    const candidate: EInvoiceConfig = {
      ...stored,
      enabled: v.enabled,
      provider: v.provider,
      merchantId: (v.merchantId || '').trim(),
      hashKey: hasNewHashKey ? v.hashKey!.trim() : stored.hashKey,
      hashIV: hasNewHashIV ? v.hashIV!.trim() : stored.hashIV,
      testMode: v.testMode,
      autoIssue: v.autoIssue,
      sellerName: (v.sellerName || '').trim(),
      sellerTaxId: (v.sellerTaxId || '').trim(),
    }

    if (v.enabled && v.provider !== stored.provider && (!hasNewHashKey || !hasNewHashIV)) {
      return {
        success: false,
        error: '切換發票供應商時，請重新輸入新供應商的 HashKey 與 HashIV，避免沿用舊憑證。',
      }
    }

    const credentialError = getEInvoiceCredentialError(candidate)
    if (v.enabled && credentialError) return { success: false, error: credentialError }

    await Promise.all([
      upsertSetting(SETTING_KEYS.EINVOICE_ENABLED, String(v.enabled)),
      upsertSetting(SETTING_KEYS.EINVOICE_PROVIDER, v.provider),
      upsertSetting(SETTING_KEYS.EINVOICE_MERCHANT_ID, (v.merchantId || '').trim()),
      upsertSetting(SETTING_KEYS.EINVOICE_TEST_MODE, String(v.testMode)),
      upsertSetting(SETTING_KEYS.EINVOICE_AUTO_ISSUE, String(v.autoIssue)),
      upsertSetting(SETTING_KEYS.EINVOICE_SELLER_NAME, (v.sellerName || '').trim()),
      upsertSetting(SETTING_KEYS.EINVOICE_SELLER_TAX_ID, (v.sellerTaxId || '').trim()),
      // 敏感欄位：僅在有輸入新值（非空、非遮蔽）時才覆蓋
      ...(v.hashKey && !v.hashKey.includes('•')
        ? [upsertSetting(SETTING_KEYS.EINVOICE_HASH_KEY, v.hashKey.trim())]
        : []),
      ...(v.hashIV && !v.hashIV.includes('•')
        ? [upsertSetting(SETTING_KEYS.EINVOICE_HASH_IV, v.hashIV.trim())]
        : []),
    ])

    await logEInvoiceAction(user.id as string, 'UPDATE_EINVOICE_SETTINGS', 'SiteSetting', undefined, {
      enabled: v.enabled,
      provider: v.provider,
      merchantId: v.merchantId,
      testMode: v.testMode,
      autoIssue: v.autoIssue,
      sellerName: v.sellerName,
      sellerTaxId: v.sellerTaxId,
      hashKey: v.hashKey && !v.hashKey.includes('•') ? '[REDACTED]' : '(unchanged)',
      hashIV: v.hashIV && !v.hashIV.includes('•') ? '[REDACTED]' : '(unchanged)',
    })

    revalidatePath('/admin/payments')
    return { success: true }
  } catch (error) {
    console.error('更新電子發票設定失敗:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '更新電子發票設定時發生錯誤',
    }
  }
}

export async function testEInvoiceConnection(input?: {
  provider?: string
  merchantId?: string
  hashKey?: string
  hashIV?: string
  testMode?: boolean
}): Promise<{ success: boolean; message: string; kind: 'issued' | 'verified' | 'error' }> {
  try {
    await requireOnlyAdminAuth()
    const stored = await getEInvoiceConfig()

    const provider = (
      input?.provider && EINVOICE_PROVIDERS.includes(input.provider as EInvoiceProvider)
        ? input.provider
        : stored.provider
    ) as EInvoiceProvider
    const merchantId = input?.merchantId?.trim() || stored.merchantId
    const hashKey =
      input?.hashKey && !input.hashKey.includes('•') ? input.hashKey.trim() : stored.hashKey
    const hashIV =
      input?.hashIV && !input.hashIV.includes('•') ? input.hashIV.trim() : stored.hashIV
    const testMode = input?.testMode ?? stored.testMode

    const config: EInvoiceConfig = { ...stored, provider, merchantId, hashKey, hashIV, testMode }
    const credentialError = getEInvoiceCredentialError(config)
    if (credentialError) {
      return { success: false, message: credentialError, kind: 'error' }
    }

    const providerClient = createInvoiceProvider(config)

    // 正式環境只能做唯讀查詢驗證，絕不以「測試」名義開出真實發票或消耗字軌。
    // 查無此測試單號（NOT_FOUND）同樣代表 API、環境與憑證均已成功通過加值中心驗證。
    if (!testMode) {
      const probeOrderNo = `VERIFY${Date.now().toString(36)}`
      await findProviderInvoiceByOrderId({
        client: providerClient,
        provider,
        orderId: normalizeProviderOrderId(probeOrderNo, provider),
        amount: 1,
      })
      return {
        success: true,
        kind: 'verified',
        message: '正式環境連線與憑證驗證成功。本次僅執行唯讀查詢，沒有開立發票、也沒有消耗字軌。',
      }
    }

    const result = await providerClient.issue(
      buildIssueInput({
        orderNo: `TEST${Date.now().toString().slice(-10)}`,
        amount: 1,
        itemName: '電子發票串接測試',
        buyerName: '測試買受人',
        // 個人測試會走 MEMBER 雲端載具；藍新該載具需帶 email，故給測試信箱
        buyerEmail: 'einvoice-test@example.com',
        preference: {
          invoiceType: 'PERSONAL',
          carrierType: null,
          carrierId: null,
          taxId: null,
          title: null,
          loveCode: null,
          address: null,
        },
        provider: config.provider,
      })
    )

    return {
      success: true,
      kind: 'issued',
      message: `測試開立成功！發票號碼：${result.invoiceNumber}（${testMode ? '測試' : '正式'}環境）`,
    }
  } catch (error) {
    const message = isInvoiceError(error)
      ? `[${error.code}] ${error.rawMessage || error.message}`
      : error instanceof Error
        ? error.message
        : '測試失敗，請稍後再試。'
    return { success: false, message, kind: 'error' }
  }
}

// ---------------------------------------------------------------------------
// 訂單發票操作（僅 ADMIN）
// ---------------------------------------------------------------------------

export async function issueInvoiceAction(
  orderId: string
): Promise<{
  success: boolean
  error?: string
  invoiceNumber?: string
  skipped?: boolean
  message?: string
}> {
  try {
    const user = await requireOnlyAdminAuth()
    const result = await issueInvoiceForOrder(orderId)
    if (result.success) {
      await logEInvoiceAction(user.id as string, 'ISSUE_INVOICE', 'Order', orderId, {
        invoiceNumber: result.invoiceNumber,
        skipped: result.skipped ?? false,
      })
      revalidatePath(`/admin/orders/${orderId}`)
      revalidatePath('/admin/orders')
    }
    return result
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '開立發票失敗' }
  }
}

export async function voidInvoiceAction(
  orderId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireOnlyAdminAuth()
    const result = await voidInvoiceForOrder(orderId, reason)
    if (result.success) {
      await logEInvoiceAction(user.id as string, 'VOID_INVOICE', 'Order', orderId, {
        invoiceNumber: result.invoiceNumber,
        reason,
      })
      revalidatePath(`/admin/orders/${orderId}`)
      revalidatePath('/admin/orders')
    }
    return result
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '作廢發票失敗' }
  }
}

export async function allowanceInvoiceAction(
  orderId: string,
  allowanceAmount?: number
): Promise<{ success: boolean; error?: string; message?: string; skipped?: boolean }> {
  try {
    const user = await requireOnlyAdminAuth()
    // L52：action 層驗證折讓金額（service 層也會以剩餘可折讓金額把關，此為前置防呆）
    if (
      allowanceAmount !== undefined &&
      (!Number.isInteger(allowanceAmount) || allowanceAmount <= 0)
    ) {
      return { success: false, error: '折讓金額必須為正整數' }
    }
    const result = await allowanceInvoiceForOrder(orderId, allowanceAmount)
    if (result.success) {
      await logEInvoiceAction(user.id as string, 'ALLOWANCE_INVOICE', 'Order', orderId, {
        invoiceNumber: result.invoiceNumber,
        allowanceAmount,
      })
      revalidatePath(`/admin/orders/${orderId}`)
      revalidatePath('/admin/orders')
    }
    return result
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '開立折讓失敗' }
  }
}
