// lib/tours/definitions/course-content.tour.ts
// 課程內容編輯器 /admin/courses/[id]/content 的新手教學
// 設計來源:docs/onboarding-tour/06-course-content.md

import type { Tour } from '../types'

const courseContentTour: Tour = {
  id: 'course-content',
  name: '課程內容編輯器教學',
  intro:
    '這裡是你排課的地方——左邊大綱、中間放內容、右邊調設定。我帶你走一輪,大概一分鐘就會自己鋪課了。',
  steps: [
    {
      id: 'editor-layout',
      selector: 'editor-layout',
      title: '三欄一眼看懂',
      body: '左邊排大綱、中間編內容、右邊調設定。三邊一起看,不用跳來跳去。',
      placement: 'bottom',
    },
    {
      id: 'add-chapter',
      selector: 'add-chapter-btn',
      title: '先開一個章節',
      body: '課程從章節開始。點這顆會先請你開一個章節,像「基礎篇」,打標題就好。',
      placement: 'top',
    },
    {
      id: 'outline-lesson',
      selector: 'outline-lesson-item',
      title: '在章節下加單元、點開來編',
      body: '章節右邊「⋯」就能加單元。建好後點單元名稱,中間就打開它。',
      placement: 'right',
    },
    {
      id: 'video-provider',
      selector: 'video-provider-cards',
      title: '放影片:YouTube 最快、Cloudflare 可重用',
      body: '趕上線選 YouTube,貼網址按套用;要保護或多堂共用就選 Cloudflare 上傳。',
      placement: 'bottom',
    },
    {
      id: 'lesson-content',
      selector: 'lesson-content-editor',
      title: '寫講義,或讓 AI 先打草稿',
      body: '這裡寫文字講義。懶得從零開始,可按「AI 生成講義」先擬一版。',
      placement: 'top',
    },
    {
      id: 'lesson-settings',
      selector: 'lesson-settings-tab',
      title: '右邊調標題、試閱與上線',
      body: '改名稱、開免費試閱、設「即將上線」都在這。試閱也能在左邊單元「⋯」快速切。',
      placement: 'left',
    },
    {
      id: 'save-lesson',
      selector: 'save-lesson-btn',
      title: '最後一定要按「儲存變更」',
      body: '影片、講義、標題改完都要按這顆才會存。沒存就切去別堂,改的會不見喔。',
      placement: 'bottom',
    },
  ],
}

export default courseContentTour
