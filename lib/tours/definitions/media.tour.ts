// lib/tours/definitions/media.tour.ts
// 媒體中心 /admin/media 的新手教學
// 設計來源:docs/onboarding-tour/media.md
import type { Tour } from '../types'

const mediaTour: Tour = {
  id: 'media',
  name: '媒體中心教學',
  intro:
    '這裡是你所有上傳檔案的家 — 影片、圖片、附件全在這。我帶你 40 秒看懂怎麼分類、怎麼進去上傳。',
  steps: [
    {
      id: 'youtube-notice',
      selector: 'media-youtube-notice',
      title: '先搞懂影片怎麼算',
      body: '重點先講:這裡只收上傳到平台的影片。用 YouTube 的課,貼網址就好,不會出現在這。',
      placement: 'bottom',
    },
    {
      id: 'stats',
      selector: 'media-stats',
      title: '一眼看用了多少',
      body: '影片、圖片、附件各有幾個、佔多少空間,這排卡片一次看完。',
      placement: 'bottom',
    },
    {
      id: 'videos',
      selector: 'media-videos-card',
      title: '影片進這裡上傳',
      body: '平台託管的影片放這。點「查看全部」進影片庫,就能拖檔上傳,大檔會自動分塊。',
      placement: 'top',
    },
    {
      id: 'images',
      selector: 'media-images-card',
      title: '圖片進這裡上傳',
      body: '課程封面、素材圖放這。進圖片庫可一次拖很多張,平行上傳。',
      placement: 'top',
    },
    {
      id: 'attachments',
      selector: 'media-attachments-card',
      title: '文件附件進這裡',
      body: 'PDF、作業附件放這。上傳時還能設「允許下載」跟 PDF 浮水印防盜課。',
      placement: 'top',
    },
  ],
}

export default mediaTour
