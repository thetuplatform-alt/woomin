// lib/tours/definitions/course-new.tour.ts
// 新增課程教學
// 設計來源:docs/onboarding-tour/02-course-new.md

import type { Tour } from '../types'

const courseNewTour: Tour = {
  id: 'course-new',
  name: '新增課程教學',
  intro:
    '這頁先把一門課最關鍵的資訊建起來,封面、大綱、促銷之後在編輯頁再補。大概一分鐘填完,我帶你走必填欄位跟兩個最容易踩雷的地方。副標題和描述非必填,可以先跳過。',
  steps: [
    {
      id: 'course-title',
      selector: 'course-title',
      title: '先取個課名',
      body: '先打課名,例如『Claude AI 工作流實戰班』。必填。',
      placement: 'right',
    },
    {
      id: 'course-slug',
      selector: 'course-slug',
      title: '課程網址',
      body: '網址會自動帶。純中文課名帶不出來,就自己打英文,例如 python-101。',
      placement: 'right',
    },
    {
      id: 'course-price',
      selector: 'course-price',
      title: '設定價格',
      body: '填原價就好。填 0 就是免費課,前台會變『免費報名』。',
      placement: 'right',
    },
    {
      id: 'course-status',
      selector: 'course-status',
      title: '記得改成上線',
      body: '預設是草稿,只有你看得到。要對外賣,記得改成『已發佈』。',
      placement: 'right',
    },
    {
      id: 'course-submit',
      selector: 'course-submit',
      title: '按下建立課程',
      body: '按下去就建好,自動跳到編輯頁補封面跟大綱。建立中別連點。',
      placement: 'top',
    },
  ],
}

export default courseNewTour
