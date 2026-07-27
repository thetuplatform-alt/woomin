// lib/tours/definitions/payments.tour.ts
// 金流收款教學
import type { Tour } from '../types'

const paymentsTour: Tour = {
  id: 'payments',
  name: '金流收款教學',
  intro:
    '收學員的錢,就在這頁設定。我帶你 35 秒看懂:選哪家收款、要不要開發票,兩件事分開設,不會搞混。',
  steps: [
    {
      id: 'collection-tab',
      selector: 'payments-tab-collection',
      title: '先選怎麼收款',
      body: '這塊是收款設定。先選一家金流:SHOPLINE、Stripe 或 PAYUNi,三擇一。',
      placement: 'bottom',
    },
    {
      id: 'collection-credentials',
      selector: 'payments-tab-collection',
      title: '填好憑證、測一下',
      body: '選好後填商店代號、金鑰,底部有「測試連線」可先驗對不對。',
      placement: 'bottom',
    },
    {
      id: 'einvoice-tab',
      selector: 'payments-tab-einvoice',
      title: '要開發票?切到這裡',
      body: '想開統一發票?切到這分頁。收款和發票分開設,互不影響。',
      placement: 'bottom',
    },
    {
      id: 'einvoice-enable',
      selector: 'payments-einvoice-enable',
      title: '打開開關才會出現設定',
      body: '先打開這個開關,下面才會跳出供應商和憑證欄位。注意:要有統編才能開發票。',
      placement: 'top',
    },
  ],
}

export default paymentsTour
