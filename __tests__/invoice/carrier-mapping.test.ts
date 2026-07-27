// __tests__/invoice/carrier-mapping.test.ts
//
// 對應 openspec/changes/upgrade-v1-8-0-preserve-payment-and-crm-fixes
// tasks.md 任務 6.1（原分支 2 / v1.7.3 遺留任務 1.5）
// 依 docs/audits/payment-invoice-audit-2026-06-22.md #1 CRITICAL 補測：
// 「電子發票：預設『個人/會員載具』在 ECPay 一律開立失敗
// （member 載具被丟棄 → 被當需地址的紙本發票）」。
//
// 稽核根因：結帳預設 carrierType='member'（消費者最常見選項），舊版
// buildIssueInput 只對 'mobile' 設 carrier，對 'member' / 未指定不做任何
// 映射 → SDK 判定為無載具紙本發票（print='1'）→ 因缺 CustomerAddr 直接
// VALIDATION 失敗。修法見 lib/invoice/issue.ts:141-153（本測試鎖定的行為）：
// PERSONAL 型態下，非 mobile 一律落入 CarrierType.MEMBER 分支，避免再度
// 被誤判為紙本發票。
//
// 這份測試同時驗證 mobile 條碼與 COMPANY 統編既有分支沒有被這次補強
// 意外破壞（既有測試 provider.test.ts / ezpay-order-id.test.ts 已用
// carrierType:'member' 跑過完整 provider 流程，但沒有斷言 input.carrier
// 的實際內容 —— 這正是本測試要補的缺口）。

import { buildIssueInput, type OrderInvoicePreference } from '@/lib/invoice/issue'
import { CarrierType } from '@paid-tw/einvoice'

const basePreference: OrderInvoicePreference = {
  invoiceType: 'PERSONAL',
  carrierType: null,
  carrierId: null,
  taxId: null,
  title: null,
  loveCode: null,
  address: null,
}

function build(preference: OrderInvoicePreference, provider: 'ecpay' | 'ezpay' = 'ecpay') {
  return buildIssueInput({
    orderNo: 'ORD20260723TEST0001',
    amount: 300,
    itemName: '測試課程',
    buyerName: '測試學員',
    buyerEmail: 'student@example.com',
    preference,
    provider,
  })
}

describe('buildIssueInput：會員載具映射（稽核 #1 CRITICAL 回歸鎖定）', () => {
  describe('carrierType 為 member（消費者最常見預設值）', () => {
    it('ECPay：對映為 CarrierType.MEMBER，不落入無載具紙本分支', () => {
      const input = build({ ...basePreference, carrierType: 'member' }, 'ecpay')

      expect(input.carrier).toEqual({ type: CarrierType.MEMBER, code: undefined })
      // 不應該有 donation（member 不是捐贈），且沒有落入「無 carrier」狀態。
      expect(input.donation).toBeUndefined()
    })

    it('ezPay：對映為 CarrierType.MEMBER，且 code 帶入買受人 Email 供歸戶（MIG CarrierType=2 要求）', () => {
      const input = build({ ...basePreference, carrierType: 'member' }, 'ezpay')

      expect(input.carrier).toEqual({
        type: CarrierType.MEMBER,
        code: 'student@example.com',
      })
    })
  })

  describe('carrierType 未指定（null，結帳表單預設值，行為需與 member 一致）', () => {
    it('ECPay：等同 member，對映為 CarrierType.MEMBER', () => {
      const input = build({ ...basePreference, carrierType: null }, 'ecpay')
      expect(input.carrier).toEqual({ type: CarrierType.MEMBER, code: undefined })
    })

    it('ezPay：等同 member，對映為 CarrierType.MEMBER 並帶買受人 Email', () => {
      const input = build({ ...basePreference, carrierType: null }, 'ezpay')
      expect(input.carrier).toEqual({
        type: CarrierType.MEMBER,
        code: 'student@example.com',
      })
    })
  })

  it('member / 未指定載具但缺買受人 Email 時，明確拋出錯誤（避免靜默送出無法歸戶的發票）', () => {
    expect(() =>
      buildIssueInput({
        orderNo: 'ORD20260723TEST0002',
        amount: 300,
        itemName: '測試課程',
        buyerName: '測試學員',
        buyerEmail: null,
        preference: { ...basePreference, carrierType: 'member' },
        provider: 'ezpay',
      })
    ).toThrow('個人會員載具必須有買受人 Email')
  })
})

describe('buildIssueInput：既有分支未被本次補強破壞（回歸防護）', () => {
  it('mobile 手機條碼分支維持既有行為（不受 member 映射影響）', () => {
    const input = build(
      { ...basePreference, carrierType: 'mobile', carrierId: '/ABC1234' },
      'ecpay'
    )

    expect(input.carrier).toEqual({
      type: CarrierType.MOBILE_BARCODE,
      code: '/ABC1234',
    })
  })

  it('COMPANY 統編分支維持既有行為：不套用個人載具邏輯，改帶 ubn + 抬頭', () => {
    const input = build(
      {
        ...basePreference,
        invoiceType: 'COMPANY',
        taxId: '12345678',
        title: '測試公司行號',
        carrierType: 'member', // 即使表單殘留 member 值，COMPANY 分支也不應套用個人載具邏輯。
      },
      'ecpay'
    )

    expect(input.buyer.ubn).toBe('12345678')
    expect(input.buyer.name).toBe('測試公司行號')
    // B2B 三聯式不使用個人載具欄位。
    expect(input.carrier).toBeUndefined()
  })

  it('DONATION 愛心碼分支維持既有行為', () => {
    const input = build(
      { ...basePreference, invoiceType: 'DONATION', loveCode: '168001' },
      'ecpay'
    )

    expect(input.donation).toEqual({ npoban: '168001' })
    expect(input.carrier).toBeUndefined()
  })
})
