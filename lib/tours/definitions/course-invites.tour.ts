// lib/tours/definitions/course-invites.tour.ts
// 邀請教學
// 設計來源:docs/onboarding-tour/05-course-invites.md

import type { Tour } from '../types'

const courseInvitesTour: Tour = {
  id: 'course-invites',
  name: '邀請教學',
  intro:
    '這頁是你發免費課程入場券的地方:產一條連結,複製貼給對方,他點了就直接有課,免付錢。30 秒帶你走一遍。',
  steps: [
    {
      id: 'create-invite',
      selector: 'invite-create-button',
      title: '先按「建立」產一條',
      body: '上面三格全留空,直接按『建立』,就有一條誰都能用的連結。',
      placement: 'left',
    },
    {
      id: 'copy-invite',
      selector: 'invite-create-button',
      title: '建好馬上複製,只給看一次',
      body: '按『複製邀請網址』貼給對方就行。離開這頁就看不到了,現在一定要複製!',
      placement: 'left',
    },
    {
      id: 'invite-records',
      selector: 'invite-records-table',
      title: '發過的全在這查、想停在這停',
      body: '發過的連結都在這。綠色『可使用』就是還有效,要停掉哪條按右邊『停用』。',
      placement: 'top',
    },
  ],
}

export default courseInvitesTour
