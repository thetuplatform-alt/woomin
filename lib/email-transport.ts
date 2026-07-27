// lib/email-transport.ts
// Email 傳輸抽象層
// 支援 Resend SDK、ToSend REST API、Zeabur Email (ZSend) REST API、Nodemailer SMTP
// 優先順序：DB 設定 > 環境變數

import { Resend } from 'resend'
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { SETTING_KEYS } from '@/lib/validations/settings'

export interface EmailPayload {
  from: string
  to: string[]
  subject: string
  html: string
  text?: string
  headers?: Record<string, string>
  replyTo?: string
  idempotencyKey?: string
}

export interface EmailSendResult {
  messageId?: string
}

export interface EmailBatchOptions {
  idempotencyKey?: string
}

export interface EmailTransport {
  send(payload: EmailPayload): Promise<EmailSendResult>
  sendBatch?(payloads: EmailPayload[], options?: EmailBatchOptions): Promise<EmailSendResult[]>
}

export type EmailProvider = 'resend' | 'smtp' | 'zsend' | 'tosend'

export type EmailTransportSnapshot =
  | { provider: 'resend'; apiKey: string }
  | { provider: 'zsend'; apiKey: string }
  | { provider: 'smtp'; config: SmtpConfig }

// ── Resend Transport ──

class ResendTransport implements EmailTransport {
  private client: Resend

  constructor(apiKey: string) {
    this.client = new Resend(apiKey)
  }

  async send(payload: EmailPayload): Promise<EmailSendResult> {
    const result = await this.client.emails.send(
      {
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        headers: payload.headers,
        replyTo: payload.replyTo,
      },
      payload.idempotencyKey ? { idempotencyKey: payload.idempotencyKey } : undefined
    )

    if (result.error) {
      throw new Error(result.error.message)
    }

    return { messageId: result.data?.id }
  }

  async sendBatch(payloads: EmailPayload[], options?: EmailBatchOptions): Promise<EmailSendResult[]> {
    if (payloads.length === 0) return []
    const result = await this.client.batch.send(
      payloads.map((payload) => ({
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        headers: payload.headers,
        replyTo: payload.replyTo,
      })),
      options?.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : undefined
    )

    if (result.error) {
      throw new Error(result.error.message)
    }

    return (result.data?.data || []).map((item) => ({ messageId: item.id }))
  }
}

// ── Zeabur Email (ZSend) Transport ──

const ZSEND_API_ENDPOINT = 'https://api.zeabur.com/api/v1/zsend/emails'
const TOSEND_API_BASE_URL = 'https://api.tosend.com/v2'

class ZsendTransport implements EmailTransport {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async send(payload: EmailPayload): Promise<EmailSendResult> {
    const headers = {
      ...(payload.headers || {}),
      ...(payload.idempotencyKey ? { 'Idempotency-Key': payload.idempotencyKey } : {}),
    }
    const response = await fetch(ZSEND_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...headers,
      },
      body: JSON.stringify({
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        replyTo: payload.replyTo,
        headers,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      throw new Error(`Zeabur Email API error (${response.status}): ${errorText}`)
    }

    const data = (await response.json().catch(() => ({}))) as { id?: string; messageId?: string }
    return { messageId: data.id || data.messageId }
  }
}

// ── ToSend Transport ──

function parseEmailAddress(value: string): { name?: string; email: string } {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  if (!match) {
    return { email: value.trim() }
  }

  const name = match[1].trim().replace(/^["']|["']$/g, '')
  return {
    ...(name ? { name } : {}),
    email: match[2].trim(),
  }
}

class TosendTransport implements EmailTransport {
  private apiKey: string
  private endpoint: string

  constructor(apiKey: string, baseUrl = TOSEND_API_BASE_URL) {
    this.apiKey = apiKey
    this.endpoint = `${baseUrl.replace(/\/+$/, '')}/emails`
  }

  async send(payload: EmailPayload): Promise<EmailSendResult> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        from: parseEmailAddress(payload.from),
        to: payload.to.map((email) => parseEmailAddress(email)),
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      throw new Error(`ToSend API error (${response.status}): ${errorText}`)
    }

    const data = (await response.json().catch(() => ({}))) as {
      id?: string
      messageId?: string
      message_id?: string
    }
    return { messageId: data.message_id || data.id || data.messageId }
  }
}

// ── SMTP Transport (Nodemailer) ──

class SmtpTransport implements EmailTransport {
  private transporter: Transporter

  constructor(config: {
    host: string
    port: number
    secure: boolean
    user?: string
    pass?: string
  }) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(config.user && config.pass
        ? {
            auth: {
              user: config.user,
              pass: config.pass,
            },
          }
        : {}),
    })
  }

  async send(payload: EmailPayload): Promise<EmailSendResult> {
    const headers = {
      ...(payload.headers || {}),
      ...(payload.idempotencyKey ? { 'Resend-Idempotency-Key': payload.idempotencyKey } : {}),
    }
    const info = await this.transporter.sendMail({
      from: payload.from,
      to: payload.to.join(', '),
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      headers,
      replyTo: payload.replyTo,
    })

    return { messageId: info.messageId }
  }
}

// ── SMTP 設定型別 ──

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
}

async function getResendApiKeyFromDB(): Promise<string> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: SETTING_KEYS.RESEND_API_KEY },
      select: { value: true },
    })

    return setting?.value?.trim() || ''
  } catch {
    return ''
  }
}

function getResendApiKeyFromEnv(): string {
  return process.env.RESEND_API_KEY?.trim() || ''
}

async function getTosendApiKeyFromDB(): Promise<string> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: SETTING_KEYS.TOSEND_API_KEY },
      select: { value: true },
    })

    return setting?.value?.trim() || ''
  } catch {
    return ''
  }
}

function getTosendApiKeyFromEnv(): string {
  return process.env.TOSEND_API_KEY?.trim() || ''
}

function getTosendApiBaseUrlFromEnv(): string {
  return process.env.TOSEND_API_BASE_URL?.trim() || TOSEND_API_BASE_URL
}

async function getZsendApiKeyFromDB(): Promise<string> {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: SETTING_KEYS.ZSEND_API_KEY },
      select: { value: true },
    })

    return setting?.value?.trim() || ''
  } catch {
    return ''
  }
}

function getZsendApiKeyFromEnv(): string {
  return process.env.ZSEND_API_KEY?.trim() || ''
}

// ── 從資料庫讀取 SMTP 設定 ──

async function getSmtpConfigFromDB(): Promise<SmtpConfig | null> {
  try {
    const keys = [
      SETTING_KEYS.SMTP_HOST,
      SETTING_KEYS.SMTP_PORT,
      SETTING_KEYS.SMTP_USER,
      SETTING_KEYS.SMTP_PASS,
      SETTING_KEYS.SMTP_SECURE,
    ]

    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: keys } },
    })

    const map = new Map(settings.map((s) => [s.key, s.value]))
    const host = map.get(SETTING_KEYS.SMTP_HOST)

    if (!host) return null

    return {
      host,
      port: parseInt(map.get(SETTING_KEYS.SMTP_PORT) || '587', 10),
      secure: map.get(SETTING_KEYS.SMTP_SECURE) === 'true',
      user: map.get(SETTING_KEYS.SMTP_USER) || '',
      pass: map.get(SETTING_KEYS.SMTP_PASS) || '',
    }
  } catch {
    return null
  }
}

// ── 從環境變數讀取 SMTP 設定 ──

function getSmtpConfigFromEnv(): SmtpConfig | null {
  const host = process.env.SMTP_HOST
  if (!host) return null

  return {
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  }
}

// ── 取得 Email Provider 偏好 ──

async function getEmailProvider(): Promise<EmailProvider> {
  const isEmailProvider = (value: string | undefined): value is 'resend' | 'smtp' | 'zsend' | 'tosend' =>
    value === 'smtp' || value === 'resend' || value === 'zsend' || value === 'tosend'
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: SETTING_KEYS.EMAIL_PROVIDER },
    })
    if (isEmailProvider(setting?.value)) {
      return setting.value
    }
  } catch {
    // fallback
  }

  const envProvider = process.env.EMAIL_PROVIDER?.trim()
  if (isEmailProvider(envProvider)) {
    return envProvider
  }

  return 'resend'
}

// ── 主要入口：取得 Email Transport（singleton 快取） ──

let cachedTransport: EmailTransport | null = null
let cachedTransportKey: string | null = null
let cachedTransportTime = 0
const TRANSPORT_CACHE_TTL = 5 * 60 * 1000 // 5 分鐘

export async function getEmailTransport(providerOverride?: EmailProvider): Promise<EmailTransport | null> {
  const provider = providerOverride || (await getEmailProvider())

  let transport: EmailTransport | null = null
  let cacheKey = ''

  const tryCache = (key: string): EmailTransport | null => {
    if (
      cachedTransport &&
      cachedTransportKey === key &&
      Date.now() - cachedTransportTime < TRANSPORT_CACHE_TTL
    ) {
      return cachedTransport
    }
    return null
  }

  if (provider === 'zsend') {
    const zsendApiKey = (await getZsendApiKeyFromDB()) || getZsendApiKeyFromEnv()
    if (zsendApiKey) {
      cacheKey = `zsend:${zsendApiKey.slice(0, 8)}`
      const cached = tryCache(cacheKey)
      if (cached) return cached
      transport = new ZsendTransport(zsendApiKey)
    }
  }

  if (!transport && provider === 'tosend') {
    const tosendApiKey = (await getTosendApiKeyFromDB()) || getTosendApiKeyFromEnv()
    if (tosendApiKey) {
      cacheKey = `tosend:${tosendApiKey.slice(0, 8)}:${getTosendApiBaseUrlFromEnv()}`
      const cached = tryCache(cacheKey)
      if (cached) return cached
      transport = new TosendTransport(tosendApiKey, getTosendApiBaseUrlFromEnv())
    }
  }

  if (!transport && provider === 'smtp') {
    const smtpConfig = (await getSmtpConfigFromDB()) || getSmtpConfigFromEnv()
    if (smtpConfig?.host) {
      cacheKey = `smtp:${smtpConfig.host}:${smtpConfig.port}:${smtpConfig.user}`
      const cached = tryCache(cacheKey)
      if (cached) return cached
      transport = new SmtpTransport(smtpConfig)
    }
  }

  if (!transport && provider === 'resend') {
    const resendApiKey = (await getResendApiKeyFromDB()) || getResendApiKeyFromEnv()
    if (resendApiKey) {
      cacheKey = `resend:${resendApiKey.slice(0, 8)}`
      const cached = tryCache(cacheKey)
      if (cached) return cached
      transport = new ResendTransport(resendApiKey)
    }
  }

  // 依序 fallback：ZSend → ToSend → Resend → SMTP
  if (!transport) {
    const zsendApiKey = (await getZsendApiKeyFromDB()) || getZsendApiKeyFromEnv()
    if (zsendApiKey) {
      cacheKey = `zsend:${zsendApiKey.slice(0, 8)}`
      const cached = tryCache(cacheKey)
      if (cached) return cached
      transport = new ZsendTransport(zsendApiKey)
    }
  }

  if (!transport) {
    const tosendApiKey = (await getTosendApiKeyFromDB()) || getTosendApiKeyFromEnv()
    if (tosendApiKey) {
      cacheKey = `tosend:${tosendApiKey.slice(0, 8)}:${getTosendApiBaseUrlFromEnv()}`
      const cached = tryCache(cacheKey)
      if (cached) return cached
      transport = new TosendTransport(tosendApiKey, getTosendApiBaseUrlFromEnv())
    }
  }

  if (!transport) {
    const resendApiKey = (await getResendApiKeyFromDB()) || getResendApiKeyFromEnv()
    if (resendApiKey) {
      cacheKey = `resend:${resendApiKey.slice(0, 8)}`
      const cached = tryCache(cacheKey)
      if (cached) return cached
      transport = new ResendTransport(resendApiKey)
    }
  }

  if (!transport) {
    const smtpConfig = (await getSmtpConfigFromDB()) || getSmtpConfigFromEnv()
    if (smtpConfig?.host) {
      cacheKey = `smtp:${smtpConfig.host}:${smtpConfig.port}:${smtpConfig.user}`
      const cached = tryCache(cacheKey)
      if (cached) return cached
      transport = new SmtpTransport(smtpConfig)
    }
  }

  cachedTransport = transport
  cachedTransportKey = cacheKey
  cachedTransportTime = Date.now()

  return transport
}

export async function getEmailTransportSnapshot(providerOverride?: EmailProvider): Promise<EmailTransportSnapshot | null> {
  const provider = providerOverride || (await getEmailProvider())

  if (provider === 'zsend') {
    const apiKey = (await getZsendApiKeyFromDB()) || getZsendApiKeyFromEnv()
    if (apiKey) return { provider: 'zsend', apiKey }
  }

  if (provider === 'smtp') {
    const config = (await getSmtpConfigFromDB()) || getSmtpConfigFromEnv()
    if (config?.host) return { provider: 'smtp', config }
  }

  if (provider === 'resend') {
    const apiKey = (await getResendApiKeyFromDB()) || getResendApiKeyFromEnv()
    if (apiKey) return { provider: 'resend', apiKey }
  }

  return null
}

export function getEmailTransportFromSnapshot(snapshot?: EmailTransportSnapshot | null): EmailTransport | null {
  if (!snapshot) return null
  if (snapshot.provider === 'zsend' && snapshot.apiKey) return new ZsendTransport(snapshot.apiKey)
  if (snapshot.provider === 'resend' && snapshot.apiKey) return new ResendTransport(snapshot.apiKey)
  if (snapshot.provider === 'smtp' && snapshot.config?.host) return new SmtpTransport(snapshot.config)
  return null
}

/**
 * 清除 transport 快取（設定變更時呼叫）
 */
export function clearTransportCache() {
  cachedTransport = null
  cachedTransportKey = null
  cachedTransportTime = 0
}

// ── 檢查是否有任一 Email 服務可用 ──

export async function isEmailServiceConfigured(): Promise<boolean> {
  if ((await getZsendApiKeyFromDB()) || getZsendApiKeyFromEnv()) return true
  if ((await getTosendApiKeyFromDB()) || getTosendApiKeyFromEnv()) return true
  if ((await getResendApiKeyFromDB()) || getResendApiKeyFromEnv()) return true
  const smtpConfig = (await getSmtpConfigFromDB()) || getSmtpConfigFromEnv()
  return !!smtpConfig?.host
}

// ── 測試 SMTP 連線 ──

export async function testSmtpConnection(config: SmtpConfig): Promise<{
  success: boolean
  message: string
}> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(config.user && config.pass
        ? { auth: { user: config.user, pass: config.pass } }
        : {}),
    })

    await transporter.verify()
    return { success: true, message: 'SMTP 連線成功' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'SMTP 連線失敗',
    }
  }
}
