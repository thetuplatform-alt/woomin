// lib/tours/definitions/course-assignments.tour.ts
// 作業/測驗教學
// 設計來源:docs/onboarding-tour/07-course-assignments.md

import type { Tour } from '../types'

const courseAssignmentsTour: Tour = {
  id: 'course-assignments',
  name: '作業/測驗教學',
  intro:
    '這頁是你改作業、看測驗成績的地方。哪份還沒改、哪場考得怎樣,一眼就懂。我帶你走一遍批改流程。',
  steps: [
    {
      id: 'assignments-summary',
      selector: 'assignments-summary',
      title: '先看整課規模',
      body: '這課有幾份作業、幾場測驗、收到幾份提交,這裡看完。下面那條是附件空間,快滿會變黃。',
      placement: 'bottom',
    },
    {
      id: 'lessons-table',
      selector: 'lessons-table',
      title: '在這找要改的對象',
      body: '有作業或測驗的單元都列在這。看『提交/作答』就知道有沒有人交。0 份有時是學員還在打草稿,不是沒人寫。',
      placement: 'top',
    },
    {
      id: 'grade-assignment-btn',
      selector: 'grade-assignment-btn',
      title: '點這顆開始批改',
      body: '有人交才會出現這顆,點進去一份份改(測驗點旁邊『查看作答結果』)。⚠️ 每份都要選一個結果,評語會直接 Email 給學員。',
      placement: 'left',
    },
    {
      id: 'submission-stats',
      selector: 'submission-stats',
      title: '先挑待批改的下手',
      body: '打開批改後,黃色『待批改』那格就是還沒處理的,先從這幾份開始最快。上面也能只篩待批改來看。',
      placement: 'bottom',
    },
  ],
}

export default courseAssignmentsTour
