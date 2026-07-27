// lib/tours/definitions/messages.tour.ts
// 老師私訊（全站收件匣）頁 /admin/messages 的新手教學
// 設計來源:docs/onboarding-tour/messages.md
// 註:本頁與 /admin/courses/[id]/messages 共用 PrivateMessageInbox 元件,
//     沿用該元件既有的 inbox-* data-tour 錨點,不另加屬性。

import type { Tour } from '../types'

const messagesTour: Tour = {
  id: 'messages',
  name: '老師私訊教學',
  intro:
    '這裡是你所有課程學員私訊的總收件匣——提問全集中在這。左邊挑人、右邊回覆,30 秒帶你跑一遍。',
  steps: [
    {
      id: 'inbox-unread-badge',
      selector: 'inbox-unread-badge',
      title: '未讀一眼看光',
      body: '紅色數字 = 全站還沒回的學員人數,先看這。',
      placement: 'right',
    },
    {
      id: 'inbox-filter-toggle',
      selector: 'inbox-filter-toggle',
      title: '只看待回覆',
      body: '按『待回覆』,只留還沒回的,忙時超省事。',
      placement: 'right',
    },
    {
      id: 'inbox-conversation-list',
      selector: 'inbox-conversation-list',
      title: '點誰就看誰',
      body: '每筆都標了是哪門課。點一位,右邊跳出對話,紅點自動清掉。',
      placement: 'right',
    },
    {
      id: 'inbox-thread',
      selector: 'inbox-thread',
      title: '對話來回都在這',
      body: '你的回覆在右、學員在左,往上滑看全部。',
      placement: 'left',
    },
    {
      id: 'inbox-reply-box',
      selector: 'inbox-reply-box',
      title: '打字回覆送出',
      body: '打字按紙飛機或 ⌘/Ctrl+Enter 送出,學員會收到 Email;要附檔點旁邊迴紋針。',
      placement: 'top',
    },
  ],
}

export default messagesTour
