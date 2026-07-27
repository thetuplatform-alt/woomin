// lib/tours/definitions/subscriptions.tour.ts
// 訂閱管理頁面 /admin/subscriptions 的新手教學。

import type { Tour } from '../types'

const subscriptionsTour: Tour = {
  id: 'subscriptions',
  name: '訂閱管理教學',
  intro:
    '這裡管理所有課程訂閱：看誰在訂、收多少、誰扣款失敗，也能代學員取消。花一分鐘帶你認識。',
  steps: [
    {
      id: 'stats',
      selector: 'subscription-stats',
      title: '先看整體健康度',
      body: '活躍訂閱數、每月經常性收入（MRR）、扣款失敗數一眼掌握。MRR 會把年繳自動折算成每月。',
      placement: 'bottom',
    },
    {
      id: 'table',
      selector: 'subscriptions-table',
      title: '逐筆訂閱在這裡',
      body: '可依狀態、課程篩選。紅色的「⚠」標記代表這筆需要留意（例如已終止但未繳滿），點右側眼睛看詳情。',
      placement: 'top',
    },
    {
      id: 'detail',
      title: '在詳情頁能做什麼',
      body: '點進單筆訂閱可看方案快照、每期扣款訂單、扣款同意紀錄；也能代學員取消、對 PAYUNi 失敗期重新扣款、修改未來期款的發票資訊。',
      placement: 'bottom',
    },
  ],
}

export default subscriptionsTour
