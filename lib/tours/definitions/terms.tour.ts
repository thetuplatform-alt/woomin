// lib/tours/definitions/terms.tour.ts
// 服務條款教學
import type { Tour } from '../types'

const termsTour: Tour = {
  id: 'terms',
  name: '服務條款教學',
  intro:
    '這頁負責你網站的服務條款。改完存檔,買家就能在 /terms 看到。我帶你 30 秒上手。',
  steps: [
    {
      id: 'header',
      selector: 'terms-header',
      title: '這頁在做什麼',
      body: '你在這裡寫的內容,會直接顯示在前台給買家看。',
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
      body: '服務條款內容在這裡編輯,支援 Markdown,排版隨你調。',
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

export default termsTour
