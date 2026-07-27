// lib/tours/definitions/course-reviews.tour.ts
// 評價管理教學
// 設計來源:docs/onboarding-tour/10-course-reviews.md

import type { Tour } from '../types'

const courseReviewsTour: Tour = {
  id: 'course-reviews',
  name: '評價管理教學',
  intro:
    '這頁是你管課程口碑的地方:看學員打幾分、回覆他們、把不當評價藏起來,還能決定要不要在銷售頁秀評價。30 秒帶你走一遍。',
  steps: [
    {
      id: 'enable-reviews-switch',
      selector: 'enable-reviews-switch',
      title: '先決定要不要收評價',
      body: '這開關控制學員能不能寫評價。關掉,舊評價還在、入口全消失。',
      placement: 'left',
    },
    {
      id: 'show-reviews-switch',
      selector: 'show-reviews-switch',
      title: '再決定銷售頁要不要秀',
      body: '打開,評價就出現在銷售頁當好評背書。只在上面開關開著時才看得到。',
      placement: 'left',
    },
    {
      id: 'review-stats',
      selector: 'review-stats',
      title: '口碑數字一眼看完',
      body: '平均幾分、幾則、各星等多少人都在這。藏起來的也算進去喔。',
      placement: 'bottom',
    },
    {
      id: 'review-visibility-toggle',
      selector: 'review-visibility-toggle',
      title: '不想被看到的,藏起來',
      body: '遇到垃圾或不實評價,點眼睛讓學員看不到。是隱藏不是刪除,後台還留著。',
      placement: 'left',
    },
    {
      id: 'review-report-badge',
      selector: 'review-report-badge',
      title: '有人檢舉?點紅標看原因',
      body: '評價被檢舉會冒紅標,點開看原因。真有問題,用旁邊眼睛藏掉就行。',
      placement: 'bottom',
    },
    {
      id: 'review-reply-box',
      selector: 'review-reply-box',
      title: '親自回覆,展現專業',
      body: '在這寫回覆,送出後會即時出現在銷售頁,大家都看得到。打錯可再用鉛筆改、垃圾桶刪。',
      placement: 'top',
    },
  ],
}

export default courseReviewsTour
