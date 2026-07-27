// lib/tours/definitions/privacy.tour.ts
// 隱私權政策教學
import type { Tour } from '../types'

const privacyTour: Tour = {
  id: 'privacy',
  name: '隱私權政策教學',
  intro:
    '這頁負責你網站的隱私權政策。改完存檔,訪客就能在 /privacy 看到。我帶你 30 秒上手。',
  steps: [
    {
      id: 'header',
      selector: 'privacy-header',
      title: '這頁在做什麼',
      body: '你在這裡寫的內容,會直接顯示在前台給訪客看。',
      placement: 'bottom',
    },
    {
      id: 'template',
      selector: 'legal-template-btn',
      title: '沒靈感?一鍵套範本',
      body: '不知道怎麼寫?點這裡套通用範本,自動帶入你的站名。',
      placement: 'bottom',
    },
    {
      id: 'editor',
      selector: 'legal-editor',
      title: '在這裡自由編輯',
      body: '隱私權內容在這裡編輯,支援 Markdown,排版隨你調。',
      placement: 'top',
    },
    {
      id: 'save',
      selector: 'legal-editor',
      title: '記得按儲存才生效',
      body: '改完一定要存檔。底部會跳出儲存列,按下去才會發佈。',
      placement: 'top',
    },
  ],
}

export default privacyTour
