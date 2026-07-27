// lib/tours/definitions/orders.tour.ts
// 訂單管理頁 /admin/orders 的新手教學
// 設計來源:docs/onboarding-tour/orders.md

import type { Tour } from '../types'

const ordersTour: Tour = {
  id: 'orders',
  name: '訂單管理教學',
  intro:
    '這裡是你的交易總帳本 — 誰買了、付了沒、發票開了沒,全在這。我帶你 40 秒學會查單、退款、開發票。',
  steps: [
    {
      id: 'stats',
      selector: 'orders-stats',
      title: '先看大盤',
      body: '上面四張卡是你的成績單:總營收、已付款、待處理、已退款,開頁先掃一眼。',
      placement: 'bottom',
    },
    {
      id: 'filters',
      selector: 'orders-filters',
      title: '找特定一筆單',
      body: '要找某筆單?打訂單編號、Email 或課名就行。也能用下拉跟日期縮小範圍。',
      placement: 'bottom',
    },
    {
      id: 'table',
      selector: 'orders-table',
      title: '訂單都在這張表',
      body: '所有交易列在這,金額、狀態一眼掃過去。',
      placement: 'top',
    },
    {
      id: 'invoice',
      selector: 'orders-invoice-column',
      title: '發票開了沒看這欄',
      body: '這欄是發票狀態,待開立還是已開立一看就懂,別跟左邊訂單狀態搞混。',
      placement: 'bottom',
    },
    {
      id: 'detail',
      selector: 'orders-table',
      title: '退款開票進這裡做',
      body: '要退款或開發票?點每列最右的眼睛進單頁,按鈕都在裡面。',
      placement: 'top',
    },
  ],
}

export default ordersTour
