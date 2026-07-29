本檔案為針對 Agent 的**開發者**指南，適用於此通用型線上課程販售平台。

> 如果你是購買原始碼的客戶、非工程師，請改讀 `docs/agents/AGENTS.customer.md`。
> 發布新版本時會由 `/publish-update` skill 自動切換根目錄的 `AGENTS.md` 為客戶版，推送完再還原為此開發版。

## Project Overview

通用型線上課程販售平台 — 使用 Next.js 15 + Prisma 7 建構，採用 **Simple-first** 架構：

- 預設部署目標為 **Zeabur**
- 圖片/附件預設使用**本地 volume**（可切換 S3 相容儲存或 Cloudflare R2）
- 影片預設支援 **YouTube**（可選啟用 Cloudflare Stream）
- Email、Google / Apple OAuth、進階金流皆為「上線後再啟用」的可選功能

## 🚀 正式上線部署（最重要 — 用戶要上線時直接用這個 Skill）

當用戶想把專案**正式上線 / 部署到 Zeabur**（「幫我部署起來」、「幫我架起來」、「我剛買了這個」、「把這個跑起來」、「幫我更新版本」、「重新部署」等意圖），**一律使用 `/onboarding` skill，不要自己手動拼湊部署步驟**。

- **Skill 位置**：[`.claude/skills/onboarding/SKILL.md`](.claude/skills/onboarding/SKILL.md)（發布打包來源同步在 `.agents/skills/onboarding/SKILL.md`）
- **涵蓋範圍**：Zeabur 登入、租伺服器、建專案、開資料庫、兩段式部署、**掛永久硬碟到 `/data`**、網址綁定、Email 設定，以及後續版本更新 / 重部署 / 升級的全流程。
- **這份 skill 是「一條龍上線」的唯一事實來源**，內含每個階段的地雷 SOP 與冪等狀態追蹤（專案根目錄的部署狀態檔）。

> ⛔️ **上線完成的硬性條件**：skill 的「階段 9.9 最終驗收清單」共 10 項，**每一項都必須實際跑出 PASS** 才算上線完成；任一項 FAIL 就不准宣稱「部署完成」。
>
> 其中**第 1 項最容易被遺漏、後果最嚴重**：正在運行的 Docker（Zeabur）service **一定要掛載永久硬碟，且掛在 `/data`**。漏掛會導致重啟後使用者上傳的檔案、課程封面、學員作業全部遺失。**部署時務必親自進容器驗證 `/data` 真的掛上且可寫，不能只看環境變數。**

## Common Commands

```bash
# Development
pnpm dev                    # 啟動開發伺服器 (http://localhost:3000)
pnpm build                  # Production 建置
pnpm start                  # 啟動 Production 伺服器
pnpm lint                   # 執行 ESLint

# Database (Prisma)
pnpm prisma generate        # 產生 Prisma Client
pnpm prisma db push         # 同步 Schema 到資料庫
pnpm prisma studio          # 開啟資料庫 GUI

# Admin
pnpm admin:init <email>     # 將用戶升級為 ADMIN 角色
```

## Architecture

### Tech Stack
- **Framework**: Next.js 15 (App Router) + React 19
- **Database**: PostgreSQL + Prisma 7
- **Auth**: NextAuth v5（Credentials 預設啟用；Google / Apple OAuth 可選）
- **UI**: Tailwind CSS v4 + shadcn/ui
- **Payment**: Stripe / PayUni（後台可切換，皆可選）
- **File Storage**: 本地 volume（預設）/ S3 相容儲存 / Cloudflare R2（三擇一，後台切換）
- **Video**: YouTube（預設）/ Cloudflare Stream（可選進階）
- **Email**: Resend / SMTP（皆可選，後台切換）
- **AI**: Vercel AI SDK + Google Gemini（API Key 在後台設定）
- **Animation**: framer-motion
- **Editor**: Milkdown (Markdown)
- **Form**: React Hook Form + Zod
- **Analytics**: PostHog + Google Analytics + Meta Pixel/CAPI（皆可選）

### Route Groups (App Router)
- `app/(admin)/admin/` — 後台管理（需 ADMIN 或 EDITOR 角色）
- `app/(auth)/` — 認證頁面（登入、註冊）
- `app/(main)/` — 前台公開頁面
- `app/(setup)/` — 初始設定流程（首次開站引導）
- `app/api/` — API Routes

### Key Libraries
- `lib/auth.ts` — NextAuth v5 設定（Credentials 預設；Google / Apple 可選）
- `lib/auth.config.ts` — Edge-compatible auth config（middleware 使用）
- `lib/prisma.ts` — Prisma Client 單例
- `lib/cloudflare.ts` — Cloudflare Stream / R2 API（可選啟用）
- `lib/storage/` — 檔案儲存抽象層（本地 / S3 / R2 三選一）
- `lib/payment/` — 金流閘道抽象層（Stripe / PayUni）
- `lib/email.ts` — Email 發送服務
- `lib/email-transport.ts` — Email 傳輸抽象層（Resend / SMTP）
- `lib/actions/` — Server Actions（資料寫入操作）
- `lib/validations/` — Zod 驗證 Schema
- `lib/setup-config.ts` — 初始設定讀寫
- `lib/actions/setup.ts` — 首次 setup flow Server Actions

### Middleware
`middleware.ts` 負責路由保護：
- `/admin/*` 需要 ADMIN 或 EDITOR 角色
- `/courses/[slug]/lessons/*` 需要登入
- 已登入用戶會被重導離開 `/login` 和 `/register`
- UTM 參數自動追蹤（30 天 cookie）

### Database Models (Prisma)
核心 Model：`User`, `Course`, `Chapter`, `Lesson`, `Order`, `Purchase`, `Media`, `SiteSetting`

用戶角色：`USER`（預設）、`EDITOR`（內容管理）、`ADMIN`（完整權限）

### UI Components
- `components/ui/` — shadcn/ui 基礎元件
- `components/admin/` — 後台專用元件
- `components/main/` — 前台元件
- `components/layouts/` — Layout 元件

### Path Aliases
使用 `@/*` 從專案根目錄匯入（如 `@/lib/prisma`、`@/components/ui/button`）

---

## 可複用模塊（開發新功能時可直接使用）

以下模塊已完整建構，開發新功能時**應直接使用**而非重新實作。

### 1. AI 模型服務（Generative AI）

平台內建 AI 模型管理機制，透過後台 `/admin/settings` 的 AI 設定頁面，管理員可設定 Gemini API Key 和模型名稱。

**現有基礎設施：**
- **設定儲存**：`SiteSetting` 表的 `gemini_api_key` 和 `gemini_model` 欄位
- **設定讀寫**：`lib/actions/settings.ts` 的 `getAISettings()` / `updateAISettings()`
- **驗證規則**：`lib/validations/settings.ts` 的 `aiSettingsSchema`
- **UI 元件**：`components/admin/settings/ai-settings-form.tsx`（支援預設模型選擇 + 自訂模型輸入）
- **AI SDK**：已安裝 `ai` (Vercel AI SDK v6) 和 `@ai-sdk/google`

**現有 AI 功能範例（可作為新功能參考）：**
- `app/api/admin/ai-generate-notes/route.ts` — 從 SRT 字幕生成 Markdown 講義（streaming）
- `app/api/admin/ai-course/generate-content/route.ts` — 影片字幕轉課程內容
- `components/admin/ai-course/` — AI 批量建立課程大綱的完整 UI 元件組

**擴展新 AI 功能的做法：**
```typescript
import { getAISettings } from '@/lib/actions/settings'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { streamText } from 'ai'

const aiSettings = await getAISettings()
const google = createGoogleGenerativeAI({ apiKey: aiSettings.geminiApiKey })
const model = google(aiSettings.geminiModel)

const result = streamText({ model, prompt: '...' })
```

### 2. 金流系統（Payment Gateway）

平台採用**閘道抽象模式**，目前支援 Stripe 和 PAYUNi，未來可擴展新的金流供應商。金流是**可選功能**，未設定時平台仍可正常運作（只是無法販售付費課程）。

**核心檔案：**
- `lib/payment/types.ts` — `PaymentGateway` 介面定義
- `lib/payment/gateway-factory.ts` — 工廠模式，從 DB 設定取得啟用的閘道
- `lib/payment/stripe-gateway.ts` — Stripe 實作
- `lib/payment/payuni-gateway.ts` — PAYUNi 實作
- `lib/payment/post-payment-actions.ts` — 付款成功後的統一動作（建立 Purchase、寄信、追蹤）

**使用方式：**
```typescript
import { getActivePaymentGateway } from '@/lib/payment/gateway-factory'
const gateway = await getActivePaymentGateway()
const result = await gateway.createPaymentSession({ ... })
```

**擴展新金流供應商：**
1. 實作 `PaymentGateway` 介面
2. 在 `gateway-factory.ts` 新增分支
3. 在 `SETTING_KEYS` 新增對應的設定 key
4. Webhook route 獨立建立在 `app/api/webhooks/` 或 `app/api/payment/`

### 3. Email 系統

平台內建**雙傳輸協議**的 Email 系統，管理員可在後台切換 Resend SDK 或 SMTP。未設定時會跳過寄信並記錄警告，不會導致功能失敗。

**核心檔案：**
- `lib/email-transport.ts` — 傳輸抽象層（`EmailTransport` 介面，支援 Resend / SMTP）
- `lib/email.ts` — 高階 Email 發送函式（購買確認、密碼重設、歡迎信等）
- `lib/email-templates.ts` — HTML Email 模板（帶品牌客製化 + HTML 防注入）

**使用方式：**
```typescript
import { getEmailTransport } from '@/lib/email-transport'
const transport = await getEmailTransport()
await transport.send({ from, to, subject, html })
```

### 4. 媒體與檔案儲存（Media & File Storage）

平台採用**儲存抽象層**，同時涵蓋圖片、附件、使用者上傳的一般檔案。支援三種後端，管理員可在後台切換：

| 後端 | 適用場景 | 備註 |
|------|---------|------|
| **本地 volume** | Zeabur 單實例部署（預設） | ⚠️ **Zeabur App 服務務必掛載 persistent volume 到 `/data`**；`LOCAL_STORAGE_ROOT=/data/uploads` 為 `/data` 下的子資料夾。漏掛 volume 會導致重啟後所有使用者上傳檔案遺失 |
| **S3 相容儲存** | 多實例、跨區部署 | 支援任何 S3 相容服務（AWS S3、Cloudflare R2、Backblaze B2、MinIO 等）|
| **Cloudflare R2** | S3 相容儲存的便捷選項 | 實質為 S3 模式的一組預設端點 |

**核心檔案：**
- `lib/storage/` — 儲存抽象層（`StorageAdapter` 介面 + 三種實作）
- `lib/cloudflare.ts` — Cloudflare Stream（影片）+ R2 對應的 helper

**通用函式（不論底層後端）：**
- `uploadFile()` — 伺服器端直接上傳
- `getPresignedUploadUrl()` — 產生前端直傳的簽名 URL（S3 / R2 模式；本地模式回傳專屬的 upload endpoint）
- `getPresignedDownloadUrl()` — 產生限時下載連結

**影片（Cloudflare Stream，可選啟用）：**
- 使用 TUS 協議支援斷點續傳
- `generateSignedStreamUrl()` / `generateSignedStreamToken()` 產生安全播放連結
- 未啟用時前台自動回退到 YouTube 嵌入或純音訊/文字模式

**使用情境**：任何需要檔案上傳的新功能（作業上傳、附件下載、證書圖片、課程封面）都應使用 `lib/storage` 的通用 API，不要直接寫死某一種後端。

### 5. 認證與權限系統

**認證方式（NextAuth v5）：**
- Credentials（Email + Password）為預設，不需任何外部設定
- Google OAuth、Apple OAuth 為可選，後台或 setup flow 可啟用
- JWT Session（30 天過期）
- 暴力破解防護：`LoginAttempt` + 帳號鎖定機制

**權限檢查：**
```typescript
import { requireAdminAuth } from '@/lib/require-admin'    // ADMIN 或 EDITOR
import { requireOnlyAdminAuth } from '@/lib/require-admin' // 僅 ADMIN
import { auth } from '@/lib/auth'                          // 取得當前 session
```

**注意事項：**
- `requireAdminAuth()` / `requireOnlyAdminAuth()` 直接查 DB，確保角色變更即時生效
- 新增需要登入的頁面時，在 `middleware.ts` 加入路由規則
- 新增後台功能時，務必加上權限檢查

### 6. 系統設定（SiteSetting）

平台使用 `SiteSetting` 表作為**通用的 Key-Value 設定儲存**，所有可在後台調整的設定都存在這裡。

**設定 Key 註冊表：**`lib/validations/settings.ts` 的 `SETTING_KEYS` 常數

**現有設定類別：**
| 類別 | 用途 |
|------|------|
| 基本設定 | 站名、Logo、聯絡信箱 |
| 品牌文案 | 顯示名稱、副標題 |
| 分析追蹤 | GA、PostHog、Meta Pixel |
| Email | 供應商、寄件人、SMTP |
| 金流 | Stripe / PAYUNi 金鑰 |
| 檔案儲存 | 後端選擇（local / s3 / r2）、bucket、endpoint、key |
| 影片 | YouTube / Cloudflare Stream 切換與 Stream 憑證 |
| 版面 | Header / Footer 導覽連結 |
| 法律 | 隱私政策、服務條款（Markdown） |
| AI 模型 | Gemini API Key / 模型名稱 |

**擴展新設定的做法：**
1. 在 `SETTING_KEYS` 新增 key 常數
2. 在對應的 Zod schema 新增驗證規則
3. 在 `lib/actions/settings.ts` 新增讀寫函式
4. 在 `components/admin/settings/` 新增或擴展 UI 表單
5. 若為敏感資料（API Key 等），加入 `SENSITIVE_SETTING_KEYS` 集合以啟用遮蔽

### 7. 分析與追蹤

**已整合的追蹤服務（皆可選）：**
- **PostHog**：`lib/posthog-server.ts`（伺服器端）+ `posthog-js`（客戶端）
- **Google Analytics**：`ga_id` 設定 key，標準 gtag.js
- **Meta Pixel / CAPI**：`components/common/meta-pixel-events.tsx`（客戶端）+ `lib/meta-capi.ts`（伺服器端）

**新功能若需追蹤事件：**
- 客戶端事件：使用 PostHog JS SDK 或 Meta Pixel
- 伺服器端事件：使用 `lib/posthog-server.ts` 或 `lib/meta-capi.ts`
- 購買相關事件會自動在 `post-payment-actions.ts` 中觸發

### 8. 優惠券系統

- `Coupon` Model：支援固定金額 / 百分比折扣、使用次數限制、有效期間、指定課程
- `CouponRedemption` Model：使用紀錄追蹤
- Server Actions：`lib/actions/coupons.ts`
- 驗證 API：`app/api/coupon/validate/route.ts`

### 9. 評論與評價系統

- `LessonComment`：單元留言（支援匿名、軟刪除、講師回覆）
- `CourseReview`：課程評價（1-5 星 + 文字、講師回覆、有用投票、檢舉）
- 前後台都有對應的元件和管理介面

### 10. 操作日誌（Admin Audit Log）

`AdminLog` Model 記錄所有後台管理操作，包含操作類型、目標、詳細資料 JSON。

```typescript
await prisma.adminLog.create({
  data: {
    adminId: session.user.id,
    action: 'YOUR_ACTION_TYPE',
    targetType: 'YourModel',
    targetId: targetId,
    details: { ... },
  },
})
```

新增後台功能時，應記錄重要操作到 AdminLog。

### 11. 併發處理工具

`lib/utils/concurrency.ts` 提供 `BatchProcessor` 和 `Queue` 工具類，可用於批量操作（如批次匯入學員、大量寄信）。

### 12. Rate Limiting

`lib/rate-limit.ts` 提供 API 速率限制功能，新增公開 API 時應加上速率限制以防止濫用。

---

## 平台維護相關 Skills（開發者專用）

這些 skills 屬於平台開發者工具鏈，客戶端版本不會包含。

| Skill | 用途 | 觸發詞 |
|-------|------|--------|
| `/publish-update` | 發布新版本到 R2 + 版本 API | 「發版」、「publish update」、「推版本」 |
| `/upgrade-platform` | 把目前分支升級到官方最新版 | 「升級」、「update platform」 |

### `/publish-update` 運作流程（重點）

1. 讀版本、確認新版號、找基準 commit、生摘要
2. **自動切換 `AGENTS.md` 為客戶版**（複製 `docs/agents/AGENTS.customer.md`）並 commit
3. 打包 tar.gz + zip（此時包的是**客戶版** AGENTS.md，客戶解壓看到的也是客戶版）
4. 上傳 R2、通知版本 API
5. 更新 `package.json` version、建立 git tag
6. **推送 commits + tag 到遠端 GitHub**
7. **自動還原 `AGENTS.md` 為開發版**（複製 `docs/agents/AGENTS.dev.md`）並 commit、再推送
8. 清理暫存

> 此機制確保：根目錄 `AGENTS.md` 平常永遠是開發版（你平常看到的），只有在發布瞬間短暫切換成客戶版用於打包，打包完立刻還原。

---

## 核心業務流程

### Payment Flow（金流）
1. 用戶在銷售頁點擊購買
2. Server Action 建立內部訂單並呼叫金流 API（自動依後台設定選擇 Stripe 或 PAYUNi）
3. 用戶被導向付款頁面
4. 金流透過 webhook 通知（Stripe: `/api/webhooks/stripe`，PAYUNi: `/api/payment/notify`）
5. `post-payment-actions.ts` 統一處理：更新訂單狀態、建立 Purchase、寄歡迎信、追蹤事件

### Video Streaming（影片串流）
- **YouTube 模式（預設）**：管理員在後台貼 YouTube URL，前台嵌入播放器
- **Cloudflare Stream 模式（進階）**：後台設定 Stream 憑證後啟用；透過 TUS 協議上傳，Signed URLs 播放
- 觀看進度：`/api/lesson-progress`
- 觀看時間心跳：`/api/watch-time`（每分鐘）

---

## Server Actions 一覽

所有 Server Actions 位於 `lib/actions/`，遵循統一模式：

| 檔案 | 主要函式 | 用途 |
|------|----------|------|
| `settings.ts` | `getSiteSettings`, `updateSiteSettings`, `getAISettings`, `updateAISettings` | 系統設定 CRUD |
| `setup.ts` | `completeSetupStep`, `skipOptionalSetup` | 首次 setup flow |
| `courses.ts` | `createCourse`, `updateCourse`, `deleteCourse`, `publishCourse` | 課程管理 |
| `curriculum.ts` | `createChapter`, `createLesson`, `reorderLessons` | 章節/單元管理 |
| `orders.ts` | `createOrder`, `refundOrder` | 訂單管理 |
| `coupons.ts` | `createCoupon`, `updateCoupon`, `redeemCoupon` | 優惠券管理 |
| `auth.ts` | `signUpWithCredentials`, `loginWithCredentials`, `resetPassword` | 認證流程 |
| `admin.ts` | `promoteUserRole`, `grantCourseAccess`, `revokeCourseAccess` | 用戶權限管理 |
| `ai-course.ts` | `createBulkCurriculum` | AI 批量建立課程 |
| `reviews.ts` | `createReview`, `replyToReview`, `toggleHelpful` | 評價系統 |
| `free-course.ts` | `enrollInFreeCourse` | 免費課程註冊 |
| `media.ts` | `uploadMedia`, `deleteMedia` | 媒體管理 |
| `analytics.ts` | 各類統計查詢 | Dashboard 數據 |

**統一回傳格式**：`{ success: boolean, error?: string, data?: T }`

---

## API Routes 一覽

| 路由 | 用途 | 認證 |
|------|------|------|
| `/api/lesson/stream-url` | 取得影片簽名播放 URL | 登入 + 已購買 |
| `/api/lesson-progress` | 更新課程進度 | 登入 |
| `/api/lesson-comments` | 留言讀寫 | POST 需登入 |
| `/api/watch-time` | 觀看時間心跳 | 登入 |
| `/api/coupon/validate` | 驗證優惠券 | — |
| `/api/payment/create` | 建立付款 session | 登入 |
| `/api/payment/return` | 付款後導回 | — |
| `/api/payment/notify` | PAYUNi webhook | Webhook 驗證 |
| `/api/webhooks/stripe` | Stripe webhook | Webhook 驗證 |
| `/api/webhooks/cloudflare-stream` | 影片轉檔完成回調 | Webhook 驗證 |
| `/api/admin/media/*` | 媒體上傳系列 | Admin |
| `/api/admin/ai-generate-notes` | AI 生成講義 | Admin/Editor |
| `/api/admin/ai-course/generate-content` | AI 字幕轉內容 | Admin/Editor |
| `/api/admin/email/preview` | Email 模板預覽 | Admin |
| `/api/admin/email/test` | 寄送測試信 | Admin |
| `/api/public/site-settings` | 公開站台設定 | — |

---

## 銷售頁系統（Landing Page）

這是本平台最具彈性的設計之一。每個課程都可以擁有完全客製化的銷售頁。

### 運作機制

1. **銷售頁模式**：每個課程可選擇「React 元件」或「自訂 HTML」模式
2. **React 元件模式**（推薦）：
   - 元件放在 `components/main/landing/pages/{slug}.tsx`
   - 透過 `loader.ts` 動態載入
   - 沒有對應元件時，自動 fallback 到 `default.tsx`
3. **自訂 HTML 模式**：直接在後台貼入 HTML，SSR 渲染

### 建立新銷售頁的方式

**最推薦的做法：直接跟 AI 說「替 `{course-slug}` 課程建立一個專屬銷售頁」。**

AI 會自動：
- 在 `components/main/landing/pages/{slug}.tsx` 建立元件
- 在 `loader.ts` 註冊該元件
- 使用平台提供的共用元件（`StickyCTA`、`FreeCourseCTA`、`FAQSection` 等）
- 根據課程性質設計適合的版面與文案

### 銷售頁元件結構

```
components/main/landing/
├── pages/
│   ├── types.ts          # LandingPageProps 型別定義
│   ├── loader.ts         # 動態載入 registry
│   ├── default.tsx       # 預設銷售頁（自動從 DB 資料組裝）
│   └── {slug}.tsx        # 各課程的專屬銷售頁
├── index.ts              # 共用元件匯出
├── hero-section.tsx      # Hero 區塊
├── pricing-section.tsx   # 定價區塊
├── curriculum-preview.tsx # 課程大綱預覽
├── faq-section.tsx       # FAQ 區塊
├── instructor-section.tsx # 講師介紹
├── sticky-cta.tsx        # 浮動購買按鈕
├── free-course-cta.tsx   # 免費課程 CTA
└── auto-enroll-handler.tsx # 自動註冊處理
```

### LandingPageProps 型別

每個銷售頁元件都接收 `LandingPageProps`，包含：
- `course` — 課程完整資料（標題、描述、章節、單元數等）
- `purchaseStatus` — 購買狀態（是否已購買、第一堂課 ID）
- `isLoggedIn` — 是否已登入
- `isFree` / `finalPrice` / `originalPrice` / `isOnSale` — 價格相關
- `shouldAutoEnroll` — 是否自動註冊（免費課程）

### 銷售頁開發慣例

1. **已購買用戶**：顯示簡化 Hero + 課程大綱列表（使用 `PurchasedCurriculumList`）
2. **未購買用戶**：完整銷售頁（Hero → 適合誰 → 課程大綱 → 講師 → FAQ → CTA）
3. **免費課程**：使用 `FreeCourseCTA` 元件；付費課程用 `Link` 導向結帳頁
4. **必須包含 `StickyCTA`**：浮動購買按鈕，確保用戶隨時可以購買
5. **動畫**：使用 `framer-motion` 的 `motion` 元件，搭配 `whileInView` 做滾動觸發

---

## 後台管理系統

### 課程管理流程
1. 新增課程：`/admin/courses/new`
2. 編輯課程資訊：`/admin/courses/[id]/info`（包含銷售頁設定、SEO、定價）
3. 編輯課程內容：`/admin/courses/[id]/curriculum`（章節與單元）
4. 課程列表：`/admin/courses`

### 後台路由一覽
| 路由 | 說明 |
|------|------|
| `/admin` | Dashboard（統計概覽） |
| `/admin/setup` | 首次設定流程（影片、儲存、Email、OAuth） |
| `/admin/courses` | 課程管理 |
| `/admin/courses/[id]/info` | 課程編輯 |
| `/admin/courses/[id]/curriculum` | 章節單元編輯 |
| `/admin/media` | 媒體中心 |
| `/admin/users` | 學員管理 |
| `/admin/orders` | 訂單管理 |
| `/admin/analytics` | 銷售分析 |
| `/admin/settings` | 系統設定（含 AI 模型設定） |

### 前台路由一覽
| 路由 | 說明 |
|------|------|
| `/` | 首頁（課程列表） |
| `/courses` | 所有課程 |
| `/courses/[slug]` | 課程銷售頁 |
| `/courses/[slug]/lessons/[id]` | 課程播放頁（需登入+購買） |
| `/checkout` | 結帳頁 |
| `/my-courses` | 我的課程 |

---

## 開發規範

### 修改程式碼時
- 使用 `@/*` 路徑別名匯入
- Server Actions 放在 `lib/actions/` 目錄
- Zod 驗證放在 `lib/validations/` 目錄
- 前台元件放 `components/main/`，後台元件放 `components/admin/`
- 新的 API Route 放在 `app/api/` 下對應的子目錄
- 檔案上傳統一走 `lib/storage`，不要直寫 R2 / S3 / 本地邏輯

### 樣式規範
- 使用 Tailwind CSS，不使用 CSS Modules
- 品牌色彩由平台擁有者自行定義，定義在 `app/globals.css` 的 CSS 變數中（`--primary`、`--foreground` 等）
- 開發新元件時，**優先使用 CSS 變數**（如 `text-primary`、`bg-primary`），避免寫死 hex 色碼
- 若需要參考現有銷售頁元件的樣式，以該元件實際使用的顏色為準，但理解這些是可被替換的品牌色

### Server Action 規範
- 所有 action 必須加上 `'use server'` 宣告
- 使用 Zod 驗證輸入參數
- 使用 `requireAdminAuth()` 或 `requireOnlyAdminAuth()` 做權限檢查
- 統一回傳 `{ success: boolean, error?: string, data?: T }` 格式
- 資料異動後呼叫 `revalidatePath()` 清除 Next.js 快取
- 重要操作記錄到 `AdminLog`

### 新增功能時的檢查清單
- [ ] 是否有現有模塊可以複用？（AI、Email、金流、媒體、設定儲存）
- [ ] 後台功能是否加了權限檢查？
- [ ] 公開 API 是否加了 rate limiting？
- [ ] 輸入資料是否用 Zod 驗證？
- [ ] 敏感資料（API Key 等）是否儲存在 `SiteSetting` 並加入遮蔽？
- [ ] 檔案上傳是否使用 `lib/storage` 通用 API？
- [ ] 是否需要記錄 AdminLog？
- [ ] 是否需要追蹤事件（PostHog / Meta）？
