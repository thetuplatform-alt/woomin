// lib/tours/definitions/course-list.tour.ts
// 課程列表頁 /admin/courses 的新手教學
// 設計來源:docs/onboarding-tour/01-course-list.md

import type { Tour } from '../types'

const courseListTour: Tour = {
  id: 'course-list',
  name: '課程列表快速導覽',
  intro:
    '這是你的課程總管中心 — 哪些是草稿、哪些已上架,一眼看清楚。我帶你 40 秒學會開課、找課、改課。',
  steps: [
    {
      id: 'new-course',
      selector: 'new-course-btn',
      title: '從這裡開一門新課',
      body: '想開新課?點這裡。新課先存成草稿,學生還看不到,慢慢改沒關係。',
      placement: 'bottom',
    },
    {
      id: 'table',
      selector: 'course-table',
      title: '你的課都在這張表',
      body: '所有課列在這。封面、價格、賣法一眼掃過去。黃色「全講師共管」代表還沒指定講師。',
      placement: 'top',
    },
    {
      id: 'status',
      selector: 'status-column',
      title: '「狀態」決定學生看不看得到',
      body: '草稿=只有你看得到,已發佈=學生才買得到。卡在草稿,做再多都不會上架。',
      placement: 'bottom',
    },
    {
      id: 'visibility',
      selector: 'visibility-column',
      title: '「可見性」決定怎麼賣',
      body: '這欄是賣法,跟上面是兩回事。公開=逛得到,連結=只能用網址買,邀請=要邀請碼。',
      placement: 'bottom',
    },
    {
      id: 'find-and-edit',
      selector: 'course-filters',
      title: '找課 + 進去改',
      body: '課多了,打字搜或用下拉篩;點整行就能進去改。最右邊紅色垃圾桶是刪除 — 刪了救不回,手別抖。',
      placement: 'bottom',
    },
  ],
}

export default courseListTour
