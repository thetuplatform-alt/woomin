import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PayUniService,
  parsePayUniApiEnvelope,
} from '../lib/payment/payuni-crypto'
import {
  addBillingInterval,
  addBillingIntervals,
  parseTaiwanBillingDate,
} from '../lib/subscription/calendar'
import { fingerprintPayUniPeriodEvent } from '../lib/payment/webhook-events'
import {
  getPaidFirstPayUniPeriod,
  parsePayUniPeriodQuery,
  parsePayUniQueryBillingDate,
} from '../lib/subscription/payuni-query'

const HASH_KEY = '12345678901234567890123456789012'
const HASH_IV = '1234567890123456'

function payuniService() {
  return new PayUniService({
    merchantId: 'TESTMERCHANT',
    hashKey: HASH_KEY,
    hashIV: HASH_IV,
    apiUrl: 'https://example.invalid/api',
  })
}

test('PAYUNi form data always includes merchant and Unix timestamp inside signed payload', () => {
  const service = payuniService()
  const before = Math.floor(Date.now() / 1000)
  const form = service.createFormData({
    MerTradeNo: 'SUB20260715abcdef123456',
    ProdDesc: '訂閱測試課程',
    PayerEmail: 'buyer@example.com',
    PeriodAmt: 990,
  })
  const payload = new URLSearchParams(service.decrypt(form.EncryptInfo))

  assert.equal(payload.get('MerID'), 'TESTMERCHANT')
  assert.equal(payload.get('ProdDesc'), '訂閱測試課程')
  assert.equal(payload.get('PayerEmail'), 'buyer@example.com')
  assert.equal(payload.get('PeriodAmt'), '990')
  assert.ok(Number(payload.get('Timestamp')) >= before)
})

test('PAYUNi backend API parses official JSON encrypted envelope', async () => {
  const service = payuniService()
  const encrypted = service.encrypt('Status=SUCCESS&Message=OK&PeriodTradeNo=P123')
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        EncryptInfo: encrypted.encryptInfo,
        HashInfo: encrypted.hashInfo,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  try {
    const result = await service.requestApi('https://example.invalid/mdf', {
      PeriodTradeNo: 'P123',
      ReviseTradeStatus: 'end',
    })
    assert.equal(result.Status, 'SUCCESS')
    assert.equal(result.PeriodTradeNo, 'P123')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('PAYUNi top-level error envelope is preserved instead of treated as encrypted form data', () => {
  assert.deepEqual(
    parsePayUniApiEnvelope(
      JSON.stringify({ Status: 'ERROR', Message: 'merchant rejected' })
    ),
    { kind: 'error', status: 'ERROR', message: 'merchant rejected' }
  )
  assert.throws(() => parsePayUniApiEnvelope('not-json'), /有效 JSON/)
})

test('billing calendar handles month-end anchors and leap years', () => {
  const jan31 = new Date('2024-01-31T12:30:00.000Z')
  assert.equal(
    addBillingInterval(jan31, 'MONTH').toISOString(),
    '2024-02-29T12:30:00.000Z'
  )
  assert.equal(
    addBillingIntervals(jan31, 'MONTH', 2).toISOString(),
    '2024-03-31T12:30:00.000Z'
  )
  assert.equal(
    addBillingInterval(new Date('2024-02-29T00:00:00.000Z'), 'YEAR').toISOString(),
    '2025-02-28T00:00:00.000Z'
  )
})

test('Taiwan billing date parser validates real calendar dates and timezone', () => {
  assert.equal(
    parseTaiwanBillingDate('2026-07-15')?.toISOString(),
    '2026-07-14T16:00:00.000Z'
  )
  assert.equal(parseTaiwanBillingDate('2026-02-30'), null)
})

test('PAYUNi webhook fingerprint is deterministic but separates retry attempts', () => {
  const event = {
    PeriodOrderNo: 'SUB20260715abcdef_2',
    Status: 'SUCCESS',
    TradeNo: 'T123',
    AuthDay: '20260715',
    AuthTime: '120000',
    ThisPeriod: '2',
    AuthAmt: '990',
  }
  assert.equal(
    fingerprintPayUniPeriodEvent(event),
    fingerprintPayUniPeriodEvent({ ...event })
  )
  assert.notEqual(
    fingerprintPayUniPeriodEvent(event),
    fingerprintPayUniPeriodEvent({ ...event, TradeNo: 'T124' })
  )
})

test('PAYUNi period query parser validates and normalizes official Result fields', () => {
  const query = parsePayUniPeriodQuery({
    Status: 'SUCCESS',
    Message: '查詢明細資料成功',
    MerID: 'TESTMERCHANT',
    MerTradeNo: 'SUB20260715abcdef',
    PeriodTradeNo: 'PERIOD123',
    PeriodType: 'month',
    TotalTimes: '2',
    AlreadyTimes: '1',
    'Result[0][Period]': '1',
    'Result[0][ExpAuthDT]': '2026-07-15 11:29:28',
    'Result[0][TradeNo]': 'TRADE123',
    'Result[0][SubPeriodNo]': 'SUB20260715abcdef_1',
    'Result[0][Amt]': '990',
    'Result[0][AuthCode]': '000000',
    'Result[0][StatusDesc]': '授權完成',
    'Result[0][UpdateTime]': '2026-07-15 11:29:28',
    'Result[1][Period]': '2',
    'Result[1][ExpAuthDT]': '2026-08-15 00:00:00',
    'Result[1][TradeNo]': '-',
    'Result[1][SubPeriodNo]': '',
    'Result[1][Amt]': '990',
    'Result[1][AuthCode]': '',
    'Result[1][StatusDesc]': '排程中',
    'Result[1][UpdateTime]': '2026-07-15 11:29:28',
  })

  assert.equal(query.items.length, 2)
  assert.equal(query.alreadyTimes, 1)
  assert.equal(
    getPaidFirstPayUniPeriod(query, 'SUB20260715abcdef')?.tradeNo,
    'TRADE123'
  )
  assert.equal(
    parsePayUniQueryBillingDate(query.items[1]!.expectedAuthorizationAt)?.toISOString(),
    '2026-08-14T16:00:00.000Z'
  )
})

test('PAYUNi period query does not infer first payment from AlreadyTimes alone', () => {
  const query = parsePayUniPeriodQuery({
    Status: 'SUCCESS',
    Message: 'OK',
    MerID: 'TESTMERCHANT',
    MerTradeNo: 'SUB20260715abcdef',
    PeriodTradeNo: 'PERIOD123',
    PeriodType: 'month',
    TotalTimes: '1',
    AlreadyTimes: '1',
    'Result[0][Period]': '1',
    'Result[0][ExpAuthDT]': '2026-07-15 11:29:28',
    'Result[0][TradeNo]': '-',
    'Result[0][SubPeriodNo]': '',
    'Result[0][Amt]': '990',
    'Result[0][AuthCode]': '',
    'Result[0][StatusDesc]': '授權失敗',
    'Result[0][UpdateTime]': '2026-07-15 11:29:28',
  })
  assert.equal(getPaidFirstPayUniPeriod(query, 'SUB20260715abcdef'), null)
})
