// lib/tours/definitions/dashboard.tour.ts
// 儀表板教學
import type { Tour } from '../types'

const dashboardTour: Tour = {
  id: 'dashboard',
  name: '儀表板教學',
  intro:
    '這是你的營運總覽 — 登入後第一眼就看到平台現在的狀況。我帶你 40 秒看懂這頁怎麼讀、要從哪裡開始做事。',
  steps: [
    {
      id: 'stats',
      selector: 'dashboard-stats',
      title: '六個關鍵數字一眼看完',
      body: '營收、訂單、學員、完課率全在這。每天進來先掃一眼這排卡片就對了。',
      placement: 'bottom',
    },
    {
      id: 'charts',
      selector: 'dashboard-charts',
      title: '趨勢圖看生意走向',
      body: '銷售、付款方式、用戶成長都畫成圖。每張右上角可換時間範圍。',
      placement: 'top',
    },
    {
      id: 'recent-orders',
      selector: 'dashboard-recent-orders',
      title: '最新成交都在這',
      body: '誰剛買了什麼、付了沒,這裡即時顯示。點「查看全部」看完整訂單。',
      placement: 'left',
    },
  ],
}

export default dashboardTour
