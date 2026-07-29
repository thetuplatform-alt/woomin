// app/(admin)/admin/courses/[id]/content/page.tsx
// 課程內容頁面 - 三欄式佈局
// 左側: 大綱導覽 | 中間: 單元編輯器 | 右側: 設定與預覽

import { ContentLayout } from '@/components/admin/course-editor/content-layout'
import { OutlinePanel } from '@/components/admin/course-editor/outline-panel'
import { LessonEditorPanel } from '@/components/admin/course-editor/lesson-editor-panel'
import { SettingsPreviewPanel } from '@/components/admin/course-editor/settings-preview-panel'
import {
  getCloudflareStreamConfig,
  getCloudflareStreamConfigStatus,
} from '@/lib/cloudflare-stream-config'
import { prisma } from '@/lib/prisma'
import { SETTING_KEYS } from '@/lib/validations/settings'

export const metadata = {
  title: '課程內容',
}

interface ContentPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ContentPage({ params }: ContentPageProps) {
  const { id: courseId } = await params
  const [cloudflareStatus, cloudflareStream, geminiSetting] = await Promise.all([
    getCloudflareStreamConfigStatus(),
    getCloudflareStreamConfig(),
    prisma.siteSetting.findUnique({
      where: { key: SETTING_KEYS.GEMINI_API_KEY },
    }),
  ])
  const streamCustomerCode = cloudflareStream.customerCode
  const isCloudflareStreamConfigured =
    cloudflareStatus.hasUploadConfig && cloudflareStatus.hasPlaybackConfig

  const isGeminiConfigured = !!geminiSetting?.value

  return (
    <ContentLayout
      leftPanel={
        <OutlinePanel courseId={courseId} isGeminiConfigured={isGeminiConfigured} />
      }
      centerPanel={
        <LessonEditorPanel
          streamCustomerCode={streamCustomerCode}
          isGeminiConfigured={isGeminiConfigured}
          isCloudflareStreamConfigured={isCloudflareStreamConfigured}
        />
      }
      rightPanel={
        <SettingsPreviewPanel streamCustomerCode={streamCustomerCode} />
      }
    />
  )
}
