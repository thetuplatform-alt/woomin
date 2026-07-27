// app/api/admin/ai-course/generate-content/route.ts
// AI 內容生成 API - 將 SRT 字幕轉換成 Markdown 文章
// 使用用戶自訂的 Gemini API Key 與模型

import { streamText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { requireAdminAuth } from '@/lib/require-admin'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'
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

export async function POST(request: Request) {
  try {
    // 驗證權限（直接查 DB 角色，確保即時生效）
    let actor: Awaited<ReturnType<typeof requireAdminAuth>>
    try {
      actor = await requireAdminAuth()
    } catch {
      return new Response('權限不足', { status: 403 })
    }

    // Rate limit：避免反覆呼叫耗用站台付費 Gemini 配額
    const rl = checkRateLimit(`ai-course-content:${actor.id}`, {
      windowMs: 60 * 1000,
      maxRequests: 20,
    })
    if (!rl.success) {
      return new Response('操作太頻繁，請稍後再試', {
        status: 429,
        headers: getRateLimitHeaders(rl),
      })
    }

    // 取得用戶自訂的 Gemini 設定
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
      return new Response('尚未設定 Gemini API Key', { status: 400 })
    }

    // 解析請求
    const body = await request.json()
    const { srtContent, lessonTitle, chapterTitle } = body as {
      srtContent: string
      lessonTitle: string
      chapterTitle: string
    }

    if (!srtContent || typeof srtContent !== 'string') {
      return new Response('缺少字幕內容', { status: 400 })
    }

    // 使用用戶自訂的 API Key 建立 Gemini provider
    const google = createGoogleGenerativeAI({ apiKey })

    const result = streamText({
      model: google(model),
      system: SYSTEM_PROMPT,
      prompt: `請將以下影片字幕轉換成 Markdown 格式的課程內容文章。

章節: ${chapterTitle}
單元: ${lessonTitle}

---

字幕內容:

${srtContent}

---

請直接輸出 Markdown 文章，不需要其他說明或開場白。`,
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error('AI 內容生成錯誤:', error)
    return new Response(
      error instanceof Error ? error.message : 'AI 內容生成失敗',
      { status: 500 }
    )
  }
}
