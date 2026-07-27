// lib/tours/definitions/course-pricing.tour.ts
// 定價與促銷頁面 /admin/courses/[id]/pricing 的新手教學
// 設計來源:docs/onboarding-tour/04-course-pricing.md

import type { Tour } from '../types'

const coursePricingTour: Tour = {
  id: 'course-pricing',
  name: '定價與促銷教學',
  intro:
    '這頁決定課程賣多少錢、學員能看多久。我帶你把最關鍵的幾格設好就能上架,大概一分鐘。',
  steps: [
    {
      id: 'original-price',
      selector: 'pricing-original-price',
      title: '先填原價',
      body: '先打入課程價格。想做免費課就填 0。',
      placement: 'bottom',
    },
    {
      id: 'sale-block',
      selector: 'pricing-sale-block',
      title: '要打折再設促銷',
      body: '想打折就填促銷價,記得設『截止日期』。長期降價就開『永久優惠』。',
      placement: 'left',
    },
    {
      id: 'access-type',
      selector: 'access-type-select',
      title: '決定能看多久',
      body: '選永久、期限或固定到期日。注意:改了只影響之後買的人。',
      placement: 'bottom',
    },
    {
      id: 'save',
      selector: 'sticky-save-bar',
      title: '按下儲存才算數',
      body: '有改動底部就會冒出這條,按它才會存。沒按就離開會被攔下。',
      placement: 'top',
    },
  ],
}

export default coursePricingTour
