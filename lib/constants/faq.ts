// lib/constants/faq.ts
// 共用 FAQ 資料 — 供 faq-section.tsx 渲染及 JSON-LD 結構化資料使用

export interface FAQItem {
  question: string
  answer: string
}

export const courseFAQs: FAQItem[] = [
  {
    question: '適合完全沒有程式背景的人嗎？',
    answer:
      '當然！這堂課就是為了「想做產品但不想當工程師」的人設計的。我們不教你背語法，而是教你核心的概念與方法論，讓你具備與 AI 協作的能力。你負責出腦袋，AI 負責出體力。',
  },
  {
    question: '需要什麼設備才能上這堂課？',
    answer:
      '你需要一台 Mac 電腦（MacBook 或 iMac 皆可）。因為 iOS App 開發必須使用 Apple 的 Xcode 開發工具，而 Xcode 只能在 macOS 上執行，這是 Apple 官方的限制。如果你目前使用 Windows 或 Linux，建議先取得一台 Mac 再開始課程。',
  },
  {
    question: '遇到問題真的有人可以問嗎？',
    answer:
      '是的！我們有專屬的學員社群，講師與助教都會在裡面。遇到任何卡關點，截圖提問，我們會在第一時間為你解答。',
  },
  {
    question: '課程有觀看期限嗎？',
    answer:
      '買了就是你的。你可以無限次重複觀看，且課程內容會隨著技術演進定期更新，確保你掌握的是最新的開發技巧。',
  },
  {
    question: '我在香港／澳門，可以上這堂課嗎？',
    answer:
      '可以！課程內容完全適用於港澳學員。唯一需要注意的是，課程中使用的 Google AI Studio、Google Stitch 及 Gemini API 在香港／澳門地區目前無法直接使用，你需要準備一個 VPN 工具連線到支援地區（如日本或美國）後即可正常操作。除此之外，Xcode、App Store 上架等流程在港澳完全相同。我們也有提供 Discord 社群，方便港澳學員交流與提問。',
  },
  {
    question: '我沒有 Line，要怎麼加入學員社群？',
    answer:
      '除了 Line 群組外，我們也有提供 Discord 社群。港澳或海外學員可以直接加入 Discord，講師與助教同樣會在裡面回覆問題。購買課程後會收到 Discord 邀請連結。',
  },
]
