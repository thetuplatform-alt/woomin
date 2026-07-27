import assert from 'node:assert/strict'
import { createEcpayProvider } from '@paid-tw/einvoice-ecpay'
import { buildAllowanceInput, buildIssueInput } from '@/lib/invoice/issue'

// 綠界官方電子發票 Stage 共用測試商店；可用環境變數改成自己的測試商店。
const merchantId = process.env.ECPAY_STAGE_MERCHANT_ID || '2000132'
const hashKey = process.env.ECPAY_STAGE_HASH_KEY || 'ejCk326UnaZWKisg'
const hashIV = process.env.ECPAY_STAGE_HASH_IV || 'q9jcZX8Ib9LM8wYk'

const provider = createEcpayProvider({
  merchantId,
  hashKey,
  hashIV,
  mode: 'TEST',
  timeoutMs: 15_000,
})

function issueInput(orderId: string) {
  return buildIssueInput({
    orderNo: orderId,
    amount: 30,
    itemName: 'Realms電子發票API驗收',
    buyerName: '測試買受人',
    buyerEmail: 'invoice-stage@example.com',
    preference: {
      invoiceType: 'PERSONAL',
      carrierType: 'member',
      carrierId: null,
      taxId: null,
      title: null,
      loveCode: null,
      address: null,
    },
    provider: 'ecpay',
  })
}

function taiwanDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

async function main() {
  const nonce = `${Date.now()}`.slice(-11)

  const voidOrderId = `RV${nonce}V`
  const issuedForVoid = await provider.issue(issueInput(voidOrderId))
  assert.match(issuedForVoid.invoiceNumber, /^[A-Z]{2}\d{8}$/)
  assert.equal(issuedForVoid.totalAmount, 30)

  const queriedForVoid = await provider.query({ orderId: voidOrderId })
  assert.equal(queriedForVoid.invoiceNumber, issuedForVoid.invoiceNumber)
  assert.equal(queriedForVoid.amount.totalAmount, 30)

  await provider.void({
    invoiceNumber: issuedForVoid.invoiceNumber,
    date: issuedForVoid.invoiceDate,
    reason: 'API驗收作廢',
  })
  const queriedVoided = await provider.query({ orderId: voidOrderId })
  assert.equal(queriedVoided.status, 'VOIDED')

  const allowanceOrderId = `RV${nonce}A`
  const issuedForAllowance = await provider.issue(issueInput(allowanceOrderId))
  assert.match(issuedForAllowance.invoiceNumber, /^[A-Z]{2}\d{8}$/)

  const allowance = await provider.allowance(
    buildAllowanceInput({
      provider: 'ecpay',
      invoiceNumber: issuedForAllowance.invoiceNumber,
      allowanceId: `AL${nonce}`,
      originalOrderId: allowanceOrderId,
      amount: 30,
      itemName: 'Realms電子發票API驗收',
      invoiceDate: issuedForAllowance.invoiceDate,
      buyerEmail: 'invoice-stage@example.com',
    })
  )
  assert.match(allowance.allowanceNumber, /^\d{16}$/)
  assert.equal(allowance.totalAmount, 30)

  const allowanceDetails = await provider.getAllowanceList({
    allowanceNumber: allowance.allowanceNumber,
  })
  const detail = allowanceDetails.find(
    (row) => row.allowanceNumber === allowance.allowanceNumber && !row.voided
  )
  assert.ok(detail)
  assert.equal(detail.invoiceNumber, issuedForAllowance.invoiceNumber)
  assert.equal(detail.totalAmount, 30)
  assert.equal(taiwanDate(detail.invoiceIssueDate), taiwanDate(issuedForAllowance.invoiceDate))

  console.log('ECPay Stage PASS')
  console.log(`issue-query-void: ${issuedForVoid.invoiceNumber}`)
  console.log(`issue-allowance-query: ${issuedForAllowance.invoiceNumber}/${allowance.allowanceNumber}`)
}

main().catch((error) => {
  console.error('ECPay Stage FAIL:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
