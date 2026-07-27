// lib/tours/definitions/analytics.tour.ts
// 銷售分析頁 /admin/analytics 的新手教學
// 設計來源:docs/onboarding-tour/analytics.md
import type { Tour } from '../types'

const analyticsTour: Tour = {
  id: 'analytics',
  name: '銷售分析教學',
  intro:
    '這頁是你的賺錢儀表板 — 賺了多少、這個月有沒有成長、哪堂課最會賣,一眼看完。我帶你 35 秒看懂。',
  steps: [
    {
      id: 'revenue-stats',
      selector: 'analytics-revenue-stats',
      title: '先看四個關鍵數字',
      body: '總共賺多少、這個月賺多少、賣了幾筆、平均一單多少。本月那張會顯示跟上月比的成長率。',
      placement: 'bottom',
    },
    {
      id: 'sales-chart',
      selector: 'analytics-sales-chart',
      title: '每天賣多少看這張',
      body: '近 30 天每天的營收和訂單數。哪天衝高、哪天掉下來,一看就知道。',
      placement: 'top',
    },
    {
      id: 'month-comparison',
      selector: 'analytics-month-comparison',
      title: '本月 vs 上月,一眼比較',
      body: '左邊本月、右邊上月並排比。成長率變紅只是比上月低,不是壞掉,別緊張。',
      placement: 'right',
    },
    {
      id: 'top-courses',
      selector: 'analytics-top-courses',
      title: '哪堂課最會賣',
      body: '賣最好的前 5 名排在這。點最右邊箭頭,直接跳去那堂課。',
      placement: 'top',
    },
  ],
}

export default analyticsTour
