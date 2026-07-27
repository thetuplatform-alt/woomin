// lib/tours/definitions/comments.tour.ts
// 課程留言教學(全課程總表 /admin/comments)
import type { Tour } from '../types'

const commentsTour: Tour = {
  id: 'comments',
  name: '課程留言教學',
  intro:
    '這頁把你所有課程的學員留言攤成一張表,不用一門一門點。25 秒帶你學會篩選、回覆、刪除。',
  steps: [
    {
      id: 'table',
      selector: 'comments-table',
      title: '所有留言都在這張表',
      body: '你各課的留言全列在這。課程、單元、誰留的、內容,一眼掃完。',
      placement: 'top',
    },
    {
      id: 'course-filter',
      selector: 'comments-course-filter',
      title: '只想看某一門課?',
      body: '課太多看不完?從這裡挑一門課,表格就只留那門的留言。',
      placement: 'bottom',
    },
    {
      id: 'reply',
      selector: 'comments-table',
      title: '回覆:公開回或私下寄信',
      body: '每列右邊有「回覆」。預設只寄 email 給他;想全班看到要自己勾「發送留言」。',
      placement: 'top',
    },
    {
      id: 'delete',
      selector: 'comments-table',
      title: '刪除是軟刪除,救不回來',
      body: '紅色「刪除」會把留言下架,前台看不到。但沒有還原鍵,誤刪要找工程師。',
      placement: 'top',
    },
  ],
}

export default commentsTour
