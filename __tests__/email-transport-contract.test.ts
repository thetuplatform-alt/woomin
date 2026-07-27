// __tests__/email-transport-contract.test.ts
//
// 對應 openspec/changes/upgrade-v1-8-0-preserve-payment-and-crm-fixes
// tasks.md 任務 6.2（原分支 2 / v1.7.3 遺留任務 2.1）
// 依 openspec/specs/course-email-sequences/spec.md
// 「Requirement: Email Sending with Existing Transport」補測：
// 驗證 ToSend 保留、與 Newsletter 需要的 headers / replyTo / 冪等
// （idempotencyKey）/ batch 與逐封 fallback，能否同時成立。
//
// 既有 __tests__/email-transport.test.ts 只驗證了「provider 選擇邏輯」
// （設定值/環境變數 → 選對 transport）與 ToSend 最基本的送信路徑，
// 沒有斷言 headers / replyTo / idempotencyKey 是否真的被轉送到底層
// provider —— 這正是本檔要補的「transport contract」缺口。
//
// lib/email-transport.ts 內的 4 個 transport class 均未 export，
// 只能透過 getEmailTransport(providerOverride) 取得實例後測試其
// 對外行為，這與既有 email-transport.test.ts 的取得方式一致。

const mockFindUnique = jest.fn()
const mockFindMany = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    siteSetting: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
    },
  },
}))

const mockEmailsSend = jest.fn()
const mockBatchSend = jest.fn()
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockEmailsSend },
    batch: { send: mockBatchSend },
  })),
}))

const mockSendMail = jest.fn()
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}))

import {
  clearTransportCache,
  getEmailTransport,
  getEmailTransportSnapshot,
  getEmailTransportFromSnapshot,
} from '@/lib/email-transport'

const CONTRACT_PAYLOAD = {
  from: 'Aiver <fish@aiver.me>',
  to: ['student@example.com'],
  subject: '購課成功通知',
  html: '<p>Hello</p>',
  text: 'Hello',
  headers: { 'List-Unsubscribe': '<https://example.com/unsubscribe>' },
  replyTo: 'support@aiver.me',
  idempotencyKey: 'newsletter:campaign_1:recipient_1',
}

describe('Email transport contract：headers / replyTo / 冪等 / batch-fallback', () => {
  beforeEach(() => {
    clearTransportCache()
    mockFindUnique.mockReset()
    mockFindMany.mockReset()
    mockFindUnique.mockResolvedValue(null)
    mockFindMany.mockResolvedValue([])
    delete process.env.TOSEND_API_KEY
    delete process.env.TOSEND_API_BASE_URL
    delete process.env.EMAIL_PROVIDER
    delete process.env.ZSEND_API_KEY
    delete process.env.RESEND_API_KEY
    delete process.env.SMTP_HOST
    global.fetch = jest.fn()
  })

  describe('Resend（Newsletter batch 寄送的唯一 provider）', () => {
    beforeEach(() => {
      process.env.RESEND_API_KEY = 'resend_test_key'
    })

    it('send() 轉送 headers / replyTo，並把 idempotencyKey 當 SDK 選項傳入', async () => {
      mockEmailsSend.mockResolvedValue({ data: { id: 'msg_1' }, error: null })

      const transport = await getEmailTransport('resend')
      await transport?.send(CONTRACT_PAYLOAD)

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: CONTRACT_PAYLOAD.headers,
          replyTo: CONTRACT_PAYLOAD.replyTo,
        }),
        { idempotencyKey: CONTRACT_PAYLOAD.idempotencyKey }
      )
    })

    it('sendBatch() 對每封信都轉送 headers / replyTo，並把 idempotencyKey 當 batch 選項傳入（Newsletter 批次寄送依賴此行為）', async () => {
      mockBatchSend.mockResolvedValue({
        data: { data: [{ id: 'msg_1' }, { id: 'msg_2' }] },
        error: null,
      })

      const transport = await getEmailTransport('resend')
      const results = await transport?.sendBatch?.(
        [CONTRACT_PAYLOAD, { ...CONTRACT_PAYLOAD, to: ['other@example.com'] }],
        { idempotencyKey: 'newsletter:campaign_1:batch:abc' }
      )

      expect(mockBatchSend).toHaveBeenCalledWith(
        [
          expect.objectContaining({ headers: CONTRACT_PAYLOAD.headers, replyTo: CONTRACT_PAYLOAD.replyTo }),
          expect.objectContaining({ headers: CONTRACT_PAYLOAD.headers, replyTo: CONTRACT_PAYLOAD.replyTo }),
        ],
        { idempotencyKey: 'newsletter:campaign_1:batch:abc' }
      )
      expect(results).toEqual([{ messageId: 'msg_1' }, { messageId: 'msg_2' }])
    })
  })

  describe('Zeabur Email（ZSend）', () => {
    beforeEach(() => {
      process.env.ZSEND_API_KEY = 'zsend_test_key'
    })

    it('send() 轉送 headers / replyTo，並把 idempotencyKey 轉成 Idempotency-Key HTTP header', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'zsend_msg_1' }),
      })

      const transport = await getEmailTransport('zsend')
      await transport?.send(CONTRACT_PAYLOAD)

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
      expect(url).toBe('https://api.zeabur.com/api/v1/zsend/emails')
      expect(init.headers).toEqual(
        expect.objectContaining({
          'Idempotency-Key': CONTRACT_PAYLOAD.idempotencyKey,
          'List-Unsubscribe': CONTRACT_PAYLOAD.headers['List-Unsubscribe'],
        })
      )
      const body = JSON.parse(init.body)
      expect(body.replyTo).toBe(CONTRACT_PAYLOAD.replyTo)
      expect(body.headers).toEqual(
        expect.objectContaining({ 'List-Unsubscribe': CONTRACT_PAYLOAD.headers['List-Unsubscribe'] })
      )
    })

    it('沒有實作 sendBatch：Newsletter 的 batch/逐封 fallback 邏輯必須退回逐封寄送', async () => {
      const transport = await getEmailTransport('zsend')
      expect(typeof transport?.sendBatch).not.toBe('function')
    })
  })

  describe('SMTP（Nodemailer）', () => {
    beforeEach(() => {
      process.env.SMTP_HOST = 'smtp.example.com'
    })

    it('send() 轉送 headers / replyTo 給 nodemailer，並把 idempotencyKey 轉成 Resend-Idempotency-Key header', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'smtp_msg_1' })

      const transport = await getEmailTransport('smtp')
      await transport?.send(CONTRACT_PAYLOAD)

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: CONTRACT_PAYLOAD.replyTo,
          headers: expect.objectContaining({
            'Resend-Idempotency-Key': CONTRACT_PAYLOAD.idempotencyKey,
            'List-Unsubscribe': CONTRACT_PAYLOAD.headers['List-Unsubscribe'],
          }),
        })
      )
    })

    it('沒有實作 sendBatch：Newsletter 的 batch/逐封 fallback 邏輯必須退回逐封寄送', async () => {
      const transport = await getEmailTransport('smtp')
      expect(typeof transport?.sendBatch).not.toBe('function')
    })
  })

  describe('ToSend（已知缺口：目前不轉送 headers / replyTo / idempotencyKey）', () => {
    beforeEach(() => {
      process.env.TOSEND_API_KEY = 'tosend_test_key'
    })

    // ⚠ 這個測試鎖住「現況」，不是「期望行為」。
    // ToSend transport 是在 Newsletter 需要的 headers/replyTo/idempotencyKey
    // 概念被加進 EmailPayload 之前就先實作的（見 git log：c323963 加 ToSend
    // 早於 780100f 實作 Newsletter 寄送），此後從未回頭補上這三個欄位的轉送。
    // 若日後把 ToSend 設為網站的 Email Provider，Newsletter 的
    // List-Unsubscribe 合規表頭與寄送冪等鍵會被靜默丟棄。
    // 這是本次任務執行中發現、但不在 6.2 原始「補測試」範圍內的缺口，
    // 已在任務回報中明確列出，交給 Fish 判斷是否另開 change 修復
    // （未貿然臆測 ToSend 真實 API 的 reply_to / headers 欄位名稱去改動
    // 這段程式碼，避免在未經驗證的第三方 API 假設下弄壞正式環境的 ToSend 串接）。
    it('send() 目前不會把 headers / replyTo / idempotencyKey 轉送給 ToSend API（已知缺口，見任務回報）', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ message_id: 'tosend_msg_1' }),
      })

      const transport = await getEmailTransport('tosend')
      await transport?.send(CONTRACT_PAYLOAD)

      const [, init] = (global.fetch as jest.Mock).mock.calls[0]
      // 沒有任何 Idempotency 相關 header 被加上。
      expect(init.headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer tosend_test_key',
      })
      const body = JSON.parse(init.body)
      expect(body.replyTo).toBeUndefined()
      expect(body.headers).toBeUndefined()
    })

    it('沒有實作 sendBatch：Newsletter 的 batch/逐封 fallback 邏輯必須退回逐封寄送', async () => {
      const transport = await getEmailTransport('tosend')
      expect(typeof transport?.sendBatch).not.toBe('function')
    })
  })

  describe('Newsletter sender snapshot 對 ToSend 的雙層 fallback（不因快照缺 tosend 分支而寄送失敗）', () => {
    it('getEmailTransportSnapshot 對 tosend 回傳 null（快照型別本就不含 tosend）', async () => {
      process.env.TOSEND_API_KEY = 'tosend_test_key'
      await expect(getEmailTransportSnapshot('tosend')).resolves.toBeNull()
    })

    it('getEmailTransportFromSnapshot(null) 正確回傳 null，讓呼叫端退回 getEmailTransport() 即時解析', () => {
      expect(getEmailTransportFromSnapshot(null)).toBeNull()
      expect(getEmailTransportFromSnapshot(undefined)).toBeNull()
    })

    it('即使快照解析失敗，getEmailTransport(\'tosend\') 仍能即時解析出可用的 transport（Newsletter 寄送不會因此中斷)', async () => {
      process.env.TOSEND_API_KEY = 'tosend_test_key'
      const snapshot = await getEmailTransportSnapshot('tosend')
      const transport = getEmailTransportFromSnapshot(snapshot) || (await getEmailTransport('tosend'))
      expect(transport).not.toBeNull()
    })
  })
})
