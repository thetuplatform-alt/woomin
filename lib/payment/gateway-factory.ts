// lib/payment/gateway-factory.ts
// 金流閘道工廠：根據 DB 設定取得當前啟用的 gateway
//
// 支援三間金流（依業務主推順序）：
// 1. shopline — SHOPLINE Payments（主推）
// 2. stripe   — 國際金流
// 3. payuni   — 台灣在地金流

import { prisma } from '@/lib/prisma'
import { SETTING_KEYS } from '@/lib/validations/settings'
import type {
  PaymentGateway,
  PaymentGatewayType,
  PaymentGatewaySettings,
} from './types'
import { StripeGateway } from './stripe-gateway'
import { PayUniGateway } from './payuni-gateway'
import { ShoplineGateway } from './shopline-gateway'
import { parseShoplinePaymentMethods } from './shopline-methods'

function resolveBooleanSetting(
  dbValue: string | undefined,
  envValue: string | undefined,
  fallback: boolean
): boolean {
  const value = dbValue ?? envValue
  if (value == null || value === '') return fallback
  return value.toLowerCase() !== 'false'
}

/**
 * 從 DB 批量讀取金流相關設定（DB 優先、env fallback）
 */
export async function getPaymentGatewaySettings(): Promise<PaymentGatewaySettings> {
  const keys = [
    SETTING_KEYS.PAYMENT_GATEWAY,
    SETTING_KEYS.SHOPLINE_MERCHANT_ID,
    SETTING_KEYS.SHOPLINE_API_KEY,
    SETTING_KEYS.SHOPLINE_CLIENT_KEY,
    SETTING_KEYS.SHOPLINE_SIGN_KEY,
    SETTING_KEYS.SHOPLINE_TEST_MODE,
    SETTING_KEYS.SHOPLINE_PAYMENT_METHODS,
    SETTING_KEYS.STRIPE_SECRET_KEY,
    SETTING_KEYS.STRIPE_WEBHOOK_SECRET,
    SETTING_KEYS.PAYUNI_MERCHANT_ID,
    SETTING_KEYS.PAYUNI_HASH_KEY,
    SETTING_KEYS.PAYUNI_HASH_IV,
    SETTING_KEYS.PAYUNI_TEST_MODE,
  ]

  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: keys } },
  })

  const settingMap = new Map(settings.map((s) => [s.key, s.value]))

  return {
    gateway:
      (settingMap.get(SETTING_KEYS.PAYMENT_GATEWAY) as PaymentGatewayType) ||
      'shopline',
    shopline: {
      merchantId:
        settingMap.get(SETTING_KEYS.SHOPLINE_MERCHANT_ID) ||
        process.env.SHOPLINE_MERCHANT_ID ||
        '',
      apiKey:
        settingMap.get(SETTING_KEYS.SHOPLINE_API_KEY) ||
        process.env.SHOPLINE_API_KEY ||
        '',
      clientKey:
        settingMap.get(SETTING_KEYS.SHOPLINE_CLIENT_KEY) ||
        process.env.SHOPLINE_CLIENT_KEY ||
        '',
      signKey:
        settingMap.get(SETTING_KEYS.SHOPLINE_SIGN_KEY) ||
        process.env.SHOPLINE_SIGN_KEY ||
        '',
      testMode: resolveBooleanSetting(
        settingMap.get(SETTING_KEYS.SHOPLINE_TEST_MODE),
        process.env.SHOPLINE_TEST_MODE,
        true
      ),
      enabledPaymentMethods: parseShoplinePaymentMethods(
        settingMap.get(SETTING_KEYS.SHOPLINE_PAYMENT_METHODS) ||
          process.env.SHOPLINE_PAYMENT_METHODS
      ),
    },
    stripe: {
      secretKey:
        settingMap.get(SETTING_KEYS.STRIPE_SECRET_KEY) ||
        process.env.STRIPE_SECRET_KEY ||
        '',
      webhookSecret:
        settingMap.get(SETTING_KEYS.STRIPE_WEBHOOK_SECRET) ||
        process.env.STRIPE_WEBHOOK_SECRET ||
        '',
    },
    payuni: {
      merchantId:
        settingMap.get(SETTING_KEYS.PAYUNI_MERCHANT_ID) ||
        process.env.PAYUNI_MERCHANT_ID ||
        '',
      hashKey:
        settingMap.get(SETTING_KEYS.PAYUNI_HASH_KEY) ||
        process.env.PAYUNI_HASH_KEY ||
        '',
      hashIV:
        settingMap.get(SETTING_KEYS.PAYUNI_HASH_IV) ||
        process.env.PAYUNI_HASH_IV ||
        '',
      testMode: resolveBooleanSetting(
        settingMap.get(SETTING_KEYS.PAYUNI_TEST_MODE),
        process.env.PAYUNI_TEST_MODE,
        true
      ),
    },
  }
}

/**
 * 取得當前啟用的金流閘道類型
 */
export async function getActiveGatewayType(): Promise<PaymentGatewayType> {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: SETTING_KEYS.PAYMENT_GATEWAY },
  })
  return (setting?.value as PaymentGatewayType) || 'shopline'
}

/**
 * 取得當前啟用的金流閘道實例
 */
export async function getActivePaymentGateway(): Promise<PaymentGateway> {
  const settings = await getPaymentGatewaySettings()
  return createGatewayFromSettings(settings)
}

/**
 * 根據設定建立 gateway 實例
 */
export function createGatewayFromSettings(
  settings: PaymentGatewaySettings
): PaymentGateway {
  if (settings.gateway === 'shopline') {
    const {
      merchantId,
      apiKey,
      clientKey,
      signKey,
      testMode,
      enabledPaymentMethods,
    } = settings.shopline
    if (!merchantId || !apiKey) {
      throw new Error(
        'SHOPLINE Payments 金流設定不完整，請至後台設定商店代號與 API Key'
      )
    }
    return new ShoplineGateway({
      merchantId,
      apiKey,
      clientKey,
      signKey,
      testMode,
      enabledPaymentMethods,
    })
  }

  if (settings.gateway === 'payuni') {
    const { merchantId, hashKey, hashIV, testMode } = settings.payuni
    if (!merchantId || !hashKey || !hashIV) {
      throw new Error(
        'PAYUNi 金流設定不完整，請至後台設定商店代號、Hash Key 和 Hash IV'
      )
    }
    return new PayUniGateway({ merchantId, hashKey, hashIV, testMode })
  }

  // Stripe
  const { secretKey, webhookSecret } = settings.stripe

  if (!secretKey) {
    throw new Error('Stripe 金流設定不完整，請設定 Secret Key')
  }

  if (!webhookSecret) {
    throw new Error('Stripe 金流設定不完整，請設定 Webhook Secret')
  }

  return new StripeGateway({ secretKey, webhookSecret })
}

/**
 * 根據特定 gateway 類型取得 gateway 實例（用於處理舊訂單的 webhook）
 */
export async function getGatewayByType(
  type: PaymentGatewayType
): Promise<PaymentGateway> {
  const settings = await getPaymentGatewaySettings()
  const overridden = { ...settings, gateway: type }
  return createGatewayFromSettings(overridden)
}
