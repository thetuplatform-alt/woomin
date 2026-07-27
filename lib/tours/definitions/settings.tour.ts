// lib/tours/definitions/settings.tour.ts
// 一般設定教學
import type { Tour } from '../types'

const settingsTour: Tour = {
  id: 'settings',
  name: '一般設定教學',
  intro:
    '這是平台的設定總開關 — 站名、Email、AI 全在這。左邊分類點一下就跳過去,我帶你 50 秒認完路。',
  steps: [
    {
      id: 'section-nav',
      selector: 'settings-section-nav',
      title: '左邊分類,點了就跳',
      body: '設定很多,別硬捲。左邊 7 個分類點一下,直接跳到那一區。',
      placement: 'right',
    },
    {
      id: 'site-name',
      selector: 'settings-site-name',
      title: '先把站名設對',
      body: '站名會出現在分頁標題、寄件人名字。第一件事就先改成你的品牌。',
      placement: 'bottom',
    },
    {
      id: 'media-status',
      selector: 'settings-media-status',
      title: '影音與圖檔怎麼存',
      body: '這塊顯示圖檔現在存哪(本地或 S3),由部署決定、不能在這切。下面才是影片設定。',
      placement: 'top',
    },
    {
      id: 'email-section',
      selector: 'settings-email-section',
      title: 'Email 要選對供應商',
      body: '要寄購買通知、密碼信,先在這選 Zeabur Email / Resend / SMTP 再填金鑰。沒設就不會寄信。',
      placement: 'top',
    },
    {
      id: 'ai-section',
      selector: 'settings-ai-section',
      title: '想用 AI 輔助先填這裡',
      body: '填 Gemini API Key,就能用 AI 生講義、轉課程內容。沒填這些 AI 功能會是關的。',
      placement: 'top',
    },
    {
      id: 'save-reminder',
      title: '改完記得按儲存',
      body: '每一區各自儲存,不是一鍵存全部。改了東西,底部會浮出儲存鈕,按下去才算數。',
      placement: 'center',
    },
  ],
}

export default settingsTour
