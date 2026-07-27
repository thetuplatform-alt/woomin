import { NextRequest, NextResponse } from 'next/server'
import { getEInvoiceConfig, isEInvoiceConfigured } from '@/lib/invoice/config'
import {
  confirmEcpayOnlineAllowance,
  verifyEcpayAllowanceCheckMac,
  type EcpayAllowanceCallback,
} from '@/lib/invoice/ecpay-online-allowance'

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const input: EcpayAllowanceCallback = {
      RtnCode: String(form.get('RtnCode') ?? ''),
      RtnMsg: String(form.get('RtnMsg') ?? ''),
      IA_Allow_No: String(form.get('IA_Allow_No') ?? ''),
      IA_Invoice_No: String(form.get('IA_Invoice_No') ?? ''),
      IA_Date: String(form.get('IA_Date') ?? ''),
      IIS_Remain_Allowance_Amt: String(form.get('IIS_Remain_Allowance_Amt') ?? ''),
      CheckMacValue: String(form.get('CheckMacValue') ?? ''),
    }

    const config = await getEInvoiceConfig()
    if (config.provider !== 'ecpay' || !isEInvoiceConfigured(config)) {
      return new NextResponse('0|NOT_CONFIGURED', { status: 503 })
    }
    if (!verifyEcpayAllowanceCheckMac(input, config.hashKey, config.hashIV)) {
      console.error('[ECPay Allowance] CheckMacValue 驗證失敗')
      return new NextResponse('0|INVALID_CHECKMAC', { status: 400 })
    }

    const result = await confirmEcpayOnlineAllowance(input)
    if (!result.success) {
      console.error('[ECPay Allowance] 確認回傳處理失敗:', result.error)
      return new NextResponse('0|PROCESSING_FAILED', { status: 500 })
    }
    return new NextResponse('1|OK', { status: 200 })
  } catch (error) {
    console.error('[ECPay Allowance] callback 例外:', error)
    return new NextResponse('0|INTERNAL_ERROR', { status: 500 })
  }
}
