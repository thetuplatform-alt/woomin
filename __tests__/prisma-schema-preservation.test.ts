// __tests__/prisma-schema-preservation.test.ts
//
// 對應 openspec/changes/merge-crm-into-newsletter-automation
//
// 目的：v1.8.0 官方合併時，prisma/schema.prisma 是雙方都會改動的高風險檔案
// （官方新增 model / User 新欄位，本地 Newsletter 系統也在同一份檔案）。
// 這份測試直接讀原始 schema 文字＋migrations 目錄，鎖住合併結果：
// 1. 舊 CRM model 已退場，不再留在 schema.prisma。
// 2. Newsletter 相關 model（NewsletterCampaign / NewsletterRecipient /
//    NewsletterTemplate / NewsletterLink / NewsletterAlert）
// 3. NewsletterAutomation 相關 model 已存在。
// 4. User 的 Email 同意／退訂／退信狀態欄位
// 5. Order／CouponRedemption 的行銷歸因欄位（UTM＋電子報／coupon 兌換來源）
// 6. 既有 migration 檔案保留，並新增 CRM 移除 migration。
//
// 不用內省 API（introspect）連線真實資料庫：這裡要驗證的是「schema 原始檔
// 與 migration 檔案」本身有沒有在合併時被弄丟，屬靜態文字層級的斷言，
// 連線資料庫反而多一層不必要的依賴（ponytail：能用標準庫/簡單方式就不裝更
// 重的機制）。

import fs from 'node:fs'
import path from 'node:path'

const SCHEMA_PATH = path.join(process.cwd(), 'prisma', 'schema.prisma')
const MIGRATIONS_DIR = path.join(process.cwd(), 'prisma', 'migrations')

const schema = fs.readFileSync(SCHEMA_PATH, 'utf8')

function modelBlock(modelName: string): string {
  const match = schema.match(
    new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`, 'm')
  )
  if (!match) {
    throw new Error(`schema.prisma 找不到 model ${modelName}`)
  }
  return match[0]
}

describe('Prisma schema 保留驗證：Newsletter 與自動化流程 schema 正確', () => {
  describe('舊 CRM model 已移除', () => {
    it.each([
      'CrmSequence',
      'CrmSequenceStep',
      'CrmEnrollment',
      'CrmEmailDelivery',
      'CrmEmailOpen',
      'CrmEmailClick',
    ])('model %s 不再存在於 schema.prisma', (modelName) => {
      expect(schema).not.toMatch(new RegExp(`^model ${modelName} \\{`, 'm'))
    })

    it('CrmEmailDeliveryStatus enum 不再存在於 schema.prisma', () => {
      expect(schema).not.toMatch(/^enum CrmEmailDeliveryStatus \{/m)
    })
  })

  describe('Newsletter model 存在', () => {
    it.each([
      'NewsletterCampaign',
      'NewsletterRecipient',
      'NewsletterTemplate',
      'NewsletterLink',
      'NewsletterAlert',
    ])('model %s 仍存在於 schema.prisma', (modelName) => {
      expect(schema).toMatch(new RegExp(`^model ${modelName} \\{`, 'm'))
    })
  })

  describe('NewsletterAutomation model 存在', () => {
    it.each([
      'NewsletterAutomation',
      'NewsletterAutomationStep',
      'NewsletterAutomationEnrollment',
      'NewsletterAutomationDelivery',
      'NewsletterAutomationOpen',
      'NewsletterAutomationClick',
    ])('model %s 仍存在於 schema.prisma', (modelName) => {
      expect(schema).toMatch(new RegExp(`^model ${modelName} \\{`, 'm'))
    })
  })

  describe('User 的 Email 同意／退訂／退信狀態欄位保留', () => {
    const userBlock = modelBlock('User')

    it.each([
      'marketingConsent',
      'marketingConsentAt',
      'marketingConsentSource',
      'marketingConsentIp',
      'generalEmailConsent',
      'generalEmailConsentAt',
      'unsubscribedAt',
      'emailBounceState',
      'emailBounceCount',
    ])('User.%s 欄位仍存在', (fieldName) => {
      expect(userBlock).toMatch(new RegExp(`\\n\\s*${fieldName}\\s`))
    })
  })

  describe('Order 的行銷歸因欄位保留（UTM ＋ 電子報歸因）', () => {
    const orderBlock = modelBlock('Order')

    it.each([
      'utmSource',
      'utmMedium',
      'utmCampaign',
      'utmContent',
      'utmTerm',
      'newsletterCampaignId',
      'newsletterLinkId',
    ])('Order.%s 欄位仍存在', (fieldName) => {
      expect(orderBlock).toMatch(new RegExp(`\\n\\s*${fieldName}\\s`))
    })
  })

  describe('Coupon 兌換的電子報歸因欄位保留', () => {
    const redemptionBlock = modelBlock('CouponRedemption')

    it('CouponRedemption.campaignId（電子報活動兌換歸因）欄位仍存在', () => {
      expect(redemptionBlock).toMatch(/\n\s*campaignId\s/)
    })
  })

  describe('既有 migration 檔案沒有被刪除', () => {
    const migrationDirs = fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)

    it.each([
      '20260630101203_crm_email_sequences',
      '20260630230000_add_crm_delivery_processing_status',
    ])('CRM migration %s 仍存在', (migrationName) => {
      expect(migrationDirs).toContain(migrationName)
    })

    it('CRM 移除 migration 已存在', () => {
      expect(migrationDirs).toContain('20260723132530_remove_crm_sequences')
    })

    it.each([
      '20260629160000_add_newsletter_system',
      '20260629173000_harden_newsletter_delivery',
    ])('Newsletter migration %s 仍存在', (migrationName) => {
      expect(migrationDirs).toContain(migrationName)
    })

    it('每個 migration 目錄都有非空的 migration.sql（沒有被清空成空殼目錄）', () => {
      for (const dir of migrationDirs) {
        const sqlPath = path.join(MIGRATIONS_DIR, dir, 'migration.sql')
        expect(fs.existsSync(sqlPath)).toBe(true)
        expect(fs.statSync(sqlPath).size).toBeGreaterThan(0)
      }
    })
  })
})
