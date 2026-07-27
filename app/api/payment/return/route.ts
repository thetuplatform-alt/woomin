// app/api/payment/return/route.ts
// PAYUNi 隞狡餈?頝唾? API
// PAYUNi 隞狡摰?敺?雿輻??POST ?唳迨蝡舫?嚗圾撖??????/憭望??

import { NextRequest, NextResponse } from 'next/server'
import { getGatewayByType } from '@/lib/payment/gateway-factory'
import { PayUniGateway } from '@/lib/payment/payuni-gateway'
import { resolveAppUrl } from '@/lib/app-url'

export async function POST(request: NextRequest) {
  try {
    const baseUrl = await resolveAppUrl({ request })
    const formData = await request.formData()
    const encryptInfo = formData.get('EncryptInfo')?.toString()
    const hashInfo = formData.get('HashInfo')?.toString()

    if (!encryptInfo || !hashInfo) {
      return NextResponse.redirect(new URL('/checkout/failed', baseUrl), 303)
    }

    // ?? PAYUNi gateway 撖虫?
    let gateway: PayUniGateway
    try {
      const gw = await getGatewayByType('payuni')
      if (!(gw instanceof PayUniGateway)) {
        throw new Error('Gateway type mismatch')
      }
      gateway = gw
    } catch {
      return NextResponse.redirect(new URL('/checkout/failed', baseUrl), 303)
    }

    const service = gateway.getService()
    const decrypted = service.verifyAndDecrypt(encryptInfo, hashInfo)

    const orderNumber = decrypted.MerTradeNo as string
    const status = decrypted.Status as string

    if (!orderNumber) {
      throw new Error('Missing order number')
    }

    if (status === 'SUCCESS') {
      return NextResponse.redirect(
        new URL(`/checkout/success?orderNo=${orderNumber}`, baseUrl),
        303
      )
    }

    return NextResponse.redirect(
      new URL(`/checkout/failed?orderNo=${orderNumber}`, baseUrl),
      303
    )
  } catch (error) {
    console.error('[PAYUNi Return] ???航炊:', error)
    const baseUrl = await resolveAppUrl({ request })
    return NextResponse.redirect(new URL('/checkout/failed', baseUrl), 303)
  }
}
