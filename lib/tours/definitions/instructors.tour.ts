// lib/tours/definitions/instructors.tour.ts
// 講師管理頁 /admin/instructors 的新手教學
// 設計來源:docs/onboarding-tour/instructors.md
import type { Tour } from '../types'

const instructorsTour: Tour = {
  id: 'instructors',
  name: '講師管理教學',
  intro:
    '這裡是你的團隊管理室 — 誰能教課、誰能管後台,你說了算。我帶你 35 秒學會找人、給權限、改角色。',
  steps: [
    {
      id: 'add',
      selector: 'instructors-add-btn',
      title: '先把人拉進來',
      body: '想找人一起經營?點這裡。用 email 搜既有用戶設成講師或管理員;查無此人也能直接新建。',
      placement: 'bottom',
    },
    {
      id: 'stats',
      selector: 'instructors-stats',
      title: '團隊有幾個人一眼看',
      body: '目前幾位管理員、幾位講師,這兩張卡直接告訴你。',
      placement: 'bottom',
    },
    {
      id: 'warnings',
      selector: 'instructors-warnings',
      title: '動手前先看這幾條',
      body: '改權限前掃一眼:至少留一位管理員、改不了自己、降成學員會拔掉權限,而且一改就生效。',
      placement: 'bottom',
    },
    {
      id: 'table',
      selector: 'instructors-table',
      title: '在這張表升降權限',
      body: '有權限的人都在這。要升降誰,點他那列「角色」欄的下拉換一下,會跳確認再生效。',
      placement: 'top',
    },
  ],
}

export default instructorsTour
