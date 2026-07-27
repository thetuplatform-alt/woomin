// lib/tours/definitions/coupons.tour.ts
// 優惠券管理頁 /admin/coupons 的新手教學
// 設計來源:docs/onboarding-tour/coupons.md
import type { Tour } from '../types'

const couponsTour: Tour = {
  id: 'coupons',
  name: '優惠券教學',
  intro:
    '想做檔期促銷、發折扣碼給學員?這頁就是你的優惠券總管。我帶你 40 秒看懂怎麼開券、複製碼、跟一鍵開關。',
  steps: [
    {
      id: 'new-coupon',
      selector: 'coupons-new-btn',
      title: '開一張新券',
      body: '要做促銷?點這裡開新券。下一頁設折多少、限哪些課、能用多久。',
      placement: 'bottom',
    },
    {
      id: 'table',
      selector: 'coupons-table',
      title: '你的券都在這張表',
      body: '所有優惠券列在這。折多少、用幾次、還能不能用,一眼掃過去。',
      placement: 'top',
    },
    {
      id: 'copy-code',
      selector: 'coupons-code-col',
      title: '點代碼就複製',
      body: '點任一張券的代碼,直接複製。貼到貼文或私訊發給學員就行。',
      placement: 'bottom',
    },
    {
      id: 'status',
      selector: 'coupons-status-col',
      title: '狀態看券能不能用',
      body: '這欄是系統判定。就算開著,過期或還沒到生效時間,學員一樣用不了。',
      placement: 'bottom',
    },
    {
      id: 'actions',
      selector: 'coupons-actions-col',
      title: '一鍵開關不用進編輯',
      body: '右邊開關能立刻停掉一張券,不用進去改;鉛筆才是進去編輯。',
      placement: 'left',
    },
  ],
}

export default couponsTour
