// lib/tours/definitions/course-info.tour.ts
// 課程資訊頁 /admin/courses/[id]/info 的新手教學
// 設計來源:docs/onboarding-tour/03-course-info.md

import type { Tour } from '../types'

const courseInfoTour: Tour = {
  id: 'course-info',
  name: '課程資訊教學',
  intro:
    '這頁是課程上線前的「身分證」——填好名字網址、決定要不要上架、設好防翻拍跟購買後的歡迎信。我帶你走最關鍵的幾步,大概一分鐘,想自己看隨時可以關掉。',
  steps: [
    {
      id: 'basic-info-slug',
      selector: 'basic-info-slug',
      title: '先填標題和網址',
      body: '標題必填。下面的網址(Slug)只能用小寫英數和連字號,像 react-basics,上線後很難改,想清楚再填。',
      placement: 'right',
    },
    {
      id: 'cover-image',
      selector: 'cover-image',
      title: '上傳一張封面',
      body: '傳一張封面,10MB 以內,會出現在課程列表。沒另外設社群圖時,分享出去也用這張。',
      placement: 'top',
    },
    {
      id: 'instructor-access',
      selector: 'instructor-access-badge',
      title: '設定誰能管這堂課',
      body: '沒勾任何人時,所有講師都能管(會顯示「全部講師」)。想限制就勾出特定的人。',
      placement: 'left',
    },
    {
      id: 'status',
      selector: 'status-selects',
      title: '上架要選「已發佈」',
      body: '上面「狀態」選已發佈才會真的上線,留在草稿不會公開。下面「販售可見性」是另一回事,管的是誰看得到購買按鈕。',
      placement: 'top',
    },
    {
      id: 'video-watermark',
      selector: 'watermark-toggle',
      title: '想防翻拍就開浮水印',
      body: '打開這個開關,影片上會浮現會移動的學員 Email 浮水印。透明度、移動方式都能調,右邊有即時預覽。',
      placement: 'top',
    },
    {
      id: 'welcome-email',
      selector: 'welcome-email-link',
      title: '設購買後的歡迎信',
      body: '點「歡迎信設定」會跳到另一頁,寫學員買完自動收到的信。記住:那頁的寄送開關預設是關的,沒開再會編都不會寄。',
      placement: 'top',
    },
    {
      id: 'sticky-save-bar',
      selector: 'sticky-save-bar',
      title: '改完記得按儲存',
      body: '有任何改動,下方就會冒出儲存列。按下去才會存檔,填錯的欄位會在下方標紅。改完別忘了存。',
      placement: 'top',
    },
  ],
}

export default courseInfoTour
