// lib/tours/definitions/bundles.tour.ts
// 課程組合包教學
import type { Tour } from '../types'

const bundlesTour: Tour = {
  id: 'bundles',
  name: '課程組合包教學',
  intro: '想把好幾門課打包成一個商品一次賣?這頁就是。我帶你 35 秒學會建組合、看懂狀態、進去改。',
  steps: [
    {
      id: 'new-bundle',
      selector: 'bundles-new-btn',
      title: '從這裡打包一個新組合',
      body: '想把多門課綁成一個商品賣?點這裡。先存成草稿,慢慢挑課、定價。',
      placement: 'bottom',
    },
    {
      id: 'table',
      selector: 'bundles-table',
      title: '你的組合都在這張表',
      body: '所有組合列在這。內含幾門課、賣多少、什麼狀態,一眼掃過去。',
      placement: 'top',
    },
    {
      id: 'status',
      selector: 'bundles-status-column',
      title: '「狀態」決定學生買不買得到',
      body: '草稿=只有你看得到,已發佈=學生才買得到,已停用=下架但資料還在。',
      placement: 'bottom',
    },
    {
      id: 'actions',
      selector: 'bundles-actions-column',
      title: '改內容、預覽、複製連結都在這',
      body: '鉛筆進去改名稱、價格跟內含課程;另外可預覽銷售頁、複製連結拿去推。',
      placement: 'left',
    },
  ],
}

export default bundlesTour
