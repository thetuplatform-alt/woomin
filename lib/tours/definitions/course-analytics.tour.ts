// lib/tours/definitions/course-analytics.tour.ts
// 分析教學
// 設計來源:docs/onboarding-tour/11-course-analytics.md

import type { Tour } from '../types'

const courseAnalyticsTour: Tour = {
  id: 'course-analytics',
  name: '分析教學',
  intro:
    '這頁讓你一眼看懂這門課賣得好不好、學生學得順不順。我帶你 30 秒掃重點。',
  steps: [
    {
      id: 'overview-cards',
      selector: 'analytics-overview-cards',
      title: '先看上方四張數字卡',
      body: '這排是體檢報告:賣幾人、賺多少、學到哪、看多久。掃完就有大局。',
      placement: 'bottom',
    },
    {
      id: 'card-revenue',
      selector: 'analytics-card-revenue',
      title: '銷售額會幫你比月成長',
      body: '下面那行是本月。綠字代表比上月成長,紅字代表掉了。',
      placement: 'bottom',
    },
    {
      id: 'card-progress',
      selector: 'analytics-card-progress',
      title: '完課率,別跟「上完的人」搞混',
      body: '大數字是全班平均進度,下面那行才是真正上完的人佔多少。',
      placement: 'bottom',
    },
    {
      id: 'progress-distribution',
      selector: 'analytics-progress-distribution',
      title: '進度分佈,一眼看出卡點',
      body: '紅到綠的長條,哪根長,學生就卡在那個進度、流失最多。',
      placement: 'left',
    },
    {
      id: 'student-list',
      selector: 'analytics-student-list',
      title: '學員列表,逐一看每個人',
      body: '這裡列出每位學生:何時買、付多少、學到哪、上次何時看。學生多就點下方按鈕展開全部。',
      placement: 'top',
    },
  ],
}

export default courseAnalyticsTour
