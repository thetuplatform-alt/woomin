// __tests__/site-settings-analytics-validation.test.ts
//
// 對應 fix-critical-xss-and-assignment-upload change 的 task 1.1：
// lib/validations/settings.ts 的 gaId／metaPixelId 目前只驗證長度，
// 沒有限制格式，app/layout.tsx 直接把值字串插值進 <script> 內容
// （gtag('config', '${analytics.gaId}')）與 <img src>，
// 管理員填入惡意字串即可造成全站 stored XSS。
// 改為在驗證層限制為官方合法格式（GA4：G- 開頭英數字；
// Meta Pixel：純數字），格式不符直接拒絕儲存。

import { siteSettingsSchema } from '@/lib/validations/settings'

describe('站點設定：GA ID／Meta Pixel ID 格式驗證', () => {
  describe('gaId', () => {
    it('接受合法 GA4 測量 ID（G- 開頭英數字）', () => {
      expect(siteSettingsSchema.shape.gaId.safeParse('G-ABC123XYZ').success).toBe(true)
    })

    it('允許空字串／null／undefined（選填欄位）', () => {
      expect(siteSettingsSchema.shape.gaId.safeParse('').success).toBe(true)
      expect(siteSettingsSchema.shape.gaId.safeParse(null).success).toBe(true)
      expect(siteSettingsSchema.shape.gaId.safeParse(undefined).success).toBe(true)
    })

    it.each([
      ["'); alert(document.cookie); //"],
      ['<script>alert(1)</script>'],
      ['UA-12345-1'],
    ])('拒絕惡意或不合法格式的 GA ID：%s', (value) => {
      expect(siteSettingsSchema.shape.gaId.safeParse(value).success).toBe(false)
    })
  })

  describe('metaPixelId', () => {
    it('接受合法純數字 Meta Pixel ID', () => {
      expect(siteSettingsSchema.shape.metaPixelId.safeParse('1234567890123').success).toBe(true)
    })

    it('允許空字串／null／undefined（選填欄位）', () => {
      expect(siteSettingsSchema.shape.metaPixelId.safeParse('').success).toBe(true)
      expect(siteSettingsSchema.shape.metaPixelId.safeParse(null).success).toBe(true)
      expect(siteSettingsSchema.shape.metaPixelId.safeParse(undefined).success).toBe(true)
    })

    it.each([
      ["'); alert(document.cookie); //"],
      ['123abc456'],
      ['<script>alert(1)</script>'],
    ])('拒絕含非數字字元的 Meta Pixel ID：%s', (value) => {
      expect(siteSettingsSchema.shape.metaPixelId.safeParse(value).success).toBe(false)
    })
  })
})
