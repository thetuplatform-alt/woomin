// lib/tours/definitions/course-comments.tour.ts
// 留言管理教學
// 設計來源:docs/onboarding-tour/08-course-comments.md

import type { Tour } from '../types'

const courseCommentsTour: Tour = {
  id: 'course-comments',
  name: '留言管理教學',
  intro:
    '這頁是你跟學員留言的對話台:左邊挑單元、中間看留言、按回覆就能公開回或私下寄信。30 秒帶你走一遍。',
  steps: [
    {
      id: 'comment-lesson-list',
      selector: 'comment-lesson-list',
      title: '先從左邊挑單元',
      body: '留言分單元放。先在左邊點一個單元,中間才會出現留言。',
      placement: 'right',
    },
    {
      id: 'comment-unread-badge',
      selector: 'comment-unread-badge',
      title: '紅點 = 有人剛留言',
      body: '紅色數字是還沒看的留言。點進去就自動算已讀。',
      placement: 'right',
    },
    {
      id: 'comment-detail-list',
      selector: 'comment-detail-list',
      title: '中間看完整留言',
      body: '這裡是該單元所有留言,內容、時間、誰留的都在。',
      placement: 'bottom',
    },
    {
      id: 'comment-real-identity',
      selector: 'comment-real-identity',
      title: '匿名留言你看得到本名',
      body: '學員勾匿名,前台只寫「學員」,但這行會給你他的真名跟信箱。',
      placement: 'bottom',
    },
    {
      id: 'comment-reply-button',
      selector: 'comment-reply-button',
      title: '按回覆:公開回或私下寄信',
      body: '按回覆寫內容。預設只寄 email 給他;想全班看到,要自己勾「發送留言」。至少勾一個才送得出。',
      placement: 'left',
    },
    {
      id: 'comment-delete-button',
      selector: 'comment-delete-button',
      title: '刪除是軟刪除,救不回來',
      body: '刪掉後前台看不到,但沒有還原鍵,誤刪要找工程師。已刪的不能再回。',
      placement: 'left',
    },
  ],
}

export default courseCommentsTour
