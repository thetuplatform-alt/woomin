import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { InvoiceError, InvoiceErrorCode, isInvoiceError } from '@paid-tw/einvoice'
import { createEcpayProvider, decryptData, encryptData } from '@paid-tw/einvoice-ecpay'
import { createEzpayProvider, decryptPostData } from '@paid-tw/einvoice-ezpay'
import { buildAllowanceInput, buildIssueInput } from '../lib/invoice/issue'
import { getEInvoiceCredentialError } from '../lib/invoice/credentials'
import { findProviderInvoiceByOrderId } from '../lib/invoice/query'
import { toProviderAllowanceOrderId } from '../lib/invoice/provider-order-id'
import { normalizeProviderVoidReason } from '../lib/invoice/provider-limits'
import {
  createEcpayAllowanceCheckMac,
  verifyEcpayAllowanceCheckMac,
} from '../lib/invoice/ecpay-online-allowance'
import { isTransientInvoiceVerificationError } from '../lib/invoice/preflight'

const ORDER_NO = 'ORD20260711a1b2c3d4e5f6a7b8'
const EZPAY_HASH_KEY = '12345678901234567890123456789012'
const HASH_IV = '1234567890123456'
const ECPAY_HASH_KEY = '1234567890123456'

function issueInput(provider: 'ecpay' | 'ezpay') {
  return buildIssueInput({
    orderNo: ORDER_NO,
    amount: 30,
    itemName: '電子發票回歸測試課程',
    buyerName: '測試買受人',
    buyerEmail: 'invoice-test@example.com',
    preference: {
      invoiceType: 'PERSONAL',
      carrierType: 'member',
      carrierId: null,
      taxId: null,
      title: null,
      loveCode: null,
      address: null,
    },
    provider,
  })
}

test('ezPay issue input uses a deterministic MerchantOrderNo of at most 20 characters', () => {
  const first = issueInput('ezpay').orderId
  const second = issueInput('ezpay').orderId

  assert.equal(first, second)
  assert.equal(first, `EZ${createHash('sha256').update(ORDER_NO).digest('hex').slice(0, 18)}`)
  assert.match(first, /^[A-Za-z0-9_]+$/)
  assert.ok(first.length <= 20, `expected <=20 characters, received ${first.length}: ${first}`)
})

test('ezPay SDK receives the normalized MerchantOrderNo in the encrypted PostData_', async () => {
  let merchantOrderNo = ''
  let carrierType = ''
  let carrierNum = ''
  let itemName = ''
  const provider = createEzpayProvider({
    merchantId: '123456789',
    hashKey: EZPAY_HASH_KEY,
    hashIV: HASH_IV,
    mode: 'TEST',
    fetch: async (_url, init) => {
      const body = init?.body as URLSearchParams
      const encrypted = body.get('PostData_')
      assert.ok(encrypted)
      const payload = new URLSearchParams(decryptPostData(encrypted, EZPAY_HASH_KEY, HASH_IV))
      merchantOrderNo = payload.get('MerchantOrderNo') ?? ''
      carrierType = payload.get('CarrierType') ?? ''
      carrierNum = payload.get('CarrierNum') ?? ''
      itemName = payload.get('ItemName') ?? ''

      return new Response(
        JSON.stringify({
          Status: 'SUCCESS',
          Message: 'success',
          Result: JSON.stringify({
            InvoiceNumber: 'AB12345678',
            CreateTime: '2026-07-15 12:00:00',
            RandomNum: '1234',
            MerchantOrderNo: merchantOrderNo,
            InvoiceTransNo: '1234567890',
            TotalAmt: 30,
          }),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    },
  })

  await provider.issue(issueInput('ezpay'))

  assert.equal(merchantOrderNo, issueInput('ezpay').orderId)
  assert.ok(merchantOrderNo.length <= 20)
  assert.equal(carrierType, '2')
  assert.equal(carrierNum, 'invoice-test@example.com')
  assert.ok(itemName.length <= 30)
})

test('ECPay keeps the original order number as RelateNumber', async () => {
  let relateNumber = ''
  let carrierNum = 'not-empty'
  const provider = createEcpayProvider({
    merchantId: '2000132',
    hashKey: ECPAY_HASH_KEY,
    hashIV: HASH_IV,
    mode: 'TEST',
    fetch: async (_url, init) => {
      const envelope = JSON.parse(String(init?.body)) as { Data: string }
      const payload = decryptData(envelope.Data, ECPAY_HASH_KEY, HASH_IV) as {
        RelateNumber: string
      }
      relateNumber = payload.RelateNumber
      carrierNum = String((payload as { CarrierNum?: string }).CarrierNum ?? '')

      return new Response(
        JSON.stringify({
          TransCode: 1,
          TransMsg: 'Success',
          Data: encryptData(
            {
              RtnCode: 1,
              RtnMsg: 'Success',
              InvoiceNo: 'AB12345678',
              InvoiceDate: '2026-07-15 12:00:00',
              RandomNumber: '1234',
            },
            ECPAY_HASH_KEY,
            HASH_IV
          ),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    },
  })

  await provider.issue(issueInput('ecpay'))

  assert.equal(relateNumber, ORDER_NO)
  assert.equal(issueInput('ecpay').orderId, ORDER_NO)
  assert.equal(carrierNum, '')
})

test('ezPay allowance reuses the original invoice MerchantOrderNo and sends tax-inclusive lines', async () => {
  const allowanceId = toProviderAllowanceOrderId({
    provider: 'ezpay',
    orderNo: ORDER_NO,
    alreadyAllowed: 0,
    amount: 30,
  })
  assert.equal(
    allowanceId,
    toProviderAllowanceOrderId({
      provider: 'ezpay',
      orderNo: ORDER_NO,
      alreadyAllowed: 0,
      amount: 30,
    })
  )
  assert.notEqual(
    allowanceId,
    toProviderAllowanceOrderId({
      provider: 'ezpay',
      orderNo: ORDER_NO,
      alreadyAllowed: 10,
      amount: 20,
    })
  )
  assert.equal(allowanceId.length, 20)
  assert.match(allowanceId, /^[A-Za-z0-9_]+$/)

  let merchantOrderNo = ''
  let requestPath = ''
  let itemPrice = ''
  let itemAmount = ''
  let itemTaxAmount = ''
  let totalAmount = ''
  const provider = createEzpayProvider({
    merchantId: '123456789',
    hashKey: EZPAY_HASH_KEY,
    hashIV: HASH_IV,
    mode: 'TEST',
    fetch: async (url, init) => {
      requestPath = String(url)
      const body = init?.body as URLSearchParams
      const encrypted = body.get('PostData_')
      assert.ok(encrypted)
      const payload = new URLSearchParams(decryptPostData(encrypted, EZPAY_HASH_KEY, HASH_IV))
      merchantOrderNo = payload.get('MerchantOrderNo') ?? ''
      itemPrice = payload.get('ItemPrice') ?? ''
      itemAmount = payload.get('ItemAmt') ?? ''
      itemTaxAmount = payload.get('ItemTaxAmt') ?? ''
      totalAmount = payload.get('TotalAmt') ?? ''
      return new Response(
        JSON.stringify({
          Status: 'SUCCESS',
          Message: 'success',
          Result: JSON.stringify({ AllowanceNo: 'AL1234567890' }),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    },
  })

  await provider.allowance(
    buildAllowanceInput({
      provider: 'ezpay',
      invoiceNumber: 'AB12345678',
      allowanceId,
      originalOrderId: issueInput('ezpay').orderId,
      amount: 30,
      itemName: '電子發票回歸測試課程',
      buyerEmail: 'invoice-test@example.com',
    })
  )

  assert.equal(merchantOrderNo, issueInput('ezpay').orderId)
  assert.notEqual(merchantOrderNo, allowanceId)
  assert.equal(itemPrice, '30')
  assert.equal(itemAmount, '30')
  assert.equal(itemTaxAmount, '0')
  assert.equal(totalAmount, '30')
  assert.match(requestPath, /\/Api\/allowance_issue$/)
})

test('ezPay B2B allowance preserves the original tax-exclusive accounting', async () => {
  let itemPrice = ''
  let itemAmount = ''
  let itemTaxAmount = ''
  let totalAmount = ''
  const provider = createEzpayProvider({
    merchantId: '123456789',
    hashKey: EZPAY_HASH_KEY,
    hashIV: HASH_IV,
    mode: 'TEST',
    fetch: async (_url, init) => {
      const body = init?.body as URLSearchParams
      const encrypted = body.get('PostData_')
      assert.ok(encrypted)
      const payload = new URLSearchParams(decryptPostData(encrypted, EZPAY_HASH_KEY, HASH_IV))
      itemPrice = payload.get('ItemPrice') ?? ''
      itemAmount = payload.get('ItemAmt') ?? ''
      itemTaxAmount = payload.get('ItemTaxAmt') ?? ''
      totalAmount = payload.get('TotalAmt') ?? ''
      return new Response(
        JSON.stringify({
          Status: 'SUCCESS',
          Message: 'success',
          Result: JSON.stringify({ AllowanceNo: 'AL1234567890' }),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    },
  })

  await provider.allowance(
    buildAllowanceInput({
      provider: 'ezpay',
      invoiceNumber: 'AB12345678',
      allowanceId: 'AL123456789012345678',
      originalOrderId: issueInput('ezpay').orderId,
      amount: 30,
      itemName: '企業課程',
      buyerEmail: 'accounting@example.com',
      taxExclusive: true,
    })
  )

  assert.equal(itemPrice, '29')
  assert.equal(itemAmount, '29')
  assert.equal(itemTaxAmount, '1')
  assert.equal(totalAmount, '30')
})

test('ezPay item names are truncated to the official 30-character limit', () => {
  const input = buildIssueInput({
    orderNo: ORDER_NO,
    amount: 30,
    itemName: '長'.repeat(36),
    buyerEmail: 'invoice-test@example.com',
    preference: {
      invoiceType: 'PERSONAL',
      carrierType: 'member',
      carrierId: null,
      taxId: null,
      title: null,
      loveCode: null,
      address: null,
    },
    provider: 'ezpay',
  })
  assert.equal(input.items[0].description.length, 30)
})

test('ECPay void and allowance use the original invoice date', async () => {
  const payloads: Array<Record<string, unknown>> = []
  const provider = createEcpayProvider({
    merchantId: '2000132',
    hashKey: ECPAY_HASH_KEY,
    hashIV: HASH_IV,
    mode: 'TEST',
    fetch: async (url, init) => {
      const envelope = JSON.parse(String(init?.body)) as { Data: string }
      payloads.push(decryptData(envelope.Data, ECPAY_HASH_KEY, HASH_IV) as Record<string, unknown>)
      const isVoid = String(url).endsWith('/Invalid')
      return new Response(
        JSON.stringify({
          TransCode: 1,
          TransMsg: 'Success',
          Data: encryptData(
            isVoid
              ? { RtnCode: 1, RtnMsg: 'Success', InvoiceNo: 'AB12345678' }
              : {
                  RtnCode: 1,
                  RtnMsg: 'Success',
                  IA_Allow_No: '2026071512345678',
                  IA_Date: '2026-07-15 12:00:00',
                },
            ECPAY_HASH_KEY,
            HASH_IV
          ),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    },
  })
  const invoiceDate = new Date('2026-05-20T08:30:00+08:00')

  await provider.void({ invoiceNumber: 'AB12345678', reason: '訂單退款', date: invoiceDate })
  await provider.allowance(
    buildAllowanceInput({
      provider: 'ecpay',
      invoiceNumber: 'AB12345678',
      allowanceId: 'ALLOWANCE_TEST_1',
      originalOrderId: ORDER_NO,
      amount: 30,
      itemName: '電子發票回歸測試課程',
      invoiceDate,
    })
  )

  assert.equal(payloads[0].InvoiceDate, '2026-05-20')
  assert.equal(payloads[1].InvoiceDate, '2026-05-20')
})

test('ECPay online allowance callback CheckMacValue matches the official MD5 example', () => {
  const fields = {
    RtnCode: '1',
    RtnMsg: '',
    IA_Allow_No: '1909181313013546',
    IA_Invoice_No: 'UV11100019',
    IA_Date: '2019-09-18 13:13:23',
    IIS_Remain_Allowance_Amt: '0',
  }
  const checkMac = createEcpayAllowanceCheckMac(
    fields,
    'ejCk326UnaZWKisg',
    'q9jcZX8Ib9LM8wYk'
  )
  assert.equal(checkMac, '50A276E71DAE26343013958B405EEEA0')
  assert.equal(
    verifyEcpayAllowanceCheckMac(
      { ...fields, CheckMacValue: checkMac },
      'ejCk326UnaZWKisg',
      'q9jcZX8Ib9LM8wYk'
    ),
    true
  )
})

test('ECPay online allowance uses the official endpoint, invoice date, email and callback URL', async () => {
  let requestPath = ''
  let payload: Record<string, unknown> = {}
  const provider = createEcpayProvider({
    merchantId: '2000132',
    hashKey: ECPAY_HASH_KEY,
    hashIV: HASH_IV,
    mode: 'PRODUCTION',
    fetch: async (url, init) => {
      requestPath = String(url)
      const envelope = JSON.parse(String(init?.body)) as { Data: string }
      payload = decryptData(envelope.Data, ECPAY_HASH_KEY, HASH_IV) as Record<string, unknown>
      return new Response(
        JSON.stringify({
          TransCode: 1,
          TransMsg: 'Success',
          Data: encryptData(
            {
              RtnCode: 1,
              RtnMsg: 'Success',
              IA_Allow_No: '2026071512345678',
              IA_Invoice_No: 'AB12345678',
              IA_TempDate: '2026-07-15 12:00:00',
              IA_TempExpireDate: '2026-07-18 12:00:00',
              IA_Remain_Allowance_Amt: 0,
            },
            ECPAY_HASH_KEY,
            HASH_IV
          ),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    },
  })

  const result = await provider.allowanceOnline(
    buildAllowanceInput({
      provider: 'ecpay',
      invoiceNumber: 'AB12345678',
      allowanceId: 'ALLOWANCE_ONLINE_1',
      originalOrderId: ORDER_NO,
      amount: 30,
      itemName: '電子發票回歸測試課程',
      invoiceDate: new Date('2026-05-20T08:30:00+08:00'),
      buyerEmail: 'invoice-test@example.com',
    }),
    {
      notifyMail: 'invoice-test@example.com',
      customerName: '測試買受人',
      reason: '訂單退款',
      returnUrl: 'https://example.com/api/invoice/ecpay/allowance-notify',
    }
  )

  assert.match(requestPath, /\/B2CInvoice\/AllowanceByCollegiate$/)
  assert.equal(payload.InvoiceDate, '2026-05-20')
  assert.equal(payload.AllowanceNotify, 'E')
  assert.equal(payload.NotifyMail, 'invoice-test@example.com')
  assert.equal(payload.ReturnURL, 'https://example.com/api/invoice/ecpay/allowance-notify')
  assert.equal(payload.AllowanceAmount, 30)
  assert.equal(result.allowanceNumber, '2026071512345678')
  assert.equal(result.expiresAt.toISOString(), '2026-07-18T04:00:00.000Z')
})

test('ECPay allowance callback also accepts the SHA256 signature shown by the online API', () => {
  const fields = {
    RtnCode: '1',
    RtnMsg: 'Success',
    IA_Allow_No: '2026071512345678',
    IA_Invoice_No: 'AB12345678',
    IA_Date: '2026-07-15 12:00:00',
    IIS_Remain_Allowance_Amt: '0',
  }
  const checkMac = createEcpayAllowanceCheckMac(
    fields,
    ECPAY_HASH_KEY,
    HASH_IV,
    'sha256'
  )
  assert.equal(checkMac.length, 64)
  assert.equal(
    verifyEcpayAllowanceCheckMac(
      { ...fields, CheckMacValue: checkMac },
      ECPAY_HASH_KEY,
      HASH_IV
    ),
    true
  )
})

test('ezPay void reason is always within the 20-byte provider limit', () => {
  const reason = normalizeProviderVoidReason('ezpay', '這是一段過長的中文作廢原因')
  assert.ok(Buffer.byteLength(reason, 'utf8') <= 20)
  assert.equal(reason, '這是一段過長')
  assert.equal(normalizeProviderVoidReason('ecpay', 'A'.repeat(30)), 'A'.repeat(20))
})

test('production credential verification uses ezPay read-only search and treats NOT_FOUND as success', async () => {
  let requestPath = ''
  let searchPayload: URLSearchParams | null = null
  const provider = createEzpayProvider({
    merchantId: '123456789',
    hashKey: EZPAY_HASH_KEY,
    hashIV: HASH_IV,
    mode: 'PRODUCTION',
    fetch: async (url, init) => {
      requestPath = String(url)
      const body = init?.body as URLSearchParams
      const encrypted = body.get('PostData_')
      assert.ok(encrypted)
      searchPayload = new URLSearchParams(decryptPostData(encrypted, EZPAY_HASH_KEY, HASH_IV))
      return new Response(JSON.stringify({ Status: 'INV20006', Message: '查無發票資料' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })

  const result = await findProviderInvoiceByOrderId({
    client: provider,
    provider: 'ezpay',
    orderId: issueInput('ezpay').orderId,
    amount: 30,
  })

  assert.equal(result, null)
  assert.match(requestPath, /\/Api\/invoice_search$/)
  assert.equal(searchPayload!.get('SearchType'), '1')
  assert.equal(searchPayload!.get('MerchantOrderNo'), issueInput('ezpay').orderId)
  assert.equal(searchPayload!.get('TotalAmt'), '30')
})

test('retry preflight returns an existing ezPay invoice without issuing another invoice', async () => {
  const requestPaths: string[] = []
  const orderId = issueInput('ezpay').orderId
  const provider = createEzpayProvider({
    merchantId: '123456789',
    hashKey: EZPAY_HASH_KEY,
    hashIV: HASH_IV,
    mode: 'PRODUCTION',
    fetch: async (url) => {
      requestPaths.push(String(url))
      return new Response(
        JSON.stringify({
          Status: 'SUCCESS',
          Message: 'success',
          Result: JSON.stringify({
            InvoiceNumber: 'AB87654321',
            CreateTime: '2026-07-15 12:00:00',
            RandomNum: '5678',
            MerchantOrderNo: orderId,
            TotalAmt: 30,
            Amt: 29,
            TaxAmt: 1,
          }),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    },
  })

  const existing = await findProviderInvoiceByOrderId({
    client: provider,
    provider: 'ezpay',
    orderId,
    amount: 30,
  })

  assert.equal(existing?.invoiceNumber, 'AB87654321')
  assert.equal(existing?.amount.totalAmount, 30)
  assert.equal(requestPaths.length, 1)
  assert.match(requestPaths[0], /\/Api\/invoice_search$/)
})

test('production credential verification uses ECPay read-only query and keeps RelateNumber', async () => {
  let requestPath = ''
  let relateNumber = ''
  const provider = createEcpayProvider({
    merchantId: '2000132',
    hashKey: ECPAY_HASH_KEY,
    hashIV: HASH_IV,
    mode: 'PRODUCTION',
    fetch: async (url, init) => {
      requestPath = String(url)
      const envelope = JSON.parse(String(init?.body)) as { Data: string }
      const payload = decryptData(envelope.Data, ECPAY_HASH_KEY, HASH_IV) as {
        RelateNumber: string
      }
      relateNumber = payload.RelateNumber

      return new Response(
        JSON.stringify({
          TransCode: 1,
          TransMsg: 'Success',
          Data: encryptData(
            { RtnCode: 0, RtnMsg: '查無資料' },
            ECPAY_HASH_KEY,
            HASH_IV
          ),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    },
  })

  const result = await findProviderInvoiceByOrderId({
    client: provider,
    provider: 'ecpay',
    orderId: ORDER_NO,
    amount: 30,
  })

  assert.equal(result, null)
  assert.equal(relateNumber, ORDER_NO)
  assert.match(requestPath, /\/B2CInvoice\/GetIssue$/)
})

test('read-only verification never hides credential errors', async () => {
  const provider = createEzpayProvider({
    merchantId: '123456789',
    hashKey: EZPAY_HASH_KEY,
    hashIV: HASH_IV,
    mode: 'PRODUCTION',
    fetch: async () =>
      new Response(JSON.stringify({ Status: 'KEY10002', Message: '金鑰錯誤' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  })

  await assert.rejects(
    findProviderInvoiceByOrderId({
      client: provider,
      provider: 'ezpay',
      orderId: issueInput('ezpay').orderId,
      amount: 30,
    }),
    (error: unknown) =>
      isInvoiceError(error) && error.code === InvoiceErrorCode.AUTH && error.rawCode === 'KEY10002'
  )
})

test('credential validation checks provider-specific byte lengths', () => {
  assert.equal(
    getEInvoiceCredentialError({
      provider: 'ezpay',
      merchantId: '123456789',
      hashKey: EZPAY_HASH_KEY,
      hashIV: HASH_IV,
    }),
    null
  )
  assert.match(
    getEInvoiceCredentialError({
      provider: 'ezpay',
      merchantId: '123456789',
      hashKey: ECPAY_HASH_KEY,
      hashIV: HASH_IV,
    }) ?? '',
    /32 個 ASCII 字元/
  )
  assert.match(
    getEInvoiceCredentialError({
      provider: 'ecpay',
      merchantId: '2000132',
      hashKey: '測'.repeat(16),
      hashIV: HASH_IV,
    }) ?? '',
    /16 個 ASCII 字元/
  )
  assert.match(
    getEInvoiceCredentialError({
      provider: 'ecpay',
      merchantId: '12345678901',
      hashKey: ECPAY_HASH_KEY,
      hashIV: HASH_IV,
    }) ?? '',
    /10 個字元/
  )
})

test('invoice code verification only falls back for temporary provider outages', () => {
  assert.equal(
    isTransientInvoiceVerificationError(
      new InvoiceError('財政部驗證服務維護中', {
        provider: 'ecpay',
        code: InvoiceErrorCode.NETWORK,
        rawCode: '9000001',
      })
    ),
    true
  )
  assert.equal(
    isTransientInvoiceVerificationError(
      new InvoiceError('憑證錯誤', {
        provider: 'ecpay',
        code: InvoiceErrorCode.AUTH,
      })
    ),
    false
  )
  assert.equal(
    isTransientInvoiceVerificationError(
      new InvoiceError('載具格式錯誤', {
        provider: 'ecpay',
        code: InvoiceErrorCode.VALIDATION,
      })
    ),
    false
  )
})
