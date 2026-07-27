// app/api/admin/ai-generate-notes/route.ts
// AI 生成講義 API Route
// 支援字幕檔（SRT）和影片兩種來源
// 使用 ai-sdk + 用戶自訂的 Gemini API Key 與模型

import { NextRequest } from 'next/server'
import { streamText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { requireAdminAuth } from '@/lib/require-admin'
import { isFullAdmin } from '@/lib/course-permissions'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'
import { getCloudflareStreamConfig } from '@/lib/cloudflare-stream-config'
import { prisma } from '@/lib/prisma'
import { SETTING_KEYS } from '@/lib/validations/settings'

export const runtime = 'nodejs'
export const maxDuration = 120

const SYSTEM_PROMPT = `你是一位專業的「教學內容設計師」與「資深技術編輯」。你的專長是將原始、破碎的影片字幕，重組為結構嚴謹、邏輯清晰且易於人類學習的 Markdown 專文。

### 核心任務

請閱讀附上的影片字幕內容，將其改寫為一篇教學文章。你的目標是讓讀者能在最短時間內吸收核心知識，並透過結構化的引導完成學習。

內容轉化原則
1. 人類學習優先：
• 去除口語贅字，將語句修飾為流暢的書面語。
• 內容必須清晰、易讀，但必須保留關鍵的專業術語（不要過度簡化導致失真）。
• 適當使用粗體、列表（Lists）、引用區塊（Blockquotes）來增強可讀性。
• 對於某些複雜的功能，可以透過 Mermaid 或 Table 來幫助人類更好的學習。

2. 結構化進度感：
• 文章必須由多個**一級大標題（# H1）**構成。
每一個 H1 代表一個主要的學習進度節點，請根據內容邏輯進行分段。


### 格式與時間軸規範（至關重要）

為了讓讀者能快速對照影片，你必須嚴格遵守以下時間軸標記規則：

1. **時間軸格式**：
* 格式為：\`[MM:SS](#t=總秒數)\`
* 計算方式範例：若是 05:24，總秒數為 (5*60)+24 = 324，標記即為 \`[05:24](#t=324)\`。


2. **強制要求**：
* **每一個一級大標題（H1）的末尾，都必須加上該段落開始的時間軸標記。**
* 範例：\`# 第一章：AGI 的基礎架構 [02:15](#t=135)\`


3. **彈性使用**：
* 在文章內文中，若有某個特定的關鍵概念或演示需要強調，你也可以在該處插入此時間軸格式，方便讀者跳轉。



### 輸出範例結構

請參考以下 Markdown 結構進行輸出：

\`\`\`markdown
# 介紹與核心概念 [00:00](#t=0)
這段內容的摘要與重寫...

# 關鍵技術解析 [03:20](#t=200)
這段內容的詳細說明...
* 重點 1
* 重點 2

# 實作步驟示範 [08:45](#t=525)
具體的步驟說明...
> 這裡有一個重要的觀念是... [09:10](#t=550)

# 總結 [12:00](#t=720)
課程的最後總結...

\`\`\`

### 原始字幕輸入`

export async function POST(request: NextRequest) {
  try {
    // 權限檢查（直接查 DB 角色，確保即時生效）
    let actor: Awaited<ReturnType<typeof requireAdminAuth>>
    try {
      actor = await requireAdminAuth()
    } catch {
      return new Response('權限不足', { status: 403 })
    }

    // Rate limit：避免講師反覆呼叫耗用站台付費 Gemini 配額
    const rl = checkRateLimit(`ai-notes:${actor.id}`, {
      windowMs: 60 * 1000,
      maxRequests: 10,
    })
    if (!rl.success) {
      return new Response(
        JSON.stringify({ success: false, error: '操作太頻繁，請稍後再試' }),
        {
          status: 429,
          headers: { ...getRateLimitHeaders(rl), 'Content-Type': 'application/json' },
        }
      )
    }

    // 取得 Gemini 設定
    const settings = await prisma.siteSetting.findMany({
      where: {
        key: { in: [SETTING_KEYS.GEMINI_API_KEY, SETTING_KEYS.GEMINI_MODEL] },
      },
    })
    const settingsMap = new Map(settings.map((s) => [s.key, s.value]))
    const apiKey = settingsMap.get(SETTING_KEYS.GEMINI_API_KEY)
    const model =
      settingsMap.get(SETTING_KEYS.GEMINI_MODEL) || 'gemini-2.5-flash'

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '尚未設定 Gemini API Key，請先在系統設定中配置',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 解析請求
    const formData = await request.formData()
    const source = formData.get('source') as string // 'subtitle' | 'video'

    if (!source || !['subtitle', 'video'].includes(source)) {
      return new Response(
        JSON.stringify({ success: false, error: '請指定來源類型' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 建立 Gemini provider
    const google = createGoogleGenerativeAI({ apiKey })

    if (source === 'subtitle') {
      const file = formData.get('file') as File | null
      if (!file) {
        return new Response(
          JSON.stringify({ success: false, error: '請上傳字幕檔' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      const srtContent = await file.text()
      if (!srtContent.trim()) {
        return new Response(
          JSON.stringify({ success: false, error: '字幕檔內容為空' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      const result = streamText({
        model: google(model),
        system: SYSTEM_PROMPT,
        prompt: `請將以下影片字幕轉換成 Markdown 格式的課程講義。

字幕內容:

${srtContent}

---

請直接輸出 Markdown 文章，不需要其他說明或開場白。`,
      })

      return result.toTextStreamResponse()
    } else {
      // 影片模式 - 不使用 stream，直接回傳 JSON
      const videoId = formData.get('videoId') as string
      if (!videoId) {
        return new Response(
          JSON.stringify({ success: false, error: '請提供影片 ID' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // 講師只能對自己上傳的影片生成講義（依 Media.uploadedBy 歸屬判斷）
      if (!isFullAdmin(actor.role)) {
        const media = await prisma.media.findFirst({
          where: { cfStreamId: videoId },
          select: { uploadedBy: true },
        })
        if (!media || media.uploadedBy !== actor.id) {
          return new Response(
            JSON.stringify({ success: false, error: '沒有此影片的存取權限' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          )
        }
      }

      const { customerCode } = await getCloudflareStreamConfig()
      if (!customerCode) {
        return new Response(
          JSON.stringify({
            success: false,
            error: '尚未設定 Cloudflare Stream Customer Code',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
      const videoUrl = `https://customer-${customerCode}.cloudflarestream.com/${videoId}/downloads/default.mp4`

      const result = streamText({
        model: google(model),
        system: SYSTEM_PROMPT,
        prompt: `請觀看以下影片並根據影片內容生成講義。請根據影片中的時間點，在講義的適當位置插入時間戳錨點。

影片 URL: ${videoUrl}

請直接輸出 Markdown 文章，不需要其他說明或開場白。`,
      })

      return result.toTextStreamResponse()
    }
  } catch (error) {
    console.error('AI 生成講義失敗:', error)
    const message =
      error instanceof Error ? error.message : '生成講義時發生錯誤'
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
