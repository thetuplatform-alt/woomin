// lib/tours/definitions/users.tour.ts
// 學員管理教學
import type { Tour } from '../types'

const usersTour: Tour = {
  id: 'users',
  name: '學員管理教學',
  intro:
    '這裡是你的學員名冊 — 誰買了哪門課一目了然。我帶你 45 秒學會找學員、手動送課,還有怎麼把整批名單一次搬進來。',
  steps: [
    {
      id: 'add-user',
      selector: 'users-add-btn',
      title: '手動加一個人',
      body: '想單獨加一位學員或講師?點這裡,還能順手把課直接送給他。',
      placement: 'bottom',
    },
    {
      id: 'import',
      selector: 'users-import-btn',
      title: '一次搬一整批',
      body: '從別的平台搬家?上傳一份 CSV,整批學員連同課程一次匯入。記得先選課程。',
      placement: 'bottom',
    },
    {
      id: 'export',
      selector: 'users-export-btn',
      title: '匯出存檔',
      body: '想備份名單?照你現在的篩選,一鍵匯出成 CSV。',
      placement: 'bottom',
    },
    {
      id: 'filters',
      selector: 'users-filters',
      title: '找特定學員',
      body: '人多了就用這裡:打姓名或 Email 搜尋,也能只看買了某門課的人。',
      placement: 'bottom',
    },
    {
      id: 'table',
      selector: 'users-table',
      title: '名單都在這',
      body: '所有學員列在這:買了幾門課、何時註冊都看得到。點右側可調整他持有的課程。',
      placement: 'top',
    },
  ],
}

export default usersTour
