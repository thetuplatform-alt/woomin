'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import {
  clearCloudflareStreamConfigCache,
  getCloudflareStreamConfig,
} from '@/lib/cloudflare-stream-config'
import { SETTING_KEYS } from '@/lib/validations/settings'
import { setupFormSchema, type SetupFormData } from '@/lib/setup-config'
import { z } from 'zod'

export async function checkNeedsSetup(): Promise<boolean> {
  const adminCount = await prisma.user.count({
    where: { role: 'ADMIN' },
  })

  return adminCount === 0
}

async function upsertSetting(key: string, value: string) {
  await prisma.siteSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

export async function completeSetup(
  data: SetupFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: '請先登入' }
    }

    const validatedData = setupFormSchema.parse(data)

    const promoted = await prisma.$transaction(async (tx) => {
      const adminCount = await tx.user.count({
        where: { role: 'ADMIN' },
      })

      if (adminCount > 0) {
        return false
      }

      await tx.user.update({
        where: { id: session.user.id },
        data: { role: 'ADMIN' },
      })

      return true
    })

    if (!promoted) {
      return { success: false, error: '初始化已完成或已有管理員存在' }
    }

    const defaultLocalStorageRoot = '/data/uploads'
    const existingCloudflareConfig = await getCloudflareStreamConfig({ forceRefresh: true })

    const settingsToSave: Array<{ key: string; value: string }> = [
      { key: SETTING_KEYS.VIDEO_PROVIDER, value: validatedData.videoProvider },
      {
        key: SETTING_KEYS.CLOUDFLARE_ACCOUNT_ID,
        value: validatedData.cloudflareAccountId || existingCloudflareConfig.accountId,
      },
      {
        key: SETTING_KEYS.CLOUDFLARE_API_TOKEN,
        value: validatedData.cloudflareApiToken || existingCloudflareConfig.apiToken,
      },
      {
        key: SETTING_KEYS.CLOUDFLARE_STREAM_CUSTOMER_CODE,
        value: validatedData.cloudflareStreamCustomerCode || existingCloudflareConfig.customerCode,
      },
      {
        key: SETTING_KEYS.CLOUDFLARE_STREAM_SIGNING_SECRET,
        value: validatedData.cloudflareStreamSigningSecret || existingCloudflareConfig.signingSecret,
      },
      {
        key: SETTING_KEYS.CLOUDFLARE_STREAM_WEBHOOK_SECRET,
        value: validatedData.cloudflareStreamWebhookSecret || existingCloudflareConfig.webhookSecret,
      },
      { key: SETTING_KEYS.STORAGE_DRIVER, value: validatedData.storageDriver },
      {
        key: SETTING_KEYS.LOCAL_STORAGE_ROOT,
        value: validatedData.localStorageRoot || defaultLocalStorageRoot,
      },
      {
        key: SETTING_KEYS.GOOGLE_OAUTH_ENABLED,
        value: String(validatedData.googleMode === 'enable'),
      },
      {
        key: SETTING_KEYS.APPLE_OAUTH_ENABLED,
        value: String(validatedData.appleMode === 'enable'),
      },
      // 若 emailMode === 'auto'：保留既有 email_provider（通常是預先自動配置好的 zsend）
      // 其他模式：smtp 或 resend
      ...(validatedData.emailMode === 'auto'
        ? []
        : [
            {
              key: SETTING_KEYS.EMAIL_PROVIDER,
              value: validatedData.emailMode === 'smtp' ? 'smtp' : 'resend',
            },
          ]),
      {
        key: SETTING_KEYS.FOOTER_SECTIONS,
        value: JSON.stringify([
          {
            title: '支援',
            links: [
              { label: '服務條款', url: '/terms' },
              { label: '隱私政策', url: '/privacy' },
            ],
          },
        ]),
      },
    ]

    if (validatedData.contactEmail) {
      settingsToSave.push({
        key: SETTING_KEYS.CONTACT_EMAIL,
        value: validatedData.contactEmail,
      })
    }

    if (validatedData.emailMode === 'smtp') {
      settingsToSave.push(
        { key: SETTING_KEYS.EMAIL_SENDER_NAME, value: validatedData.emailSenderName || '' },
        { key: SETTING_KEYS.EMAIL_FROM, value: validatedData.emailFrom || '' },
        { key: SETTING_KEYS.SMTP_HOST, value: validatedData.smtpHost || '' },
        { key: SETTING_KEYS.SMTP_PORT, value: validatedData.smtpPort || '587' },
        { key: SETTING_KEYS.SMTP_USER, value: validatedData.smtpUser || '' },
        { key: SETTING_KEYS.SMTP_PASS, value: validatedData.smtpPass || '' },
        { key: SETTING_KEYS.SMTP_SECURE, value: String(validatedData.smtpSecure ?? false) }
      )
    }

    if (validatedData.googleMode === 'enable') {
      settingsToSave.push(
        { key: SETTING_KEYS.GOOGLE_CLIENT_ID, value: validatedData.googleClientId || '' },
        { key: SETTING_KEYS.GOOGLE_CLIENT_SECRET, value: validatedData.googleClientSecret || '' }
      )
    }

    if (validatedData.appleMode === 'enable') {
      settingsToSave.push(
        { key: SETTING_KEYS.APPLE_CLIENT_ID, value: validatedData.appleClientId || '' },
        { key: SETTING_KEYS.APPLE_TEAM_ID, value: validatedData.appleTeamId || '' },
        { key: SETTING_KEYS.APPLE_KEY_ID, value: validatedData.appleKeyId || '' },
        { key: SETTING_KEYS.APPLE_PRIVATE_KEY, value: validatedData.applePrivateKey || '' }
      )
    }

    await Promise.all(settingsToSave.map((setting) => upsertSetting(setting.key, setting.value)))
    clearCloudflareStreamConfigCache()

    await prisma.adminLog.create({
      data: {
        adminId: session.user.id,
        action: 'UPDATE_SETTINGS',
        targetType: 'System',
        details: {
          action: 'complete_initial_setup',
          videoProvider: validatedData.videoProvider,
          storageDriver: validatedData.storageDriver,
          emailMode: validatedData.emailMode,
          googleMode: validatedData.googleMode,
          appleMode: validatedData.appleMode,
          settingsCount: settingsToSave.length,
        },
      },
    })

    revalidatePath('/admin')
    revalidatePath('/admin/settings')
    revalidatePath('/login')
    revalidatePath('/checkout')
    revalidatePath('/')

    return { success: true }
  } catch (error) {
    console.error('完成初始化設定失敗:', error)

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || '設定驗證失敗',
      }
    }

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: '初始化設定時發生未知錯誤' }
  }
}
