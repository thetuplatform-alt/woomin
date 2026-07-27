# 電子報（Newsletter / EDM）功能 — 產品需求書（PRD）

| 項目 | 內容 |
| --- | --- |
| **文件版本** | v1.0（初版） |
| **建立日期** | 2026-06-29 |
| **適用平台** | 通用型線上課程販售平台（Next.js 15 + Prisma 7 + PostgreSQL，買斷原始碼多客戶部署，預設 Zeabur 單實例） |
| **目標市場** | 台灣、香港、澳門（繁體中文，TWD／HKD） |
| **目標讀者** | 開發工程師、QA、產品負責人 |
| **使用者** | 創作者／講師／內容產出者（後台 ADMIN／EDITOR／INSTRUCTOR） |
| **文件狀態** | 待業主確認「§8 開放問題」後定版施工 |

---

## 📑 目錄

0. [文件導讀](#0-文件導讀)
1. [產品總覽](#1-產品總覽)
2. [系統架構與資料模型（統一仲裁）](#2-系統架構與資料模型統一仲裁)
3. [功能需求（八大模組）](#3-功能需求八大模組)
   - 3.1 [核心撰寫體驗](#31-核心撰寫體驗)
   - 3.2 [模板系統](#32-模板系統)
   - 3.3 [排程與發送引擎](#33-排程與發送引擎)
   - 3.4 [促銷與推廣](#34-促銷與推廣)
   - 3.5 [發送對象管理與分眾](#35-發送對象管理與分眾)
   - 3.6 [退訂與法遵](#36-退訂與法遵)
   - 3.7 [送達率與寄信健康](#37-送達率與寄信健康)
   - 3.8 [成效分析與追蹤](#38-成效分析與追蹤)
4. [美術風格與設計語言](#4-美術風格與設計語言)
5. [台港澳法遵專章](#5-台港澳法遵專章)
6. [非功能性需求（NFR）](#6-非功能性需求nfr)
7. [跨領域議題](#7-跨領域議題)
8. [開放問題與待業主決策](#8-開放問題與待業主決策)
9. [開發里程碑](#9-開發里程碑)

---

## 0. 文件導讀

### 0.1 文件目的

本文件定義平台「電子報」功能的完整產品需求與**可逐條驗收的驗收標準（Acceptance Criteria, AC）**，供工程師依此施工、QA 依此驗收。本功能讓創作者**不需離開平台、不需匯出 CSV 到第三方工具**，即可在後台完成「撰寫 → 選模板 → 分眾選收件人 → 法遵與優惠確認 → 預覽 → 排程／立即發送 → 看成效 → 退訂閉環」的完整流程。

### 0.2 範圍與非範圍

| 範圍內（本文件涵蓋） | 範圍外（明確不做或另案） |
| --- | --- |
| 一般電子報、促銷電子報兩大類的撰寫、模板、排程、分眾、發送、追蹤 | 既有交易信（購買確認、密碼重設、到期提醒、私訊通知）的改版——僅在「同意守門」處與之協調 |
| 行銷同意（opt-in）、退訂機制、台港澳法遵地基 | SMS／站內推播／LINE／App Push 等非 Email 管道 |
| 開信／點擊追蹤、成效報表、購買轉換歸因 | 完整的 CRM／自動化行銷工作流（行為觸發序列為 P2） |
| 地區／語言分眾的**欄位前置**與降級策略 | 台港澳雙幣別自動分版（依賴新欄位，列 P2） |

### 0.3 優先級定義

| 標籤 | 意義 | 說明 |
| --- | --- | --- |
| **MVP** | 最小可上線 | 缺它則功能無法合法或可靠運作。法遵地基與發送引擎屬此級 |
| **P1** | 第一波增強 | 顯著提升價值，MVP 穩定後立即排入 |
| **P2** | 後續迭代 | 錦上添花或依賴尚未具備的前置條件 |

### 0.4 驗收標準閱讀方式

- 每條 AC 採 **Given／When／Then** 結構，客觀可測；QA 可逐條勾選。
- AC 類別圖示：⚙️ 功能｜🔲 邊界｜⚠️ 錯誤處理｜🔐 權限｜⚖️ i18n／法遵｜⚡ 效能｜🛡️ 資安。
- 編號規則：需求 `<模組碼>-NN`（如 `WRITE-01`）；驗收標準 `AC-<模組碼>-NN`。模組碼見 §3 各節標頭。

> **本文件的最高原則**：法遵地基（同意／退訂）與可靠發送引擎是一切的地基，必須**先於**任何美化與促銷功能落地。在台灣個資法、香港 PDPO、澳門第 8/2005 號法律下，對未同意者寄送促銷信可能涉及刑責；任何「先做漂亮的編輯器、法遵之後補」的順序都是錯的。

---

## 1. 產品總覽

### 1.1 背景與問題

創作者目前若要寄電子報，必須把學員名單匯出到 Mailchimp／ConvertKit 等外部工具，造成：資料外流風險、名單與購買狀態脫節、無法用「買過哪門課／學習進度」精準分眾、退訂狀態與平台不同步。本功能把電子報原生內建到課程平台，讓**學員資料、購買行為、優惠券、發送與退訂**形成單一閉環。

### 1.2 目標使用者

創作者／講師／內容產出者，多為**非工程師、單兵作業、台港澳繁中**使用者。他們最在意兩件事：

1. **可信賴**——「這封信會寄給誰？會不會誤寄？會不會違法？」
2. **開箱即美**——「寄出去的信好不好看、會不會丟臉？」

設計與功能必須同時回應這兩點。

### 1.3 兩大電子報類型

| 維度 | 一般電子報（GENERAL） | 促銷電子報（PROMO） |
| --- | --- | --- |
| **定位** | 關係維繫、教學內容、公告、開課通知 | 直接促銷：賣課、限時優惠、加價購、棄課喚回 |
| **法遵性質** | 關係維繫（台灣可基於既有關係，香港從嚴） | 直接促銷（台港澳皆需明確 opt-in） |
| **同意模型** | opt-out（`generalEmailConsent` 預設 true；香港地區用戶從嚴） | **opt-in**（`marketingConsent` 必須明確為 true，NULL／false 皆不可寄） |
| **品牌主色** | 靛藍 `--primary #6366F1`（沉穩、教學感） | 琥珀 `--cta #F5A524`（行動、限時、成交感） |
| **專屬區塊** | 標題／段落／圖片／按鈕／分隔／影片卡 | 以上 + 課程卡、優惠券區塊、靜態倒數 |
| **核心指標** | 開信率、點擊率、CTOR、退訂率、投訴率 | 歸因訂單數、歸因營收、RPE、優惠券使用 |
| **發送門檻** | 頁尾退訂連結 + 寄件人實體資訊 | 以上 + opt-in 收件人數 > 0 + 優惠券有效性檢查 |

> **關鍵法律界線**：類型由**信件內容是否含直接促銷**決定，**不是**由創作者自我分類。香港 PDPO 對「直接促銷」定義極廣——一般電子報若夾帶任何課程銷售連結／優惠／開課推廣，即被認定為直接促銷，必須走 PROMO 的 opt-in 門檻。系統須在偵測到促銷內容（優惠券碼／購買連結／促銷字樣）時提示升級類型（見 `AC-DELIV-16`）。

### 1.4 成功指標

- 創作者可在 10 分鐘內完成第一封電子報並寄出測試信。
- 數萬人名單可靠送達、容器重啟不重寄不漏寄。
- 對未同意促銷者的促銷信誤寄率 = **0**（程式層強制，不可繞過）。
- 每一封信皆含可運作退訂連結與合規頁尾，零例外。

---

## 2. 系統架構與資料模型（統一仲裁）

> ⚠️ **這是動工前的第一步（里程碑 Phase 0）。** 對弈中 8 個主題各自提出了互相衝突的核心模型名（`Campaign` / `EmailCampaign` / `NewsletterCampaign`、`CampaignRecipient` / `NewsletterRecipient`、`MarketingConsent` / `UserEmailConsent` / `User` 層欄位）。**本節為唯一事實來源，所有模組一律採用以下命名**；若不先仲裁，會做出三套打架的資料表。

### 2.1 資料模型一覽（最終命名）

| 模型／欄位 | 用途 | 關鍵欄位 |
| --- | --- | --- |
| **`NewsletterCampaign`** | 電子報活動主體（草稿→發送） | `id`、`type`(GENERAL\|PROMO)、`name`(內部名稱)、`subject`、`preheader`、`contentJson`(區塊 schema)、`bodyHtml`(發送快照)、`bodyText`、`templateId?`、`status`、`scheduledAt`(UTC)、`timezone`、`senderName`、`replyTo`、`segmentJson`、`couponId?`、`attributionWindowDays`(預設7,僅PROMO)、`ratePerMinute`、`senderSnapshot`(JSON,鎖定當時 transport 設定)、`sentCursor`、統計欄位(`totalRecipients`/`sentCount`/`failedCount`/`skippedCount`/`openCount`/`clickCount`/`unsubCount`)、`createdById`、`snapshotAt`、`createdAt`、`updatedAt` |
| **`NewsletterRecipient`** | 逐收件人發送與互動記錄 | `id`、`campaignId`、`userId?`、`toEmail`(正規化小寫)、`toName?`、`status`(PENDING\|SENT\|FAILED\|SKIPPED\|BOUNCED)、`skipReason?`、`bounceType?`、`providerMessageId?`、`attemptCount`、`openedAt?`、`firstClickedAt?`、`unsubscribedAt?`、`isTest`、`sentAt?`。**冪等鍵**：`@@unique([campaignId, userId])` 與 `@@unique([campaignId, toEmail])` |
| **`NewsletterTemplate`** | 模板（內建版型 + 自訂另存） | `id`、`type`、`name`、`contentJson`、`isBuiltIn`、`createdById?` |
| **`NewsletterLink`** | 點擊追蹤的連結對應（P1） | `id`、`campaignId`、`token`、`targetUrl`(存 DB 防 Open Redirect)、`clickCount`、`uniqueClickCount` |
| **`User`（擴充欄位）** | 同意與退訂的單一事實來源 | `marketingConsent`(Boolean? 預設 null)、`marketingConsentAt`、`marketingConsentSource`、`marketingConsentIp`(末段匿名化)、`generalEmailConsent`(Boolean 預設 true)、`generalEmailConsentAt`、`unsubscribedAt`(全退訂)、`emailInvalidAt`(hard bounce)、`emailBounceState`(NONE\|SOFT_SUSPENDED\|HARD_BOUNCED\|COMPLAINED)、`emailBounceCount`、`locale?`、`country?` |
| **`EmailConsentLog`** | append-only 同意／退訂舉證稽核 | `id`、`userId`、`consentType`(GENERAL\|MARKETING)、`action`(GRANTED\|REVOKED)、`source`(register\|checkout\|landing_optin\|admin_import\|double_optin\|reconfirm\|unsubscribe_page)、`ip`(匿名化)、`market`(TW\|HK\|MO)、`termsVersion`、`campaignId?`、`createdAt` |

> **退訂 token 不建表**：採 HMAC-SHA256 簽章，`token = HMAC(NEWSLETTER_UNSUBSCRIBE_SECRET, userId + ':' + email + ':' + scope)`，`scope ∈ {all, marketing, general}`。永久有效、不存 DB、以驗算判定。secret 為**獨立環境變數**，禁用 `NEXTAUTH_SECRET`（見 `AC-CONSENT-07/08`）。

### 2.2 發送狀態機

```
DRAFT ──排程──▶ SCHEDULED ──到期(cron 原子轉換)──▶ QUEUED ──▶ SENDING ──┬─全成功─▶ SENT
  │                                                          │           ├─部分失敗─▶ PARTIAL_FAILED
  └──立即發送(經確認)────────────────────────────────────────┘           └─全失敗──▶ FAILED
                                          SENDING ◀─恢復─ PAUSED ◀─暫停／退信率超標自動暫停
            任一非終態 ──取消──▶ CANCELLED
```

- 所有狀態轉換以 **DB 原子更新**（`UPDATE ... WHERE status = <expected> RETURNING`）執行，防 race condition 與連點重送。
- 終態（SENT／FAILED／CANCELLED）不可回退；嘗試回退一律拒絕並記 AdminLog。

### 2.3 信件類型 × 同意層級 × 可退訂 對照表（全平台單一守門）

> critic 指出：平台已有多種交易信／系統信，新的同意機制必須與既有信協調，避免交易信被誤套退訂、或促銷信漏掉同意檢查。守門統一由 `assertEmailConsent(userId|email, type)` 執行，**插入點在業務層（呼叫寄信之前），絕不可放進 transport 層或 `sendCustomHtmlEmail` 內部**，以免誤殺交易信。

| 信件 | 性質 | `type` | 同意層級 | 可退訂 | 走電子報引擎 |
| --- | --- | --- | --- | --- | --- |
| 購買確認、發票、退款 | 交易性 | `transactional` | 永遠可寄（唯一例外 hard bounce） | ✗ | ✗（既有 `lib/email.ts`） |
| 密碼重設、帳號啟用／邀請 | 交易性 | `transactional` | 同上 | ✗ | ✗ |
| 課程到期提醒、作業批改通知 | 交易性／關係 | `transactional` | 同上 | ✗ | ✗ |
| 私訊回覆通知 | 交易性 | `transactional` | 同上 | ✗ | ✗ |
| **一般電子報**（月報／教學／公告／開課通知） | 關係維繫 | `general` | `generalEmailConsent` opt-out（香港從嚴） | ✓（一般） | ✓ |
| **促銷電子報**（賣課／優惠／加價購） | 直接促銷 | `marketing` | `marketingConsent` **opt-in**（NULL=不可寄） | ✓（促銷） | ✓ |
| Double opt-in 確認信 | 交易性（純確認） | 特例 | 僅含確認連結、無促銷內容 | ✗ | 特例 |

`assertEmailConsent` 規則：
- `transactional` → 永遠 `allowed:true`（唯一例外：`emailInvalidAt != null` 的 hard bounce 帳號一律 false）。
- `general` → `generalEmailConsent === true && unsubscribedAt == null`。
- `marketing` → `marketingConsent === true && unsubscribedAt == null`（**NULL／false 皆 false**）。
- 被擋下時寫 `NewsletterRecipient.status = SKIPPED` 並記 `skipReason`。

### 2.4 角色權限矩陣

> critic 指出整份規格從未定義三角色的細部權限。以下為**建議預設**，標注 ⚠️ 者列入 §8 待業主確認。既有 `requireAdminAuth()` 只分 ADMIN／EDITOR，INSTRUCTOR 在電子報語境需新增權限層。

| 動作 | ADMIN | EDITOR | INSTRUCTOR |
| --- | :---: | :---: | :---: |
| 撰寫／編輯草稿 | ✓ | ✓ | ✓（僅自己建立的） |
| 發送一般電子報 | ✓ | ✓（ADMIN 可設限） | ✓（僅限自己課程的學員）⚠️ |
| 發送促銷電子報 | ✓ | ✓（可設定） | 預設限自己課程學員 ⚠️ |
| 選擇全站學員為對象 | ✓ | ✓ | ✗（後端強制限縮） |
| CSV 外部名單匯入 | ✓ | ✓（可設定） | ✗ |
| 覆蓋／修改同意狀態 | ✓（僅 ADMIN，且記 AdminLog + 法律風險警示） | 唯讀 | ✗ |
| 查看成效報表與學員 email | ✓ | ✓ | 僅自己的 campaign |
| 系統設定（寄件人、網域、速率） | ✓ | ✗ | ✗ |
| 手動觸發發送 cron（測試） | ✓ | ✗ | ✗ |

- 所有後台路由經 `middleware.ts` 與 `requireAdminAuth()` 保護；USER 角色一律 403。
- INSTRUCTOR 的收件人範圍由**後端強制**限縮為其課程的 `Purchase` 用戶，UI 限制不足以採信（見 `AC-PROMO-06`）。

### 2.5 複用既有基礎設施對照

| 需求 | 複用既有 | 需新建 |
| --- | --- | --- |
| 寄信傳輸 | `lib/email-transport.ts`（Resend／ZSend／SMTP）、`lib/email.ts` `sendCustomHtmlEmail()` | 擴充 `EmailPayload` 加 `text?` 與 `headers?`（List-Unsubscribe） |
| 模板樣式／防注入 | `lib/email-templates.ts` `escapeHtml()`／`getEmailBranding()`／container/footer 樣式 | 區塊渲染器 `renderCampaignHtml()`；修正 legacy 棕色按鈕 |
| 大量發送並發 | `lib/utils/concurrency.ts` `runWithConcurrency()` | **時間軸速率層**（Token Bucket，並發≠速率） |
| 排程 | `/api/cron/*` 模式 + `CRON_SECRET` + course-expiration 的 500 筆/60 秒/防重送 | Zeabur 友善的觸發方案（見 §3.3） |
| 發送記錄 | `EmailDeliveryLog`（**僅交易信，不動**） | `NewsletterRecipient`（電子報專用，獨立冪等鍵） |
| 設定儲存 | `SiteSetting` + `SETTING_KEYS` + `SENSITIVE_SETTING_KEYS` | 新增電子報相關 keys |
| 優惠券 | `Coupon` / `CouponRedemption` | 促銷信綁定與防超賣 |
| 稽核 | `AdminLog` | 統一電子報操作記錄規範 |
| 編輯器 | 評估沿用 `milkdown-editor.tsx`（富文字）或新建區塊編輯器（見 §3.1 開放問題） | — |
| 後台 UI | `StatCard`／`StickySaveBar`／`Badge`／`Table`／`Pagination`／`Filters`／`Dialog`／`Sonner`／`Select`／`Switch`／`Tabs`／`Sheet`／`Checkbox` | 三欄撰寫畫布、分眾建構器 |

### 2.6 客戶升級資料遷移

> 平台為買斷原始碼多客戶部署，**既有客戶 DB 皆以 `db push` 建立（無 migration 歷史，直接 `migrate deploy` 會撞 P3005）**。新增 5+ 張電子報表與 `User` 新欄位的 schema 變更，**必須走既有 `scripts/prisma-migrate-deploy.cjs` 的 baseline + 冪等化機制**，確保既有客戶升級不炸庫。所有新 migration 須冪等（可重複執行）。

---

## 3. 功能需求（八大模組）

> 每個模組包含：**概述 → 一般／促銷差異 → 需求表 → 驗收標準**。模組碼：`WRITE`(撰寫)、`TMPL`(模板)、`SEND`(發送引擎)、`PROMO`(促銷)、`AUD`(分眾)、`CONSENT`(退訂法遵)、`DELIV`(送達率)、`ANALYTICS`(成效)。

### 3.1 核心撰寫體驗

**模組碼：`WRITE`**　聚焦「撰寫到送出前」的體驗：區塊式編輯、即時真實預覽、草稿、測試信、主旨／前置文字。

**核心技術決策（單軌渲染）**：編輯器右側預覽、測試信、正式信三者**共用同一段 HTML 渲染邏輯**（`renderCampaignHtml()`），杜絕「測試信長得跟正式信不一樣」的經典雷。`contentJson` 區塊 schema 是唯一事實來源。

**一般 vs 促銷差異**：

- 一般電子報：可用區塊為標題／段落／圖片／按鈕／分隔線／影片卡；CTA 預設靛藍 `#6366F1`；送出前法遵閘門較輕（強制頁尾退訂 + 寄件人實體地址）。
- 促銷電子報：額外解鎖**課程卡**（從 `Course` 選取，自動帶封面／課名／`finalPrice`／連結，禁手打）、**優惠券區塊**（從 `Coupon` 選取，自動帶 code／到期，禁手打券碼）、**靜態倒數**（純文字「優惠截止：YYYY/MM/DD HH:mm（台北）」，不做動態 GIF）；CTA 預設琥珀 `#F5A524`；送出前法遵閘門最嚴（opt-in 收件數 > 0 + 優惠券有效性即時校驗）。

#### 需求清單

| ID | 優先級 | 需求 | 說明與複用 |
| --- | --- | --- | --- |
| `WRITE-01` | **MVP** | 區塊式 WYSIWYG 編輯器 | 區塊以「+」單層選單新增、拖拉排序、刪除／複製／上下移；段落支援粗體／斜體／連結／清單；按鈕可設文字／URL／顏色（依類型自動靛藍或琥珀）／對齊；支援 ⌘Z／⌘⇧Z。放 `components/admin/newsletter/`。複用 shadcn Dialog/Select/Switch/Tabs/Sheet、Sonner、設計 token |
| `WRITE-02` | **MVP** | 單軌 email HTML 渲染器 | 純函式 `renderCampaignHtml(content, {branding, recipientContext, mode})`：table-based layout、全 inline style、container 600px、不依賴 `<style>`／flex／grid、圖片帶固定寬度屬性。**唯一渲染路徑**，禁止任何第二條。複用 `escapeHtml()`／`getEmailBranding()`／container/footer 樣式 |
| `WRITE-03` | **MVP** | Email HTML 相容性護欄 | 渲染後 HTML **>102KB 時阻擋或明確警告**（Gmail 裁切門檻）；附「支援／不支援客戶端」清單（Gmail Web/App、Apple Mail、iOS Mail、Outlook 2019+，Outlook 不支援 background-image／flex）；圖片須絕對公開 URL（本地 volume 模式輸出 `SITE_URL` 絕對路徑）。**critic 補充項** |
| `WRITE-04` | **MVP** | HTML sanitize（防 XSS／注入） | 所有外發 HTML（含後台 HTML 模式與 merge tag 結果）經 server-side 白名單 sanitizer（如 sanitize-html／DOMPurify），移除 `<script>`／`on*` 事件／外部表單；不可僅靠 `escapeHtml()` |
| `WRITE-05` | **MVP** | 自動產生純文字版 | 每封 HTML 自動產生 `bodyText`（去標籤、保留段落、連結轉「文字 [URL]」），附於 `multipart/alternative` 提升送達信任；後台可預覽與覆蓋。需擴充 `EmailPayload` 加 `text?` |
| `WRITE-06` | **MVP** | 桌機／手機即時真實預覽 | 右側固定面板，sandbox iframe 渲染**真實** email HTML（非 CSS 模擬），切換桌機 600px／手機 375px；debounce 即時更新；頂部模擬寄件人＋主旨＋preheader 截斷列 |
| `WRITE-07` | **MVP** | 草稿自動儲存（單一最新快照） | 變動後 debounce 5 秒、每 30 秒輪詢自動存；頂端顯示「已於 HH:mm 儲存草稿」；離開頁面有未存變更跳 beforeunload。MVP 不做版本歷史（P2）。注意 StickySaveBar dirty 追蹤陷阱與 interval 生命週期 |
| `WRITE-08` | **MVP** | 並發編輯鎖定／衝突偵測 | 多角色後台並存時，兩人同編一封、或一人編輯時另一人按發送，須有鎖定或衝突偵測（如 `updatedAt` 樂觀鎖），避免互相覆蓋或發出半成品。**critic 補充項** |
| `WRITE-09` | **MVP** | 複製既有電子報 | 一鍵複製整份（含 `contentJson`／`senderName`／`segmentJson`／`type`），複本 `status=DRAFT`、主旨加「副本」、清空發送記錄關聯；記 AdminLog |
| `WRITE-10` | **MVP** | 促銷專屬區塊 | 課程卡／優惠券區塊／靜態倒數（見上「促銷差異」）；僅 `type=PROMO` 時於工具列出現；優惠券區塊插入時與送出前各校驗一次有效性 |
| `WRITE-11` | **MVP** | 主旨與 Preheader 輔助 | 主旨即時字元計數：>50 字變黃、>70 變紅；Preheader 提示建議 85–100 字；即時反映到預覽收件匣模擬列 |
| `WRITE-12` | **MVP** | 測試信 | 與正式信**同一渲染路徑**，頂部加「這是測試信」banner、頁尾仍含退訂與地址；**僅可寄給 ADMIN/EDITOR/INSTRUCTOR 內部帳號**（防被當免費 relay）；不計入信譽／配額統計；受 rate-limit。複用 `sendCustomHtmlEmail`、`EmailDeliveryLog` |
| `WRITE-13` | **MVP** | 發送前確認對話框與法遵閘門 | 顯示主旨、類型、寄件人、預估收件人數、3–5 個去識別化抽樣收件人（如「Ray C.」）；促銷信後端 COUNT opt-in 收件數，為 0 則在開框前攔截；寄件人實體地址未填則阻擋；確認後 DRAFT→交付並防雙擊 |
| `WRITE-14` | **P1** | 區塊圖片上傳 | 走 `lib/storage` 通用 API 回傳絕對公開 URL；上傳進度條；提示本地模式須掛 persistent volume |
| `WRITE-15` | **P1** | merge tag 個人化 | 段落／主旨／preheader 可插入 `{{name}}`／`{{course_name}}` 等，工具列點選插入；預覽以樣本資料填充；逐人替換由發送引擎處理（逐封送，見 §3.3） |

#### 驗收標準

- [ ] **AC-WRITE-01** ⚙️ Given 一封 GENERAL 含標題／段落／按鈕／分隔／影片卡｜When 於右側預覽｜Then 以 iframe 渲染 table-based + 全 inline style HTML，container 600px，**不含** `<style>`／flex／grid。
- [ ] **AC-WRITE-02** ⚙️ Given `type=PROMO` 編輯中｜When 開「+」選單｜Then 出現課程卡／優惠券／倒數三區塊；切回 GENERAL 後此三區塊消失。
- [ ] **AC-WRITE-03** ⚙️ Given 插入優惠券區塊並選一張券｜When 區塊渲染｜Then 自動帶入 code／折扣／到期，券碼欄位**唯讀不可手打**。
- [ ] **AC-WRITE-04** 🔲 Given 編輯器有未儲存變更｜When 停止變動滿 5 秒或距上次儲存達 30 秒｜Then 自動儲存，頂端顯示「已於 HH:mm 儲存草稿」，且僅保留單一最新快照。
- [ ] **AC-WRITE-05** 🔲 Given 主旨輸入框｜When 長度超過 50／70 字元｜Then 計數分別轉黃／轉紅，更新延遲 < 300ms。
- [ ] **AC-WRITE-06** ⚠️ Given 編輯器有未儲存變更｜When 嘗試關閉分頁／重整／路由離開｜Then 觸發確認對話框，取消則停留、確認才離開。
- [ ] **AC-WRITE-07** ⚙️ Given 複製一封含 8 區塊的促銷信｜When 複製完成進入編輯｜Then 完整保留區塊與 `segmentJson`，`status=DRAFT`，主旨含「副本」，不繼承任何發送記錄。
- [ ] **AC-WRITE-08** ⚙️ Given 編輯內容後寄測試信｜When 比對測試信與後續正式信 HTML｜Then 兩者由同一 `renderCampaignHtml` 產出，除測試 banner 與 merge 樣本值外位元組層級一致，且測試信頂部有「這是測試信」banner。
- [ ] **AC-WRITE-09** 🔐 Given 測試信收件框填入非平台用戶或 USER 角色 email｜When 點寄送｜Then 拒絕並提示僅能寄給 ADMIN/EDITOR/INSTRUCTOR 帳號。
- [ ] **AC-WRITE-10** 🛡️ Given 測試信功能｜When 寄出測試信｜Then 該收件人 `isTest=true`，不計入開信率／點擊率／信譽／配額，且主旨可辨識為測試。
- [ ] **AC-WRITE-11** 🛡️ Given 段落或主旨輸入含 `<script>` 或 `<img src="http://evil">`｜When 渲染為 email HTML｜Then 經 sanitize 後輸出不含 `<script>`／`on*` 事件／外部惡意資源，測試信原始碼亦無上述內容。
- [ ] **AC-WRITE-12** 🔲 Given 一封信渲染後 HTML 超過 102KB｜When 進入發送前檢查｜Then 顯示阻擋或明確警告（Gmail 會裁切），提示精簡內容。
- [ ] **AC-WRITE-13** ⚙️ Given 一封含 HTML 的信｜When 發送｜Then payload 同時含自動產生的純文字版（保留段落、連結轉「文字 [URL]」），後台可預覽覆蓋。
- [ ] **AC-WRITE-14** ⚠️ Given 促銷信含已達 `maxRedemptions` 或已過 `expiresAt` 的券區塊｜When 點發送｜Then 阻擋並提示該券失效需更換，campaign 維持 DRAFT。
- [ ] **AC-WRITE-15** 🔐 Given EDITOR 登入｜When 建立／編輯／複製草稿並觸發發送｜Then 皆允許，但每次發送寫入 AdminLog（含 `adminId`、`ipAddress`）。
- [ ] **AC-WRITE-16** ⚖️ Given 寄件人實體地址（系統設定）未填｜When 點發送或排程｜Then 在確認對話框前即阻擋並提示先填地址，campaign 不進入發送。
- [ ] **AC-WRITE-17** ⚖️ Given 任一封信（含一般信）渲染輸出｜When 檢視頁尾｜Then 必含唯一不可猜測 token 的退訂連結與寄件人實體地址，繁中文案，GENERAL／PROMO 皆有。
- [ ] **AC-WRITE-18** ⚠️ Given 兩個編輯者同時編輯同一封草稿｜When 後者儲存｜Then 系統偵測衝突（樂觀鎖），提示內容已被他人變更而非靜默覆蓋。
- [ ] **AC-WRITE-19** ⚡ Given 一封含 20 區塊的信｜When 內容變動觸發即時預覽｜Then 經 debounce 後 500ms 內完成重渲染，連續輸入不每字元重渲染。
- [ ] **AC-WRITE-20** 🔲 Given 本地 volume 模式上傳大圖｜When 上傳中｜Then 顯示進度條，完成後使用 `SITE_URL` 起始的絕對公開 URL（非需 auth 的相對路徑）。
- [ ] **AC-WRITE-21** ⚙️ Given 發送確認對話框｜When 開啟｜Then 顯示主旨、類型、寄件人、預估人數及 3–5 個去識別化抽樣收件人；人數為 0 時於確認前即攔截並說明。
- [ ] **AC-WRITE-22** ⚙️ Given 在區塊編輯器按 ⌘Z 後再按 ⌘⇧Z｜When 操作｜Then 分別正確復原與重做最近一次區塊層級操作。

---

### 3.2 模板系統

**模組碼：`TMPL`**　讓不懂 email marketing 的創作者「選版型 → 換文字／圖片 → 發送」，不必從白紙開始。

**MVP 範圍仲裁**：採「**固定版型 + 變數插值**」，**不做**第三方拖拉式 Block Editor（Unlayer／Stripo 有授權費，列 P2/P3）。版型由平台維護者確保跨客戶端相容。

**一般 vs 促銷差異**：

- 一般版型：學習月報、新單元通知、學員故事、開課公告、純文字。
- 促銷版型：限時折扣、早鳥、加價購、棄課喚回；含價格區塊與優惠券框。
- 選版型時即明示對應的**同意門檻與預設排除規則**，避免創作者把促銷內容塞進關係信。

#### 需求清單

| ID | 優先級 | 需求 | 說明與複用 |
| --- | --- | --- | --- |
| `TMPL-01` | **MVP** | 內建版型庫（雙類別分流） | GENERAL／PROMO 各提供固定版型；選版型時明示同意門檻與排除規則。版型一律 table-based、字體 ≥16px、行高 ≥1.6、container 600px。複用 `lib/email-templates.ts` 共用樣式 |
| `TMPL-02` | **MVP** | 個人化變數插值引擎 + Fallback | 支援 `{{學員姓名}}`／`{{課程名稱}}`／`{{優惠碼}}`／`{{優惠到期時間}}`／`{{課程進度}}`／`{{繼續學習連結}}`；每變數有來源說明與可自訂 fallback（姓名 null→「同學」）；輸入「{{」彈出自動補全；插值經 `escapeHtml`；逐收件人 server-side render |
| `TMPL-03` | **MVP** | 品牌自動套用 | Logo／主色／頁尾一律從 `SiteSetting`（`getEmailBranding`）注入，**禁止模板寫死**；修正既有 `buttonStyles` 的 legacy 棕 `#78573c`，新模板用品牌靛藍／琥珀 |
| `TMPL-04` | **MVP** | 變數到期時間在地化 | `{{優惠到期時間}}` 以台港可讀繁中格式顯示（例「2026 年 12 月 31 日 晚上 11:59」），不顯示 ISO／UTC 原始字串 |
| `TMPL-05` | **P1** | 另存為自訂模板 | 創作者可把編好的信另存為 `NewsletterTemplate`（帶 `type`），供日後複用；促銷序列三封同骨架的救命功能 |
| `TMPL-06` | **P1** | 寄件人品牌一次設定 | 系統設定新增「Email 品牌」：寄件人名稱、Reply-To、署名、簡介、大頭照、實體地址；發信自動帶入、可臨時覆寫。複用 `SiteSetting` + `SETTING_KEYS` |
| `TMPL-07` | **P2** | 可重用內容區塊庫 | 常用區塊（講師簡介、社群連結列、CTA 組）存成可重用片段 |

#### 驗收標準

- [ ] **AC-TMPL-01** ⚙️ Given 已選好一般版型｜When 在編輯器輸入「{{」｜Then 彈出變數自動補全選單，每項顯示變數來源與 fallback 說明，選定後以 token 形式插入。
- [ ] **AC-TMPL-02** ⚙️ Given 一封含 `{{學員姓名}}`／`{{課程名稱}}` 的信對 1 名收件人發送｜When 送達 Gmail Web／Apple Mail／iPhone Mail｜Then 三環境變數皆替換為真實值，全文不存在任何 `{{` 或 `}}`。
- [ ] **AC-TMPL-03** 🔲 Given 某收件人 `name` 為 null 或空｜When 渲染 `{{學員姓名}}`｜Then 輸出 fallback（預設「同學」），且發送前預覽該收件人旁標示「將使用 fallback 值」。
- [ ] **AC-TMPL-04** ⚙️ Given 任一內建版型｜When 渲染輸出｜Then Logo／主色／頁尾皆取自 `SiteSetting`，原始碼中無寫死的 `#78573c` legacy 棕色。
- [ ] **AC-TMPL-05** ⚖️ Given 渲染 `{{優惠到期時間}}`｜When 收件人檢視｜Then 顯示繁中可讀格式（例「2026 年 12 月 31 日 晚上 11:59」），不出現 `2026-12-31T23:59:59Z`。
- [ ] **AC-TMPL-06** 🛡️ Given 變數值（姓名／課程名）含 HTML／script｜When 渲染進信件｜Then 經 `escapeHtml` 轉義，不產生可執行標籤。
- [ ] **AC-TMPL-07** ⚙️ Given 選擇一個促銷版型｜When 進入編輯｜Then 介面明示「此類型僅寄給已同意行銷者」並顯示對應排除規則。
- [ ] **AC-TMPL-08** ⚙️ Given 把一封編好的信另存為模板（P1）｜When 之後新建信並選用該模板｜Then 完整載入其 `contentJson` 與 `type`，可再編輯。

---

### 3.3 排程與發送引擎

**模組碼：`SEND`**　本模組是整個功能**工程量最大、風險最高**的核心。架構採「**調度／執行角色分離**」：cron 只負責 `SCHEDULED→QUEUED` 的原子狀態轉換與心跳補救，實際發送由**可被打斷、可從斷點恢復**的批次引擎執行，以解決 Zeabur 60 秒 API 逾時與容器重啟。

> 🚨 **Zeabur 排程是被反覆點名的最大技術風險。** 平台預設部署於 Zeabur，**沒有 Vercel Cron**，現有 `/api/cron/*` 在 Zeabur 不會自動觸發。本模組必須在動工前敲定一個**在 Zeabur 單實例上實測可運行**的觸發方案，否則發送引擎會在客戶站上「不會自己跑」。

**Zeabur 觸發方案（需 Phase 2 拍板，見 §8）**：
- **方案 A（建議 MVP）**：Zeabur 內建 cron service 每分鐘打 `/api/cron/newsletter-dispatch`（帶 `CRON_SECRET`），endpoint 在 60 秒批次窗內處理一批，跑不完保持狀態等下次。最 Zeabur 友善。
- **方案 B（進階）**：常駐 worker 容器輪詢 DB job queue（打包時附 Zeabur 範本）。
- **方案 C（降級）**：外部排程器（如 cron-job.org）打 endpoint。
- **健康檢查**：記錄 `lastCronHeartbeatAt`；排程設定畫面偵測心跳缺失時警告「排程引擎似乎未啟動」（見 `AC-SEND-19`）。

**一般 vs 促銷差異**：發送引擎本身對兩類一致；差異在**發送前合規過濾**——促銷信額外排除未給 `marketingConsent` 者（見 §3.6）。

#### 需求清單

| ID | 優先級 | 需求 | 說明與複用 |
| --- | --- | --- | --- |
| `SEND-01` | **MVP** | 調度／執行分離的排程引擎 | cron 原子地把到期 `SCHEDULED→QUEUED`（`UPDATE ... WHERE status='SCHEDULED' AND scheduledAt<=now() RETURNING`，避免邊界重複觸發）；再撿 QUEUED 與心跳逾時的 SENDING，跑受 60 秒限制的批次窗（每批上限 N，沿用 course-expiration 的 500 筆模式）；`sentCursor`／`lastHeartbeatAt` 存 DB **絕不放記憶體** |
| `SEND-02` | **MVP** | 斷點續發與冪等 | 發送前全部 `NewsletterRecipient` 以 PENDING 落庫；逐封發送前查冪等鍵（`@@unique[campaignId,userId]`／`[campaignId,toEmail]`）跳過已 SENT；容器重啟後從 PENDING 續跑、不重寄；DB unique constraint 為最後防線 |
| `SEND-03` | **MVP** | 真正的速率節流（Token Bucket） | `runWithConcurrency` 只控並發 ≠ 每分鐘 N 封。實作時間軸速率限制：每分鐘最多 N 封（跨批次窗用 DB 記錄本分鐘已發數）；發送前檢查 provider 每日／每秒配額（如 Resend 免費 100/日）不足則阻止或警告，**避免炸配額連帶交易信失效** |
| `SEND-04` | **MVP** | 狀態機保護（原子轉換／防連點／不可逆） | 所有轉換用 DB 原子操作防 race 與連點兩次「立即發送」；已 SENT／終態不可改回 DRAFT／SCHEDULED，嘗試回傳明確錯誤並記 AdminLog |
| `SEND-05` | **MVP** | 暫停／取消／恢復 | 暫停：每批前查 status，PAUSED 則停發新批（當前批不中斷單封）；取消：剩餘不發、已發保留；恢復：從 cursor 續發不重送 |
| `SEND-06` | **MVP** | 時區正確（UTC 儲存、雙時區顯示） | `scheduledAt` 一律 UTC 存；後台日期選擇器用 date-fns-tz／Day.js **鎖定選定時區**（Asia/Taipei／Hong_Kong／Macau／UTC），不可讓 `datetime-local` 讀瀏覽器本地時區造成跨夜誤差；清單與確認 modal 永遠同時顯示「設定時區時間 + UTC」 |
| `SEND-07` | **MVP** | 發送『當下』即時過濾 | 每批開始前**重新查**退訂／同意／分眾條件，不靠建立時快照；campaign 在 QUEUED／SENDING 中後來才退訂者，後續批次必須 SKIPPED。解決「快照 vs 重算」的法遵一致性。**critic 補充項** |
| `SEND-08` | **MVP** | 靜默失敗防護與告警 | 任何失敗（ESP 拒絕／429／連線中斷）必在 Recipient／Campaign 留明確 FAILED 與 `errorMessage`；失敗率 >10% 或 provider 全失敗時，5 分鐘內以**後台 Bell 通知 + 寄信給 ADMIN 雙通道**告警；告警通道不可僅依賴正在失效的 Email 服務 |
| `SEND-09` | **MVP** | 發送中即時進度 | 後台每 30 秒輪詢顯示「已發 X/Y（Z%）、預計剩餘 N 分、本批退信數、失敗數」；因 cron 間隔為「近即時」需誠實標示 |
| `SEND-10` | **MVP** | `senderSnapshot` 鎖定 | `getEmailTransport()` 有 5 分鐘快取；campaign 進入 SENDING 前 snapshot 當時 transport 設定，避免發送途中換 provider 用到錯設定 |
| `SEND-11` | **P1** | 失敗重試（指數退讓 ×3）與補寄 | 每封失敗自動重試 ≥3 次（間隔 1／5／15 分）；campaign 完成後失敗名單可一鍵補寄（補寄仍走 §3.6 過濾）；ESP 回 429 暫停當批、不靜默重試超過 3 次 |
| `SEND-12` | **P1** | 排程刪除 Undo | 刪除排程提供 10 秒 Undo（Sonner toast）；立即發送提供 5 分鐘可取消緩衝（延遲入隊） |

#### 驗收標準

- [ ] **AC-SEND-01** 🛡️ Given 同一 campaign 與收件人｜When 直接 INSERT 兩筆相同 `(campaignId, userId)` 的 Recipient｜Then 第二筆因 unique constraint 衝突被攔，該收件人僅一筆 SENT。
- [ ] **AC-SEND-02** 🔲 Given 一個到期的 SCHEDULED campaign｜When 模擬 cron 在第 59 秒與第 61 秒各觸發一次｜Then 只被轉成 QUEUED 一次、只發一次，無重複 SENT。
- [ ] **AC-SEND-03** ⚠️ Given 一個 1000 人、發送進行至約 300 封的 campaign｜When 強制 kill 容器並重啟｜Then 從第 301 封續發，不重發已完成的 300 封，且不會永久卡在 SENDING（心跳逾時被 cron 撿回）。
- [ ] **AC-SEND-04** ⚖️ Given 後台選排程時間 2026-07-01 20:00 Asia/Taipei｜When 儲存｜Then DB `scheduledAt` = 2026-07-01 12:00:00 UTC（誤差 ≤1 秒），清單與確認 modal 同時顯示台北時間與 UTC。
- [ ] **AC-SEND-05** ⚡ Given 節流每分鐘 60 封、共 200 收件人｜When 執行發送｜Then 前 60 筆 `sentAt` 落第 1 分鐘、61–120 筆落第 2 分鐘（誤差 ≤10 秒），全程不觸發 provider 429。
- [ ] **AC-SEND-06** 🛡️ Given 一個 DRAFT campaign｜When 快速連點兩次「立即發送」｜Then 原子轉換只有第一個請求成功進入發送，第二個被拒回明確錯誤，無重複發送。
- [ ] **AC-SEND-07** 🛡️ Given 一封已 SENT 的 campaign｜When 透過任何 API 嘗試改回 DRAFT／SCHEDULED｜Then 操作被拒，AdminLog 記錄此嘗試（`adminId`／`action`／`targetId`）。
- [ ] **AC-SEND-08** ⚠️ Given Email 服務 API Key 失效（401）｜When campaign 發送連續失敗｜Then 5 分鐘內以**不經由失效 Email 服務**的通道（後台 Bell）通知 ≥1 位 ADMIN，campaign 轉 FAILED／PARTIAL_FAILED 並顯示原因。
- [ ] **AC-SEND-09** ⚠️ Given 一個 SENDING 的 campaign｜When 按「暫停」｜Then 停止派發新批（當前批發完不中斷單封）轉 PAUSED；按「恢復」從 cursor 續發，已發者不再收第二封。
- [ ] **AC-SEND-10** 🔲 Given 某收件人在快照後、輪到寄給他之前退訂｜When 發送引擎處理到他｜Then 即時查退訂狀態後標 SKIPPED 而非 SENT，他不會收到此信。
- [ ] **AC-SEND-11** ⚠️ Given 發送中 ESP 回 429｜When cron 撿到該批｜Then 暫停當批、Campaign 轉 PAUSED、記錄原因、橘色警告，重試不超過 3 次後停止，不靜默循環。
- [ ] **AC-SEND-12** 🔲 Given 收件人計算結果為 0 人｜When 嘗試排程／發送｜Then 阻止並顯示明確原因（「符合條件 0 人」或「全部已退訂」），不允許靜默排程後發 0 封。
- [ ] **AC-SEND-13** ⚡ Given 平台有 50,000 User、條件為「全部有效學員」｜When 在預覽頁計算人數｜Then COUNT 以非同步／快取回傳，首屏 ≤2 秒顯示計算中或結果，不阻塞逾時。
- [ ] **AC-SEND-14** ⚠️ Given Zeabur 未設定 cron（無心跳）｜When 創作者排程一封 campaign｜Then 排程設定畫面顯示警告「排程引擎似乎未啟動，排程信無法自動發送，[查看設定教學]」。
- [ ] **AC-SEND-15** ⚙️ Given 某學員回報沒收到信｜When 管理員以該 email 搜尋過去 3 個月發送記錄｜Then ≤2 秒回傳該 email 收過的 campaign 清單，含狀態（SENT／FAILED／SKIPPED／BOUNCED）、原因與時間戳。
- [ ] **AC-SEND-16** ⚡ Given 一個 >2000 人名單｜When 觸發發送｜Then HTTP 回應 5 秒內回「已排入佇列」，實際寄送由 async cron／worker 分批完成，不在單一 request 生命週期內處理。
- [ ] **AC-SEND-17** ⚠️ Given campaign 進入 SENDING｜When 發送途中管理員變更系統 email provider 設定｜Then 本 campaign 仍用 `senderSnapshot` 鎖定的原設定，不受影響。
- [ ] **AC-SEND-18** ⚠️ Given provider 配額不足（如 Resend 免費剩 50 封要發 200）｜When 排程／發送｜Then 系統提前警告並建議分日發送，超量時自動暫停剩餘批次等待確認，不靜默失敗。

---

### 3.4 促銷與推廣

**模組碼：`PROMO`**　促銷電子報的差異化功能：賣課的鉤子（優惠券、課程卡、倒數）、UTM 追蹤、轉換歸因的「種標記」端。

> 促銷信的整個商業目的就是成交，券是核心鉤子。critic 特別點名：1 萬人收到一張 `maxRedemptions=100` 的券，若無「售罄後體驗與歸因」會造成客訴與超賣——本模組明確處理。

**一般 vs 促銷差異**：本模組**僅適用 PROMO**。一般電子報不顯示優惠券綁定、不顯示歸因營收。

#### 需求清單

| ID | 優先級 | 需求 | 說明與複用 |
| --- | --- | --- | --- |
| `PROMO-01` | **MVP** | 優惠券綁定 | 促銷 campaign 可選一張既有 `Coupon`，自動插入大字可複製代碼框 + 有效期 + 行動裝置「點擊複製」；禁手打券碼；插入時與送出前各校驗有效（未過期、未達 `maxRedemptions`、已啟用）。複用 `Coupon`／`CouponRedemption` |
| `PROMO-02` | **MVP** | 優惠券售罄／防超賣體驗 | 定義「券售罄後」收件人點入的體驗（結帳頁明確提示券已用罄而非靜默失敗）；歸因仍記錄；一人一碼券（自動產生並對帳）列 P2。**critic 補充項** |
| `PROMO-03` | **MVP** | 課程／組合包 CTA 卡 | 從 `Course`／`Bundle` 選取，自動帶封面／課名／原價／`finalPrice`／絕對連結；創作者不可手打價格與連結 |
| `PROMO-04` | **MVP** | 靜態倒數區塊 | 純文字「優惠倒數至 X 月 X 日（台北）」，接 `Coupon.expiresAt`；email 不跑 JS／不用動態 GIF |
| `PROMO-05` | **MVP** | 直達結帳連結帶券參數 | 課程卡／按鈕連結可帶 `coupon=CODE`，導向結帳頁自動套用。⚠️ 需確認結帳頁是否已支援此參數（見 §8） |
| `PROMO-06` | **MVP** | UTM 自動標記 | 信中所有連結自動追加 `utm_source=newsletter`／`utm_medium=email`／`utm_campaign={活動名}`／`utm_content={版本}`，創作者不手填；須確保 UTM 在跳轉鏈路（含結帳／付款頁）不被洗掉。對齊 `Order.utm*` 與既有 middleware UTM 追蹤 |
| `PROMO-07` | **P1** | 轉換歸因種標記 | 用戶點追蹤連結時種歸因標記（`campaignId`+`linkId`+`timestamp`，**獨立 cookie 名**，與 middleware UTM cookie 共存不互蓋）；結帳完成寫入 `Order.newsletterCampaignId`（新欄位）與接觸點記錄。報表見 §3.8 |
| `PROMO-08` | **MVP** | 價格與幣別呈現 | 主價 28–32px、原價刪除線、折扣標琥珀；MVP 一律 TWD（HKD 以文字備註）；雙幣別自動分版依賴地區欄位，列 P2 |
| `PROMO-09` | **P2** | A/B 測試 | 主旨行 A/B（先送 20% 測試、勝出版本自動發剩餘）與整封 A/B；依賴穩定發送引擎與開信追蹤，後台以開關設定 |

#### 驗收標準

- [ ] **AC-PROMO-01** ⚙️ Given 建立促銷信並選定既有券、設好受眾｜When 按發送前確認｜Then 確認畫面顯示類型（促銷）、主旨、預計人數、排程時間（台北）、所綁券代碼與有效期；未點最終確認前不進入 SENDING。
- [ ] **AC-PROMO-02** ⚙️ Given 一般信（GENERAL）與促銷信（PROMO）｜When 分別進入編輯與報告頁｜Then 一般信不顯示優惠券綁定區、報告以開信／點擊／退訂為主；促銷信顯示優惠券與 UTM 區、報告含購買轉換數與收益。
- [ ] **AC-PROMO-03** ⚠️ Given 促銷信綁定一張已過期或未啟用的券｜When 進入發送前 Checklist｜Then 顯示紅色阻擋警告（標明過期／未啟用／次數已滿），發送按鈕不可用直到改選有效券。
- [ ] **AC-PROMO-04** ⚙️ Given 課程卡從 `Course` 選取｜When 渲染｜Then 自動帶入封面／課名／`finalPrice`／絕對連結，價格與連結欄位唯讀不可手打。
- [ ] **AC-PROMO-05** ⚙️ Given 促銷信含課程 CTA 與多個連結｜When 收件者點擊任一連結｜Then 連結皆帶 `utm_source=newsletter`／`utm_medium=email`／`utm_campaign`／`utm_content`，且經結帳／付款頁後 UTM 仍完整保留，可在 `Order.utm*` 與 PostHog／GA 看到 email 來源。
- [ ] **AC-PROMO-06** 🔐 Given 以 INSTRUCTOR 身分登入｜When 構造一個含非自己課程學員的發送 Server Action 請求｜Then 後端回 403，且分眾 UI 只能選到持有其課程 `Purchase` 的用戶。
- [ ] **AC-PROMO-07** ⚙️ Given 倒數區塊接 `Coupon.expiresAt`｜When 收件人檢視｜Then 顯示靜態繁中倒數文字（如「優惠倒數至 11 月 11 日」），不含 JS 動態計時或動態 GIF。
- [ ] **AC-PROMO-08** ⚙️ Given 課程卡按鈕帶 `coupon=CODE`｜When 收件人點擊進入結帳｜Then 結帳頁自動套用該券（若結帳頁支援），UTM 與券參數並存不互洗。
- [ ] **AC-PROMO-09** 🔲 Given 一張 `maxRedemptions=100` 的券被發給 1 萬人｜When 第 101 人點入嘗試使用｜Then 結帳頁明確提示「優惠已額滿」而非靜默失敗或系統錯誤，歸因仍正常記錄。
- [ ] **AC-PROMO-10** ⚙️ Given 促銷信種下歸因標記後 7 天內完成付款｜When 查看報告（§3.8）｜Then `Order.newsletterCampaignId` 正確寫入，歸因 cookie 與既有 UTM cookie 命名空間不衝突。

---

### 3.5 發送對象管理與分眾

**模組碼：`AUD`**　「對象選擇 + 分眾 + 去重 + 預估人數」。對應你最初需求中的「批次選擇特定對象或全發，皆可設定」。

**MVP 範圍仲裁**：分眾僅做**單層 AND／OR**（不做巢狀 query builder）；預估人數採 debounce 非同步計算（停止操作後 1 秒內回傳）。受眾群組、靜態名單、A/B、巢狀條件列 P2。

**一般 vs 促銷差異**：促銷模式下，分眾建構器頂部固定一條**不可移除、不可關閉**的鎖定條件「行銷同意 = 已同意」；若繞過 UI 直接呼叫 API，後端回 400 拒絕（見 `AC-AUD-06`）。

#### 需求清單

| ID | 優先級 | 需求 | 說明與複用 |
| --- | --- | --- | --- |
| `AUD-01` | **MVP** | 全發與批次手動勾選 | 「全部發送」一鍵；或表格列出姓名／信箱／課程／最後登入，搜尋篩選後批次勾選，頂部固定列顯示已勾選數。複用 Table／Pagination／Checkbox |
| `AUD-02` | **MVP** | 動態分眾條件（單層 AND／OR） | 條件：購買課程（買過／未買指定課／僅免費 `source=FREE_ENROLL`）、學員類型（免費／付費／`ADMIN_IMPORT`）、角色、活躍度（`lastLoginAt` N 天內／超過／從未；`LessonProgress`／`WatchTimeLog`）、用過某券（`CouponRedemption`）、註冊時間區間、行銷同意。統一 AND 或統一 OR。複用 Prisma 查 `User`／`Order`／`Purchase` |
| `AUD-03` | **MVP** | 即時人數預估 + 拆解 | 改任一條件，debounce 300–500ms 後 1 秒內回傳預估，並拆解：符合 X、排除退訂 Y、排除未驗證／退信 Z、實際發送 = X−Y−Z；OR 模式顯示已去重數。須對 `lastLoginAt`／`Purchase.courseId`／`CouponRedemption.couponId` 建索引並設 COUNT 上限／逾時保護 |
| `AUD-04` | **MVP** | 自動排除與去重 | 一律排除退訂者、`emailInvalidAt` 退信者、（一般信額外定義「有效收件人」邏輯，不可僅用 `emailVerified IS NOT NULL` 誤排大量學員）；同一 email（Guest 與正式帳號重複）DISTINCT 去重，只收一封 |
| `AUD-05` | **MVP** | 發送『當下』名單一致性 | 明確定義：名單於發送**當下重算**（非建立時快照），且發送前一律套退訂／同意過濾；預估數與實際發送數的差異來源（期間退訂／新符合）須可被解釋。**critic 補充項** |
| `AUD-06` | **P1** | CSV 外部名單匯入 | 必填 email、選填 name；解析處理 UTF-8 BOM 剝除與 Big5 fallback；逐列驗證回報「成功 X／格式錯 Y（精確到第幾列哪欄）／重複去重 Z／已在平台（含其中已退訂）」；外部名單**一律與全域退訂表比對**，不允許外部專用退訂清單繞過。複用 `BatchProcessor` |
| `AUD-07` | **P1** | 發送狀態即時進度顯示 | 群發後顯示已發 m/n、估計剩餘、失敗數；完成顯示「預計觸及 vs 實際成功 vs 失敗」，失敗可展開原因（讀 `NewsletterRecipient.errorMessage`） |
| `AUD-08` | **P1** | 地區／語言欄位與分眾 | `User` 新增 `locale`／`country`（資料來源見 §8）；釐清 `Order.currency` 現況；填值後支援台灣／香港分眾與分版。需 schema migration（走 baseline 機制） |
| `AUD-09` | **P2** | 受眾群組 / 靜態名單 / 巢狀條件 | 分眾條件序列化存為可重用「受眾群組」；CSV 存成具名靜態名單可跨 campaign 引用；兩層巢狀 AND／OR 含括號視覺化 |

#### 驗收標準

- [ ] **AC-AUD-01** ⚙️ Given 選「全部發送」一般電子報｜When 頁面載入｜Then 頂部顯示「實際將發送 N 人」，並標示「已自動排除 X 位退訂者、Y 位未驗證／退信」，三數相加邏輯一致（符合−排除=實發）。
- [ ] **AC-AUD-02** ⚙️ Given 條件設為「買過 iOS 課 AND 近 30 天有登入」｜When 改任一條件後停止操作｜Then debounce 後 1 秒內更新預估，並顯示人話摘要句（「已購買《iOS App 開發》且近 30 天內有登入，未退訂」）而非 SQL／欄位語言。
- [ ] **AC-AUD-03** 🔲 Given OR 模式下條件 A 符合 200 人、B 符合 150 人、重疊 80｜When 計算預估｜Then 實際將發送顯示 270（已去重），UI 標示「已去重 80 人」。
- [ ] **AC-AUD-04** 🔲 Given 過濾後實際發送人數為 0｜When 嘗試進入發送確認｜Then 禁止送出並顯示具體原因（優先顯示「全部已退訂」而非僅「0 位收件人」）。
- [ ] **AC-AUD-05** 🔲 Given 同一用戶同時符合「買過 A 課」與「買過 B 課」｜When 套用兩條件發送｜Then 該 email 在此 campaign 僅 1 筆 SENT，收件匣只收到 1 封。
- [ ] **AC-AUD-06** ⚖️ Given 電子報類型為促銷｜When 嘗試移除「行銷同意=true」篩選｜Then UI 為 disabled 不可移除；若繞過 UI 直接呼叫發送 API，後端回 HTTP 400 拒絕進入發送，不靜默放行。
- [ ] **AC-AUD-07** ⚠️ Given 匯入含 UTF-8 BOM 的 CSV 與 Big5 編碼 CSV 各一｜When 上傳解析｜Then 兩者 email 欄位皆正確解析（首列無 BOM 前綴），回饋顯示總筆數／格式有效／已在平台（含已退訂）／純外部／錯誤行原文（如第 37 行）。
- [ ] **AC-AUD-08** 🛡️ Given 匯入的外部 CSV 含已在平台退訂的信箱｜When 計算預估與實際發送｜Then 這些信箱被全域退訂表排除，排除數明確顯示；不存在可繞過全域退訂的「外部專用退訂清單」。
- [ ] **AC-AUD-09** 🔲 Given 信件含 `{{name}}` 但外部聯絡人無 name｜When 渲染寄出｜Then 顯示通用稱呼（如「您好」）fallback，絕不出現原始佔位符 `{{name}}`。
- [ ] **AC-AUD-10** ⚡ Given 收件人池含「課程進度<20%」「30 天未登入」等聚合條件、規模 300 人｜When 觸發即時人數預覽｜Then 查詢 2 秒內回傳且 query plan 走 index，COUNT 有上限保護避免全表掃描。
- [ ] **AC-AUD-11** 🔲 Given `emailVerified` 大量為 null（平台未強制驗證）｜When 計算「有效收件人」｜Then 依明確定義的有效收件人邏輯（不可僅用 `emailVerified IS NOT NULL` 誤排），且該定義一致套用於預估與實際發送。
- [ ] **AC-AUD-12** ⚙️ Given 一般電子報 vs 促銷電子報｜When 分別建立 campaign｜Then 促銷強制鎖定行銷同意篩選且不可移除；一般採「告知＋可退訂」教學類過濾；兩者退訂維度獨立、互不影響。

---

### 3.6 退訂與法遵

**模組碼：`CONSENT`**　**整個功能的法律地基，里程碑 Phase 1，先於一切發送功能。** 核心是「把法遵記在平台、退訂變成信任機制」。

> ⚖️ **法遵採「最嚴格基準」統一處理**：以香港 PDPO 第 VIA 部的「事先明確 opt-in」為全平台促銷同意基準，台澳同步。理由：自動依地區差異化判斷易誤判增加風險，且 `User` 目前無可靠地區欄位。`NULL` 行銷同意一律視為「未同意」**硬阻擋**（不是建議）。

**一般 vs 促銷差異**：

- 一般電子報：opt-out 模型（`generalEmailConsent` 預設 true，NULL/未設定視為可寄；香港地區用戶從嚴需 opt-in）。退訂只關閉一般電子報，不影響促銷以外狀態，更不影響交易信。
- 促銷電子報：opt-in 模型（`marketingConsent` 必須明確 true，NULL=不可寄）。同意必須在「**收集個資時**」取得（需改 `/register` 與結帳流程加促銷同意 checkbox，預設不勾），不可僅靠事後設定頁補救。

#### 需求清單

| ID | 優先級 | 需求 | 說明與複用 |
| --- | --- | --- | --- |
| `CONSENT-01` | **MVP** | User 同意與退訂欄位（單一事實來源） | 見 §2.1 `User` 擴充欄位。所有發送路徑只查這些欄位，不依賴任何外部名單。需 prisma migration 走 baseline 機制 |
| `CONSENT-02` | **MVP** | 統一守門函式 `assertEmailConsent` | 新建 `lib/email-consent.ts`，簽章 `assertEmailConsent(userId, type:'transactional'\|'general'\|'marketing')`。規則見 §2.3。**插入點在業務層（呼叫寄信前），絕不放 transport 層或 `sendCustomHtmlEmail` 內部**，以免誤殺交易信；被擋下寫 SKIPPED + reason。須逐一盤點現有所有寄信呼叫點並標 `type` |
| `CONSENT-03` | **MVP** | HMAC 免登入退訂 token + `/unsubscribe` 路由 | `token=HMAC-SHA256(NEWSLETTER_UNSUBSCRIBE_SECRET, userId+':'+email+':'+scope)`，`scope∈{all,marketing,general}`；獨立 secret（禁用 `NEXTAUTH_SECRET`）；永久有效不存 DB。**GET 僅驗算身分並渲染偏好頁、不做 DB 寫入；實際變更走 POST(+CSRF)**（防 email client 預取誤退訂）；驗算用固定時間比對防 timing oracle |
| `CONSENT-04` | **MVP** | 退訂偏好中心頁 | `app/(main)/unsubscribe`：三個獨立開關（促銷／一般／全部）+ 重新訂閱入口；明列不可退的交易信清單；套品牌 Logo／主色；行動版、無多餘挽留彈窗（一鍵生效）；促銷信來的連結預設只勾退促銷。繁中（台／港用語） |
| `CONSENT-05` | **MVP** | List-Unsubscribe header + RFC 8058 一鍵退訂 | 擴充 `EmailPayload`／`EmailTransport.send` 加 `headers?`，三個 transport（Resend／ZSend／SMTP）皆透傳；所有行銷信與一般信帶 `List-Unsubscribe:<https>` 與 `List-Unsubscribe-Post:List-Unsubscribe=One-Click`。**Gmail／Yahoo 2024 對每日 >5000 封寄件者強制此規範**，不符會被整批拒收。**critic 補充項** |
| `CONSENT-06` | **MVP** | 前台同意收集 | 註冊頁與結帳頁各放兩個獨立 checkbox：「接收學習資源電子報」（可預設勾，opt-out）與「接收促銷優惠電子報」（**預設不勾**，opt-in）；提交寫入 `marketingConsent`/`At`/`Source`/`Ip`（IP 末段匿名化）；促銷 checkbox 旁固定附明確用途說明。複用 `lib/actions/auth.ts` + Zod |
| `CONSENT-07` | **MVP** | 同意稽核軌跡（`EmailConsentLog`） | 每筆同意／退訂寫一列 append-only：`source`／`ip`／`timestamp`／`market`／`termsVersion`／`campaignId?`，涵蓋前台收集、CSV 匯入、ADMIN 覆蓋三種來源。PDPO／個資法核心舉證能力。**critic 補充項** |
| `CONSENT-08` | **MVP** | 合規頁尾 + 實體地址閘門 | `/admin/settings` Email 區塊新增頁尾設定：寄件公司／個人名稱、實體地址、聯絡信箱（存 `SiteSetting`）；自動注入每封行銷／一般信頁尾；**實體地址未填時，啟動促銷 campaign 的按鈕 disabled**。UI 標注此地址依所在地法規可能必填，平台不對合規性做法律保證 |
| `CONSENT-09` | **MVP** | 後台學員「電子報狀態」+ ADMIN 覆蓋 | `/admin/users/[id]` 顯示促銷／一般同意狀態（含時間／來源／IP）、退訂記錄、bounce 狀態；EDITOR 唯讀；**僅 ADMIN（`requireOnlyAdminAuth`）可覆蓋**，覆蓋時彈法律風險警示並寫 `AdminLog(ADMIN_OVERRIDE_CONSENT)`；**任何路徑不得把 OPTED_OUT 改回 OPTED_IN**（僅用戶自行於退訂／設定頁重訂） |
| `CONSENT-10` | **P1** | 主力市場法遵模式（手動選） | 後台「主力市場」下拉（台灣／香港／澳門）；系統一律按最嚴格基準處理，下拉只影響同意措辭與頁面提示文案，**不做 IP／GeoIP 自動差異化判斷**；台港澳措辭模板繁中 |
| `CONSENT-11` | **P1** | 資料保留政策（同意舉證 3–5 年） | 帳號刪除時，`marketingConsentAt`/`Source`/`Ip`、`unsubscribedAt` 等舉證欄位**不得一併硬刪**，以去識別化保留至少 3 年；刪帳流程須區分 PII 清除 vs 同意舉證保留 |
| `CONSENT-12` | **P2** | Double Opt-in（後台可開關） | `SiteSetting` `newsletter_double_optin_enabled`；搶先名單填 email→建 PENDING→寄純交易性確認信（僅含確認連結、無促銷）→48h token 點擊→CONFIRMED；同一 email 24h 內最多 1 封確認信（rate-limit 防轟炸）；過期顯示「連結已過期，請重新訂閱」 |

#### 驗收標準

- [ ] **AC-CONSENT-01** ⚖️ Given 一名 `marketingConsent IS NULL` 的舊匯入學員｜When 呼叫 `assertEmailConsent(userId,'marketing')`｜Then 回 `allowed:false`（NULL 一律視為未同意，不得以未知等同同意通過）。
- [ ] **AC-CONSENT-02** ⚖️ Given 一封促銷 campaign，名單含 NULL／false／true 混合｜When 執行發送（含直接呼叫 Server Action 繞過 UI）｜Then 僅 true 者收到並記 SENT；NULL 與 false 者記 SKIPPED 且無 SENT 記錄。
- [ ] **AC-CONSENT-03** ⚖️ Given 用戶在促銷信點 `scope=marketing` 退訂連結｜When 30 秒後對同一用戶再觸發促銷信｜Then `NewsletterRecipient` 出現 SKIPPED 且 reason 標示促銷退訂，信件未實際送出。
- [ ] **AC-CONSENT-04** ⚖️ Given 一封一般電子報｜When 用戶點該信 `scope=general` 退訂連結｜Then 僅 `generalEmailConsent` 變 false，`marketingConsent` 不受影響，交易信仍可寄（`assertEmailConsent('transactional')` 仍 true）。
- [ ] **AC-CONSENT-05** ⚖️ Given 收件人 `country=HK`、一般電子報且 `generalEmailConsent` 未明確同意｜When 發送｜Then 該香港用戶被 SKIP（PDPO 從嚴）；同條件 `country=TW` 用戶則可寄並含退訂連結。
- [ ] **AC-CONSENT-06** ⚖️ Given 已退訂行銷信的用戶完成新購買並觸發密碼重設｜When 系統寄出購買確認與密碼重設信｜Then 該用戶仍正常收到這兩封交易信（不受 `marketingConsent` 影響），但不會收到任何促銷信。
- [ ] **AC-CONSENT-07** 🛡️ Given 一個格式正確但用錯誤 secret 計算的偽造 token｜When 請求 `/unsubscribe`｜Then 回通用驗證失敗頁，採固定時間比對，不洩漏「格式對但 secret 錯」的區別（防 timing oracle）。
- [ ] **AC-CONSENT-08** 🛡️ Given 同一 `(userId,email)` 的退訂 token｜When 把 scope 從 `marketing` 改成 `all` 後沿用原 HMAC｜Then 驗算失敗（HMAC 含 scope，兩者不可互換）。
- [ ] **AC-CONSENT-09** 🛡️ Given 用戶點退訂連結進入偏好中心｜When 檢視 GET 請求行為｜Then GET 僅驗身分並渲染頁面、**不做任何 DB 寫入**；實際退訂只透過頁面 POST(+CSRF) 完成。
- [ ] **AC-CONSENT-10** ⚠️ Given 資料庫短暫不可用｜When 用戶點退訂連結｜Then 頁面以 HMAC 驗算成功即顯示「已收到您的退訂請求／處理中」而非 404／500，DB 寫入以重試補上。
- [ ] **AC-CONSENT-11** 🔐 Given 以 EDITOR 開啟 `/admin/users/[id]` 電子報狀態區塊｜When 操作｜Then 可讀同意／退訂／IP 記錄但無覆蓋按鈕；ADMIN 才有覆蓋，覆蓋寫 `AdminLog(ADMIN_OVERRIDE_CONSENT)` 並先彈法律風險警示。
- [ ] **AC-CONSENT-12** 🔐 Given ADMIN／EDITOR／INSTRUCTOR 任一｜When 嘗試把已退訂用戶的同意改回 OPTED_IN｜Then 系統不提供此操作或拒絕；同意只能由用戶本人經退訂／設定頁產生。
- [ ] **AC-CONSENT-13** ⚖️ Given 購課結帳流程｜When 到達同意勾選步驟｜Then 學習電子報與促銷兩個 checkbox 預設皆未勾，交易通知不需勾選即必寄；勾選促銷後產生帶 `recordedAt`、`source=checkout` 的 `EmailConsentLog`。
- [ ] **AC-CONSENT-14** ⚖️ Given 行銷信（促銷或一般）｜When 檢視寄出信件的 header 與頁尾｜Then header 含 `List-Unsubscribe` 與 `List-Unsubscribe-Post:One-Click`(RFC 8058)，頁尾含寄件人名稱與實體地址，繁中文案。
- [ ] **AC-CONSENT-15** ⚖️ Given `SiteSetting` 頁尾實體地址未填｜When 創作者嘗試啟動促銷 campaign｜Then 啟動按鈕 disabled 並顯示明確錯誤，campaign 不進入 SENDING。
- [ ] **AC-CONSENT-16** ⚖️ Given 任一刪除帳號流程｜When 帳號被刪除｜Then PII 被清除但 `marketingConsentAt`/`Source`/`Ip` 與 `unsubscribedAt` 等舉證以去識別化保留至少 3 年。
- [ ] **AC-CONSENT-17** ⚖️ Given `marketingConsentSource='admin_import'` 的同意記錄｜When 稽核｜Then 必有對應 `AdminLog` 記載哪個 ADMIN 何時 IP 匯入。
- [ ] **AC-CONSENT-18** ⚖️ Given 啟用 double opt-in、用戶填搶先名單 email（P2）｜When 系統寄確認信｜Then 內容僅含確認連結、無任何促銷／課程介紹；同一 email 24h 內第 2 封確認信被 rate-limit 阻擋。
- [ ] **AC-CONSENT-19** 🔲 Given double opt-in 確認連結已超過 48h（P2）｜When 用戶點擊｜Then 顯示「連結已過期，請重新訂閱」且不得改為 CONFIRMED。
- [ ] **AC-CONSENT-20** ⚠️ Given 用戶（本人）剛完成退訂｜When 退訂完成後｜Then 系統不得再寄「你已退訂」之確認信（唯一例外：ADMIN 代為退訂時的交易性知會）。

---

### 3.7 送達率與寄信健康

**模組碼：`DELIV`**　確保信「寄得到、不進垃圾桶、不燒網域信譽」。critic 特別點名：**SPF／DKIM／DMARC 網域驗證引導完全缺失**——群發而無網域驗證會直接進垃圾桶或被退。

**一般 vs 促銷差異**：送達率機制兩類一致；促銷信因量大、投訴風險高，對退信率／投訴率門檻更敏感。

#### 需求清單

| ID | 優先級 | 需求 | 說明與複用 |
| --- | --- | --- | --- |
| `DELIV-01` | **MVP** | Resend Webhook 接收退信／投訴 | 新建 `/api/webhooks/resend`，驗證 svix-signature（偽造回 401、不寫 DB）；處理 `email.bounced`（permanent=硬／transient=軟）、`email.complained`（投訴→等同永久退訂 + `marketingConsent` 撤銷）、`email.delivery_delayed`；依 `providerMessageId` 對應回 Recipient／User。複用 `/api/webhooks/stripe` 驗簽骨架 |
| `DELIV-02` | **MVP** | 硬退／軟退自動處理 | 硬退（5xx／permanent）：設 `emailInvalidAt`、`emailBounceState=HARD_BOUNCED`，後續所有信件（含交易信）SKIPPED，學員列表顯示紅色退信 Badge；軟退：`emailBounceCount` 累計達閾值（預設 3）轉 `SOFT_SUSPENDED`，cron 在 30 天後自動解鎖試一次，再失敗升級 HARD（不無限輪迴） |
| `DELIV-03` | **MVP** | 退信率／投訴率警戒與自動暫停 | 每封 campaign 計退信率／投訴率；硬退 >2% 或硬+軟 >5% 橘色警告；硬退 >5% 或投訴 >0.3% **自動將剩餘 PENDING 批次暫停（PAUSED）**等人工確認；投訴率 >0.1% 黃色警示 + Bell 通知 |
| `DELIV-04` | **MVP** | 合規頁尾強制注入（地址閘門） | 與 `CONSENT-08` 同一機制：頁尾強制含平台名稱、可聯繫 email、清晰退訂連結（font-size ≥10px、非極淡色）；任一欄缺則發送確認頁阻擋（非警告）。修改 `lib/email-templates.ts` `footerStyles` |
| `DELIV-05` | **MVP** | 發送前名單健康掃描 + 確認儀式 | 發送前自動掃描並產生排除摘要（硬退／投訴／已退訂該類／未驗證／促銷無同意，分類人數）；有效名單為 0 時阻擋（非警告）；確認畫面顯示類型、將發人數、被排除人數及分類、預估完成時間、預覽連結 |
| `DELIV-06` | **P1** | 發信網域 SPF／DKIM／DMARC 設定引導 | 買斷客戶各自有網域，平台須在 Email 設定頁提供「如何在你的網域設定 DNS」引導與檢測狀態（未通過顯示警告）；⚠️ 是否「硬擋發送 vs 僅警告」見 §8。**critic 補充項** |
| `DELIV-07` | **P1** | 發送配額估算（平台自算） | 因 Resend 無公開配額查詢 API、SMTP 更無，後台顯示「今日已發／估算剩餘」基於平台自身發送記錄，UI 明示「估算值，以 ESP 帳號實際配額為準」；建立超量 campaign 提前警告建議分日發送 |
| `DELIV-08` | **P1** | 業務層濫用防護（頻率上限） | 每帳號每 24h 發送上限與收件總數上限（ADMIN 可設），超過需二次確認；防帳號被盜瞬間群發釣魚信燒網域信譽。⚠️ 上限預設值見 §8 |
| `DELIV-09` | **P2** | Pre-send 垃圾郵件自我檢查 | 輕量規則檢查：主旨全大寫／過多驚嘆號／促銷字樣、圖片佔比過高、是否含純文字版；給可讀說明與評等（低／中／高），**僅供參考不阻擋**；中文垃圾詞庫誤判風險明示為已知限制 |
| `DELIV-10` | **P2** | 一般信夾促銷的混合內容偵測 | 偵測一般信內容含優惠券碼／購買連結／促銷字樣時，提示「香港 PDPO 下夾帶推廣即屬直接促銷，建議改為促銷類型」 |
| `DELIV-11` | **P2** | 名單活躍度評分與冷名單再激活 | 依近 90 天開信／點擊／登入／購買分活躍／沉默／冷名單；活躍度以點擊／登入／購買為主、開信為輔（Apple MPP 失真）；新客戶資料稀疏預設關閉 |

#### 驗收標準

- [ ] **AC-DELIV-01** 🛡️ Given `/api/webhooks/resend`｜When 送入 svix 簽名錯誤／偽造的請求｜Then 回 401 且不對任何 Recipient／User 寫 DB；簽名正確的 `email.bounced(permanent)` 則 5 秒內將對應 `user.emailInvalidAt` 設定。
- [ ] **AC-DELIV-02** ⚠️ Given 某 user 收到 permanent bounce 事件｜When 之後建立任一新 campaign｜Then 該 user 在名單健康掃描中自動列入排除（硬退類），學員列表顯示紅色退信 Badge，不會收到新信。
- [ ] **AC-DELIV-03** 🔲 Given 某地址連續 3 次軟退（達閾值）｜When 再次有 campaign 嘗試發送｜Then 狀態為 `SOFT_SUSPENDED` 被 SKIPPED；cron 在 30 天後自動解鎖試一次，再失敗升級 HARD（不無限輪迴）。
- [ ] **AC-DELIV-04** ⚠️ Given 硬退信率超過 2% 的進行中 campaign｜When 系統偵測門檻｜Then 自動切 PAUSED 停止後續寄送，需 ADMIN 手動解鎖；投訴率 >0.1% 黃色、>0.3% 紅色警告與建議。
- [ ] **AC-DELIV-05** ⚠️ Given 任一發送步驟失敗（ESP 拒絕／連線中斷／超量）｜When 失敗發生｜Then 對應 Recipient／Campaign 留明確 FAILED 與 `errorMessage`，並同時觸發後台 Bell 通知與寄信給 ADMIN，失敗不會只存在日誌而無告警。
- [ ] **AC-DELIV-06** ⚖️ Given 任一電子報 footer 缺平台名稱／可聯繫 email／退訂連結其一｜When 進入發送確認頁｜Then 顯示阻擋性錯誤（非警告），無法發送；退訂連結實際 font-size ≥10px 且非極淡色。
- [ ] **AC-DELIV-07** 🔲 Given 一名 `emailVerified` 非空但有效收件人為 0 的健康掃描結果｜When 嘗試發送｜Then 阻擋並顯示可讀原因（全部被退訂／未同意／硬退排除），campaign 不進入 SENDING。
- [ ] **AC-DELIV-08** ⚡ Given 收件名單達 50,000 人｜When 開啟發送確認頁｜Then 排除摘要計算以非同步進行不阻塞渲染（或落在明訂收件上限內），確認頁 3 秒內回應，不出現 Query 逾時。
- [ ] **AC-DELIV-09** 🔲 Given 同一 email 同時存在 Guest 與正式帳號｜When 建立任一 campaign 名單｜Then 對 email 去重（DISTINCT），該人只收一封；若退訂，退訂狀態對兩帳號同時生效。
- [ ] **AC-DELIV-10** ⚖️ Given 信件類型「一般」但內文含優惠券碼或購買連結｜When 進入確認頁混合內容偵測｜Then 提示「偵測到促銷內容，香港 PDPO 下夾帶推廣即屬直接促銷，建議改為促銷類型」。
- [ ] **AC-DELIV-11** ⚙️ Given email provider 完全未設定（`isEmailServiceConfigured()=false`）｜When 進入電子報後台｜Then 顯示「尚未設定寄信服務」降級狀態，**只能存草稿、不可建立可發送 campaign**。
- [ ] **AC-DELIV-12** ⚖️ Given 發信網域 SPF／DKIM 未通過｜When 開啟 Email 設定頁｜Then 顯示檢測狀態與警告及設定教學連結（是否硬擋發送見 §8）。

---

### 3.8 成效分析與追蹤

**模組碼：`ANALYTICS`**　把「寄出去之後發生什麼」變成創作者看得懂的數字。

> ⚠️ **Apple Mail Privacy Protection 與 Gmail Image Proxy 會使開信率系統性高估**（台港澳 iOS 市佔極高），報表必須誠實標注，活躍度與成效判讀應以**點擊／購買**為主、開信為輔。

**一般 vs 促銷差異**：報表版面依類型切換——一般信以開信／點擊／CTOR／退訂／投訴趨勢為主、無營收區塊；促銷信額外顯示歸因訂單數、歸因營收、RPE（Revenue per Email）、優惠券使用。

#### 需求清單

| ID | 優先級 | 需求 | 說明與複用 |
| --- | --- | --- | --- |
| `ANALYTICS-01` | **MVP** | 開信／點擊追蹤（走自有網域） | 開信像素 `/api/track/open/[token]` 與點擊改寫 `/api/track/click/[token]` **一律走客戶自有網域**（`SITE_URL`），不含第三方追蹤網域；發送前自動把每個連結改寫為追蹤版（創作者零操作）；提供「停用開信追蹤、只保留點擊」開關 |
| `ANALYTICS-02` | **MVP** | 點擊改寫防 Open Redirect | redirect 目標 URL 存 DB（`NewsletterLink.targetUrl`）以 token 查得後跳轉，**不從 query string 讀取**；構造任意 redirect 參數無法導向外部任意網域 |
| `ANALYTICS-03` | **MVP** | 未綁網域降級路徑 | 追蹤依賴客戶自有網域，但剛上線客戶可能只有 Zeabur 子網域或尚未綁定；須定義「未綁網域時追蹤端點掛在哪／是否自動關閉追蹤並提示」，不可讓追蹤連結指向錯誤網域而失效。**critic 補充項** |
| `ANALYTICS-04` | **MVP** | 成效報表（依類型切版）+ 1 小時內有數據 | GENERAL：開信率／點擊率／CTOR／退訂率／投訴率六指標卡 + 各連結點擊分布 + 趨勢；PROMO：以上 + 歸因訂單數／歸因營收／RPE／優惠券使用次數金額；指標附顏色標示與「較上一封」比較；開信率旁顯著標注 Apple MPP 免責。複用 `StatCard`／`Tabs`／`Table` |
| `ANALYTICS-05` | **P1** | 促銷購買轉換歸因 | 歸因窗口可設（預設 7 天）、last-touch 主歸因；同訂單被多封促銷信接觸時主歸因營收**只計一次**，其餘標「多接觸點」（總營收不灌水）；僅 PROMO 顯示。對應 `PROMO-07` 種標記 + `Order.newsletterCampaignId` |
| `ANALYTICS-06` | **P1** | 退訂閉環歸因 | 記錄「該用戶在哪一封 campaign 後退訂」，報表顯示每封信個別退訂人數與較上一封變化 |
| `ANALYTICS-07` | **P1** | 測試信不污染數據 | 測試收件人 `isTest=true`，其開信／點擊／歸因不計入任何統計（與 `AC-WRITE-10` 呼應） |
| `ANALYTICS-08` | **P2** | PostHog 事件 + 優惠券歸因來源 | `newsletter_opened`／`newsletter_clicked` 帶 `campaign_id`／`campaign_name`／`link_url`，對齊既有漏斗；`CouponRedemption` 加 `campaignId` 區分「本信點入使用」vs「其他渠道」。複用 `lib/posthog-server.ts` |
| `ANALYTICS-09` | **P2** | CSV 匯出（含法遵遮蔽） | 匯出收件人開信／點擊／退訂／歸因訂單；**預設提供不含 email 的匿名化版本**，含個資版本顯示法遵警告並記 AdminLog |

#### 驗收標準

- [ ] **AC-ANALYTICS-01** 🛡️ Given 任一寄出的電子報｜When 檢查信件原始碼的追蹤像素與連結 URL｜Then 開信像素與點擊改寫 URL 的網域均為客戶自有網域（`SITE_URL`），不含任何第三方追蹤服務網域。
- [ ] **AC-ANALYTICS-02** 🛡️ Given 信件內所有 `<a href>` 已改寫為點擊追蹤跳轉｜When 收件人點擊任一連結｜Then redirect 目標由伺服器以 token 從 DB 查得後跳轉，不從 query string 讀取，構造任意 redirect 參數無法導向外部任意網域（無 Open Redirect）。
- [ ] **AC-ANALYTICS-03** ⚙️ Given 客戶尚未綁定自有網域｜When 建立含追蹤的 campaign｜Then 系統依降級策略處理（追蹤端點掛在現有可達網域，或關閉追蹤並明確提示），不產生指向錯誤網域的失效追蹤連結。
- [ ] **AC-ANALYTICS-04** ⚙️ Given 一封 GENERAL 與一封 PROMO 報表頁｜When 分別開啟｜Then GENERAL 顯示開信／點擊／CTOR／退訂／投訴與各連結點擊分布且無營收區塊；PROMO 額外顯示歸因訂單數／歸因營收／RPE／優惠券使用。
- [ ] **AC-ANALYTICS-05** ⚙️ Given 一封 PROMO 信寄出後 30 分鐘內有用戶開信並點擊｜When 查看報表｜Then 開信率與點擊率已即時更新非零，且開信率旁顯示 Apple MPP 免責標注；送達率允許因 provider 回傳延遲稍後更新。
- [ ] **AC-ANALYTICS-06** 🔲 Given 同一用戶在歸因窗口內點了兩封不同 PROMO 信後完成 1 筆購買｜When 查看兩封信報表｜Then 該訂單歸因營收只在主歸因（last-touch）那封計一次，另一封標「多接觸點」，總營收不被灌水。
- [ ] **AC-ANALYTICS-07** ⚙️ Given 促銷信寄出 7 天內有收件者點擊並付款｜When 開啟報表｜Then 購買轉換數與收益正確計入，頁面以文字說明歸因邏輯（點擊後 7 天、以 UTM／`Order` 比對），數字可在 PostHog／GA 手動對得起來。
- [ ] **AC-ANALYTICS-08** ⚙️ Given 創作者寄測試信給自己並開信、點擊｜When 查看該 campaign 統計｜Then 測試收件人 `isTest=true`，其開信與點擊不計入任何統計與歸因。
- [ ] **AC-ANALYTICS-09** ⚖️ Given 創作者匯出某 campaign 收件人 CSV｜When 選擇匯出｜Then 預設提供不含 email 的匿名化版本，選含個資版本顯示法遵警告並要求確認，且匯出動作記 AdminLog。
- [ ] **AC-ANALYTICS-10** ⚡ Given 一封 2000 人的信被大量開啟導致追蹤像素瞬間命中｜When 高並發寫入發生｜Then 追蹤寫入經節流／批次聚合不拖垮 Zeabur 單實例 DB，追蹤失敗不影響信件正常顯示（像素 404 不破版）。
- [ ] **AC-ANALYTICS-11** ⚙️ Given 報表頁｜When 發送後 1 小時內查看｜Then 開信／點擊已開始有數據；未啟用追蹤時顯示「啟用追蹤後顯示成效」佔位而非假數據。

---

## 4. 美術風格與設計語言

> 業主明確要求：**好看、具備高質感、保持資訊密度**。本章為可交付工程師執行的視覺規範，非空泛形容詞。

### 4.1 整體設計方向：「克制的後台 × 有溫度的信件」

核心信念：**後台是「駕駛艙」**（高密度、灰底白卡、資訊優先、色彩節制，對齊 Linear 的效率、Resend 的乾淨表格、Stripe 的清楚分區）；**信件是「作品」**（單欄、留白大、品牌可換、閱讀為王，對齊 Beehiiv／Substack 的閱讀舒適與 ConvertKit「像朋友寫的信」的親和）。兩者用**同一套 design token** 串起來，但密度與情緒刻意拉開。

**四個體驗支柱（工程師需逐一落實）**：

1. **雙模一眼可辨**：一般電子報 = 靛藍 `--primary` 系；促銷電子報 = 琥珀 `--cta` 系。這條「靛藍 vs 琥珀」的線從列表左側色條 → 撰寫畫布頂部模式標 → 寄出信件主 CTA 一路貫穿，使用者永遠知道自己在做哪一種信。
2. **漸進揭露馴服密度**：列表頁只給「決策必要」欄位，細節進 Sheet／Dialog；撰寫畫布採「左導覽 → 中畫布 → 右設定」三欄，進階設定收進右欄分頁與 Accordion。
3. **發送態是第一公民**：草稿／排程中／發送中／已發送／失敗／部分失敗，用統一的 Badge + StatCard + 進度語言表達。發送前一律有「人數預估 + 將寄給誰 + 退訂註記」確認步驟，杜絕誤寄。
4. **法遵內建、不可關閉**：把「行銷同意分眾」「退訂連結」「寄件人實體資訊」做成發送流程與信件 footer 的**強制視覺元件**，而非可選裝飾。

**標竿對照速查**：列表/儀表板 → Resend + Linear｜撰寫畫布 → Beehiiv composer + Notion｜分眾選擇器 → Stripe segment builder + Customer.io｜寄出信件 → Substack（一般）與精緻電商 EDM（促銷）。

### 4.2 色彩與 Design Token

**嚴格沿用既有 token，禁止新增色票。** 後台一律走 CSS 變數（`text-primary`／`bg-cta`），不寫死 hex；信件因 email 限制須 inline hex，但取值來源同一套。

| Token | 值 | 用途 |
| --- | --- | --- |
| `--primary` | `#6366F1` 靛藍 | 一般電子報主色：左側色條、模式標、次要強調、選中態邊框；一般操作按鈕（儲存／下一步） |
| `--cta` | `#F5A524` 琥珀 | 促銷電子報主色 + **全頁最重的「立即發送／排程發送」按鈕**。⚠️ 既有 `buttonVariants` 無 cta 變體，需**新增 cta variant**（`bg-cta text-cta-foreground hover:bg-cta-hover`） |
| `--accent` | `#10B981` 翠綠 | 成功態專用（發送完成、已送達、同意已取得），**不當裝飾**以免與 cta 搶視覺 |
| `--destructive` | `#EF4444` | 失敗、刪除、退訂、撤回，以及「促銷信送給未同意名單」這類阻斷級警告 |
| `--muted-foreground` | `#64748B` | 次級文字、表頭、時間戳、輔助說明 |
| `--border` / `--divider` | `#E2E8F0` / `#E5E5E5` | 卡片描邊、表格列分隔 |

**狀態色系統**（沿用既有 coupon-list 慣例：soft tint 底 + 同色系文字 + 1px 同色邊，pill 形）：

| 狀態 | 樣式 |
| --- | --- |
| 草稿 DRAFT | `Badge variant="secondary"`（灰） |
| 排程中 SCHEDULED | `bg-blue-50 text-blue-700 border-blue-200`（藍／紫資訊色） |
| 發送中 SENDING | `bg-primary/10 text-primary border-primary/20` + 柔和 pulse（見 §4.9） |
| 已發送 SENT | `bg-green-100 text-green-700 border-green-300`（與 coupon「啟用中」同款） |
| 失敗 FAILED | `bg-red-50 text-red-700 border-red-200` |
| 部分失敗 PARTIAL | `bg-amber-50 text-amber-700 border-amber-200` |
| 略過 SKIPPED | 灰 + 細說明 tooltip（未同意／已退訂被擋下） |

**圓角與陰影**：全面採 `--radius 0.75rem`(12px) 體系——卡片／畫布／大區塊用 `rounded-xl`，Badge `rounded-full`(pill)，按鈕 `rounded-md`。卡片一律 `bg-white`（深色 `bg-card`）+ `border-divider` + `shadow-sm`，浮在 `--admin-shell #EFEFF0` 灰底上。除 Dialog／Sheet／Popover 外不疊更重陰影。

**深色模式**：所有狀態色交給 `globals.css` 既有 `.admin-dark` 覆寫，新元件只要用對 `bg-*-50`／`text-*-700` class 名即可自動套深色，不要自己寫第二套深色 hex。

**信件內顏色（email HTML 必須 inline）**：一般信主按鈕 `#6366F1`、促銷信主按鈕 `#F5A524`（文字 `#FFFFFF`）、價格強調 `#10B981`、刪除線原價 `#94A3B8`。⚠️ **必須修正既有 `lib/email-templates.ts` 的 legacy 棕 `#78573c`**，新電子報模板不得沿用該棕色。

### 4.3 字體階層

字體沿用既有 `--font-geist-sans`（後台）；信件用 email-templates 既有 system font stack（`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial`），繁中回退系統黑體。

| 後台層級 | 規格 |
| --- | --- |
| 頁標題 H1 | `text-xl`(20px) `font-bold` `text-foreground`，`leading-tight` |
| 卡片標題 | `font-semibold` `text-heading` |
| StatCard 數值 | `text-2xl`(24px) `font-bold`；標題 `text-sm font-medium`；輔助 `text-xs text-caption` |
| 表格表頭 | `text-xs`(12px) `font-medium` `text-muted-foreground`（繁中不 uppercase） |
| 表格內文 | `text-sm`(14px)，主欄 `font-medium text-foreground`，次欄 `text-muted-foreground` |
| 數字／代碼 | `font-mono`（人數、券碼、messageId，強化掃讀） |

| 信件層級（px + inline） | 規格 |
| --- | --- |
| 主標題 H1 | 24–28px、700、`#0F172A`、line-height 1.3 |
| 段落 body | 一般信 16px / line-height 1.7；促銷信 16px / 1.6；手機不縮到 14px 以下 |
| 次標題 H2 | 18–20px、600 |
| footer／退訂 | 13–14px、`#64748B` |
| 促銷價格 | 主價 28–32px / 800；原價 16px 刪除線 `#94A3B8`；折扣標 14px |
| 行寬 | 600px container 內單行不超過約 75 字元 |

### 4.4 電子報列表與儀表板（`/admin/newsletters`）

- **頁首**：sticky，H1「電子報」+ 右側 default 按鈕「撰寫電子報」（Plus icon，沿用 coupon 頁頭模式）。側邊欄歸入「銷售與金流」組。
- **StatCard 排**：4 張灰底白卡（grid gap-4）——本月已發送封數、總訂閱人數（有行銷同意者）、平均開信率、平均點擊率；右上 Lucide icon、數值 `text-2xl`、底部 trend。**未接好追蹤前開信／點擊欄顯示「—」+ tooltip，不假裝有數據。**
- **主表格**（Resend 風密集 Table，列高約 52px，`hover:bg-muted/50`）：
  1. 最左 **4px 色條**（一般=靛藍、促銷=琥珀）——雙模辨識關鍵視覺。
  2. 標題（`font-medium` + 下方 `text-xs text-muted-foreground` 顯 subject 一行 truncate）。
  3. 類型 Badge（一般靛藍 outline、促銷琥珀 soft）。
  4. 狀態 Badge（§4.2 狀態色）。
  5. 受眾（「全體訂閱／已購買學員／自訂分眾」+ `font-mono` 人數）。
  6. 成效（開信率／點擊率，已發送才有值）。
  7. 時間（排程中顯排程時間含 relative time 倒數；已發送顯完成時間；草稿顯最後編輯）。
  8. 最右 `⋯` DropdownMenu（編輯／複製為新信／查看成效／刪除）。
- **互動**：整列可點進詳情；篩選列（Tabs：全部／一般／促銷／草稿／已排程 + 右側排序 Select）置於 StatCard 與 Table 之間 sticky；底部 Pagination 沿用既有元件。
- **儀表板強化（可選）**：最上一張「最近一次發送」橫幅卡（左信件標題、中發送態進度、右成效縮數），促銷信額外顯示「歸因營收」一格。

### 4.5 撰寫畫布（`/admin/newsletters/[id]/edit`）

整個功能的核心畫面，採**三欄式**（Beehiiv／Notion 風）：

- **頂部固定 Bar**（h-14，白底 border-b）：左為麵包屑 + 可 inline 編輯的信件內部名稱；中央**模式標**（一般電子報靛藍 pill／促銷電子報琥珀 pill，點擊切換並即時改變右欄可用區塊與預覽 CTA 色，~200ms 顏色過渡）；右側依序「儲存草稿」（ghost）、「預覽」（outline，開 Dialog 桌機/手機切換）、「發送測試」（outline）、最右「排程／立即發送」（促銷用 cta 琥珀、一般用 default 靛藍，全頁最重）。沿用 StickySaveBar dirty 追蹤。
- **左欄（約 240px，可收合）**：信件結構導覽——主旨與寄件人、內容區塊、設定。促銷模式多出「優惠設定（綁 Coupon）」「商品／課程卡」「倒數計時」三入口，一般模式隱藏。
- **中欄（畫布，max-w-[680px] 置中）**：灰底上一張白色「信紙」（`shadow-sm rounded-xl`），所見即所得。第一行為主旨大輸入（`text-lg` + 字數／預覽文字提示）；下方內文區塊以可拖曳卡片插入（文字／圖片／按鈕／分隔／課程卡）；促銷專屬區塊用琥珀描邊盒。畫布永遠保留充足左右留白。
- **右欄（約 320px，Tabs：設定／收件／法遵）**：
  - **設定**：寄件人名稱、回信地址、preheader、信件寬度。
  - **收件**：分眾選擇器入口 + 即時人數預估卡。
  - **法遵**：行銷同意層級提示（促銷強制「僅寄給已同意者」且不可關）、退訂連結預覽（強制存在）、寄件人實體資訊欄。
  - 用 Accordion 收納次要設定，預設只展開當前最相關區段。

### 4.6 分眾選擇器（右欄入口開 Sheet 或 Dialog，Stripe segment builder 風）

- **頂部三顆預設受眾大卡**（單選快速套用，icon + 標題 + 即時人數）：全體訂閱者（有行銷同意）、已購買學員、特定課程學員；第四張「自訂分眾」進入條件建構器。
- **條件建構器**（AND／OR 規則列，每列 `rounded-lg border-divider p-3`，可 + 新增／× 刪除）：欄位 Select + 運算子 Select + 值（依型別給 Select／日期／數字）。視覺克制，靠對齊與 muted 運算子文字維持密度下可讀。
- **法遵硬規則**：促銷模式時，建構器頂部固定一條**不可移除、不可關閉**的鎖定條件「行銷同意 = 已同意」（灰底鎖 icon + 紅字說明）。台港澳地區欄位在 `locale`／`country` 上線前以 `disabled` + 「需先啟用地區欄位」灰示，不給假選項。
- **底部即時回饋區（最重要的信任元件）**：一張固定「預估人數卡」——大字 `font-mono` 顯示符合人數，下方拆解「其中 X 人已同意行銷、Y 人未同意將被略過」（促銷命中未同意者用紅字明示會被擋）；再下方「預覽名單」可展開抽樣 10 筆（email 遮罩 + 姓名 + 命中原因 chip）。
- **確認發送 Dialog**：複述「類型（帶模式色）、最終人數、排程時間、退訂與同意已就緒」四項 checklist，全綠才允許發送；促銷信額外要求勾選「我確認此為促銷內容且收件人皆已同意行銷」。

### 4.7 寄出的信件本身（一般 vs 促銷）

兩類共用骨架（600px 置中 container、白底、頂部品牌區 `getEmailBranding` 的 logo 50×50 rounded-12 + 站名、底部 footer），但情緒與密度刻意不同。**footer 為法遵核心**，強制含：寄件人／實體名稱、所在地、「你收到這封信是因為…」說明、明顯退訂連結（13–14px、有底線、`#64748B`，促銷信更顯眼）、「更新訂閱偏好」連結；模板預留 `{{unsubscribeUrl}}` token 由發送引擎注入。

**一般電子報（Substack／Beehiiv 風）**：情緒安靜、可讀、像作者親筆。大量留白、單欄長文、段距寬（line-height 1.7）、圖片滿版圓角 12px、引用塊用 `#F8FAFC` infoBox。主 CTA = 靛藍 `#6366F1` 白字圓角 8px padding 14×28，且 CTA 克制（通常一顆）。標題 24–28px。不施加促銷壓力，建立信任與閱讀習慣。

**促銷電子報（精緻電商 EDM 風）**：情緒明確、有節奏、推動行動但不廉價（避免大紅大綠閃爍）。頂部主視覺 banner（課程封面滿版 rounded-12）；清楚價值主張標題；價格區塊（主價 28–32px/800、原價刪除線 `#94A3B8`、限時用琥珀標籤）；限時優惠盒琥珀描邊 + 靜態到期文字；主 CTA = 琥珀 `#F5A524` 白字較大（padding 16×32、font 16–18px、手機可置中滿寬），可重複 1–2 顆。**促銷信尤其要克制顏色數量**（主場是琥珀 + 中性灰 + 翠綠價格，靛藍幾乎不出現），靠層級而非花俏取勝。

兩者皆須：手機優先（單欄、點擊區夠大、字級不縮太小）、深色客戶端友善（淺色 `#F5F5F5` 包邊避免純黑配純白刺眼）、所有輸入經 `escapeHtml` 防注入。

### 4.8 高資訊密度下維持美感的九個手法

1. **8pt 間距節奏不破例**：基礎 4px，常用 8/12/16/24/32；卡片間 `space-y-6`、卡內區塊 `space-y-4`、表單列 `gap-3`、密集表格 cell `p-2~p-3`。
2. **灰底白卡分層**：用「底色 vs 卡片」而非粗線／重陰影分區；卡與卡留 24px。
3. **顏色節制三色律**：任一畫面 = 品牌色（靛藍或琥珀，二選一）+ 中性灰階 + 一個狀態色；翠綠／紅只在成功／危險語意出現。
4. **字重字色建立層級，而非字級暴增**：主欄 `font-medium text-foreground`、次欄 `text-muted-foreground`，光兩級拉出主從；數字一律 `font-mono`。
5. **漸進揭露**：列表只放決策必要欄位，其餘進 Sheet／Dialog／Accordion／`⋯`。
6. **對齊與留白優先於分隔線**：表格列用淺 `border-b` 或純 hover 變色取代密集網格線。
7. **狀態用統一視覺語言**：所有發送態都是「pill Badge + soft tint 底 + 同色文字」，掃一眼顏色就懂。
8. **雙模色條當資訊壓縮器**：列表最左 4px 靛藍／琥珀色條，用極小元素承載「這是哪種信」。
9. **即時數字回饋取代說明文字**：分眾人數、開信率用即時 `font-mono` 數字 + 細拆解。

### 4.9 動效與空狀態

**動效**（沿用 framer-motion，服務狀態與引導、不炫技、尊重 `prefers-reduced-motion`）：
- 進場：列表／卡片用既有 `whileInView` 淡入 + 輕微 y 位移（~0.2–0.3s，stagger 0.03s）。
- **發送中**：唯一允許持續動的狀態——Badge 柔和 pulse、進度條平滑推進，配 Sonner toast 階段回饋（「發送中… 320/1500」），完成瞬間進度條轉翠綠 + 成功 toast。
- 模式切換（一般↔促銷）：模式標與預覽主色 ~200ms 顏色過渡，讓「靛藍→琥珀」被感知。
- 過場／載入：用 skeleton（白卡 + 灰塊 shimmer）取代 spinner，表格載入顯 5–6 行 skeleton row。

**空狀態**（每個列表都要有）：
- 列表全空：置中大 icon（muted）+「還沒有電子報」+ 價值文案「寫一封信，和你的學員保持聯繫」+ 兩顆引導按鈕「撰寫一般電子報（靛藍）／撰寫促銷電子報（琥珀）」。
- 篩選無結果：輕量「目前沒有符合條件的電子報」+「清除篩選」。
- 分眾 0 人：紅／黃提示「目前沒有符合條件的收件人」+ 建議放寬，並禁用發送按鈕。
- 成效未啟用追蹤：灰色佔位 +「啟用追蹤後顯示成效」+ 設定連結，誠實不造假。

**回饋態統一語言**：寫入沿用 `{success,error?}` + Sonner toast（成功翠綠／失敗紅／資訊靛藍）；危險操作一律 Dialog 二次確認並複述影響範圍與人數。

### 4.10 無障礙（a11y）

- 沿用亮色 + `.admin-dark` 雙模，新元件只用語意 class，深色自動接手。
- 對比：正文 `--foreground` on 白卡達 AAA；次級文字 `--muted-foreground` on 白達 AA。
- **不單靠顏色傳達狀態**：Badge 內含文字（草稿／已發送／失敗），列表色條另配類型文字 Badge，色盲友善。
- 互動：所有可聚焦元件沿用 `focus-visible` ring（3px），鍵盤可達；撰寫畫布支援 ⌘S。表單 Label 與 input 正確關聯、錯誤訊息 aria 連結。
- **信件無障礙**：語意 HTML（h1/h2/p）、所有圖片帶 alt、CTA 用真連結文字（非「點這裡」）、退訂連結文字明確且對比足夠、手機字級不低於 14px、CTA 點擊區 ≥44px 高；動效遵守 `prefers-reduced-motion`（發送中 pulse 在 reduced-motion 下改靜態 + 文字進度）。
- **退訂偏好頁是免登入公開頁，a11y 是合規與信任要件**，須完整鍵盤與螢幕閱讀器支援。

---

## 5. 台港澳法遵專章

> ⚠️ 本章為**設計依據**，非法律意見。平台為買斷原始碼多客戶產品，最終合規責任在各客戶。平台**不可**在 UI 給出「郵政信箱合規」「買過課就能寄促銷」等法律保證；澳門差異不可用「比照香港」草率帶過。建議客戶上線前自行諮詢當地法律顧問。

### 5.1 三地法規重點

| 地區 | 法規 | 對直接促銷的核心要求 |
| --- | --- | --- |
| **台灣** | 個人資料保護法（個資法） | 行銷利用須**告知**並取得當事人同意；首次行銷須提供表示拒絕之方式；當事人**拒絕後不得再行行銷**。 |
| **香港** | 個人資料（私隱）條例 PDPO 第 VIA 部 | 直接促銷必須**事先取得明確同意（opt-in）**；每次促銷提供拒絕管道；拒絕後不得再促銷；**違者有刑責**。對「直接促銷」定義極廣。 |
| **澳門** | 第 8/2005 號法律《個人資料保護法》 | 個資處理與行銷利用之規範；細節差異須個別評估，不等同香港。 |

### 5.2 平台採用的合規策略

1. **最嚴基準統一**：以香港 PDPO「事先 opt-in」為全平台促銷同意基準，台澳同步。**不做** IP／GeoIP 自動差異化判斷（避免誤判增加風險），地區只影響同意措辭文案（`CONSENT-10`）。
2. **opt-in 硬阻擋**：促銷信只能寄給 `marketingConsent === true`；`NULL`／`false` 一律視為未同意，在 `NewsletterRecipient` 建立階段由程式強制排除，**ADMIN 全選或 CSV 匯入皆無法繞過**。
3. **同意於收集點取得**：促銷同意必須在註冊／結帳時以未預勾 checkbox 取得（`CONSENT-06`/`CONSENT-13`），不可僅靠事後設定頁補救（香港屬合規要件）。
4. **可舉證稽核**：每筆同意／退訂記入 append-only `EmailConsentLog`（來源／時間／IP／市場／條款版本），保留 3–5 年（`CONSENT-07`/`CONSENT-11`）。
5. **退訂即信任**：免登入一鍵退訂、即時生效、無 dark pattern 挽留；退訂為全域單一事實來源，僅用戶本人可改（`CONSENT-03`/`CONSENT-09`/`CONSENT-12`）。
6. **合規頁尾強制**：每封行銷／一般信頁尾含寄件人身分、實體地址、退訂連結、「為何收到此信」；實體地址未填擋發（`CONSENT-08`/`CONSENT-15`）。
7. **Gmail／Yahoo 2024 規範**：每日 >5000 封寄件者強制 `List-Unsubscribe-Post`(RFC 8058)、DMARC、投訴率 <0.3%；不符會被整批拒收（`CONSENT-05`/`CONSENT-14`）。

### 5.3 歷史用戶（升級前既存、無同意記錄）

> 這是**法遵最大灰色地帶**，必須業主決策（見 §8）。

- 建議預設：歷史用戶 `marketingConsent` 一律 `NULL`（視為未同意），促銷信不可寄。
- 後果：促銷功能上線初期可寄對象幾乎為 0，須配合 re-permission 引導（站內橫幅／一次性確認信／結帳補勾）重新收集同意。
- 台灣或可靠服務條款預設條款處理（須律師確認文字）；香港無預設同意空間。

---

## 6. 非功能性需求（NFR）

| 類別 | 需求 |
| --- | --- |
| **效能** | 單一 campaign 須能可靠發送至少數萬收件人；批次以「500 筆/批、單批 <60 秒、冪等防重送」為基準；收件人預估查詢 debounce 後 1 秒內回應；報表聚合走索引避免全表掃描 |
| **可靠性／斷點續發** | 對容器重啟、provider 暫時失敗（429/5xx）具指數退讓重試與斷點恢復；調度（狀態轉換）與執行（實際寄送）角色分離，cron 觸發具冪等與心跳補救 |
| **安全** | 所有外發 HTML 強制 sanitize（防 XSS）；追蹤／退訂端點防 Open Redirect 並需 HMAC 簽章；免登入退訂與測試信端點套 rate-limit；敏感設定（provider key、HMAC secret）進 `SENSITIVE_SETTING_KEYS` 遮蔽；防平台被當對任意 email 的群發 relay |
| **送達率／信譽** | 強制 List-Unsubscribe + RFC 8058；自動產生純文字版（multipart/alternative）；硬退／投訴自動隔離；發送速率對齊 provider 上限避免 429；HTML <102KB；提供 SPF/DKIM/DMARC 設定引導 |
| **合規（可審計）** | 每筆同意可舉證（來源／時間／IP／市場／條款版本），保留 3–5 年；NULL 同意視為未同意；促銷收件人池程式強制過濾不可繞過；合規頁尾實體地址閘門 |
| **可觀測性** | 發送進度、成功／失敗／退信／退訂計數即時可見；靜默失敗（cron 未執行、worker 死亡、排程到點未發）具心跳偵測與管理者告警；關鍵操作寫 AdminLog |
| **相容性** | 在 Zeabur 單實例 + 本地 volume 預設環境可運作，不依賴 Vercel Cron；三 provider（Resend／ZSend／SMTP）皆可用且未設定時優雅降級；email HTML 跨 Gmail／Outlook／Apple Mail／行動端相容並有已知限制清單；繁中（台／港）用語與時區正確 |
| **可維護性** | Campaign／Recipient／同意／Log 命名收斂為單一 schema（§2）；複用既有 `EmailDeliveryLog` 模式、email-transport、concurrency、Coupon、AdminLog；schema 變更透過 db push baseline 安全升級既有客戶 |
| **資料一致性** | 發送『當下』重新核對退訂／同意／分眾，避免過期快照；冪等鍵保證同一收件人在同一 campaign 只寄一次；預覽人數與實際發送差異可解釋 |

---

## 7. 跨領域議題

> critic 指出這些議題橫跨所有模組，散落在各處易遺漏，須統一規範。

| 議題 | 統一規範 |
| --- | --- |
| **審計記錄（AdminLog）** | 以下電子報操作**必寫** AdminLog 且含收件人數與 campaign 類型：建立／編輯／發送／排程／取消／暫停／CSV 匯入／手動覆蓋同意／匯出名單 |
| **權限矩陣** | 見 §2.4。INSTRUCTOR 為電子報新增權限層；收件範圍後端強制限縮；EDITOR 可否發促銷信、誰能匯 CSV／覆蓋同意／看學員 email 依矩陣（部分待業主確認） |
| **資料保留與刪除** | 同意舉證保留 3–5 年（去識別化）；收件人 PII 快照、開信點擊日誌、追蹤資料、CSV 名單的保留期與刪除政策須定義；用戶行使刪除權時如何處理散落在 Campaign／Recipient／Log／同意稽核中的個資 |
| **規模與效能** | Zeabur 單實例 + PostgreSQL 下，發送上萬封的批次大小、分眾大表 join、收件人表寫入量、追蹤事件高併發、報表聚合的效能上限與索引策略，須有容量規劃與壓測基準 |
| **可及性 a11y** | 退訂頁、合規頁尾、後台編輯器與報表的鍵盤／螢幕閱讀器／對比，以及信件 HTML 本身的 a11y（見 §4.10） |
| **錯誤監控與告警** | 「靜默失敗」（cron 沒跑、worker 掛掉、provider 全失敗、退信率飆高、排程到點未發）的偵測與告警通道（後台 Bell + email），含心跳機制與兜底偵測 |
| **多客戶部署差異** | 每客戶的網域、寄信服務（三選一甚至未設定）、Zeabur 排程能力、主力市場、是否綁追蹤網域皆不同；須有「不同環境下功能自動降級／引導設定」的相容性矩陣 |
| **設定相依與降級** | provider 未設定／頁尾未填地址／追蹤網域未綁時，統一採「前置條件未滿足 → 引導去設定／禁用發送／只能存草稿」策略，而非各模組各自報錯 |
| **與既有信件系統一致性** | 以 §2.3 對照表為單一守門，避免交易信被誤套退訂、或促銷信漏掉同意檢查 |
| **防濫用與安全** | 免登入退訂端點、追蹤像素、測試信、CSV 匯入皆為對外攻擊面，統一套 rate-limit、HMAC／簽章驗證，防被當免費群發 relay 或對任意 email 轟炸 |

---

## 8. 開放問題與待業主決策

> 以下為對弈中反覆浮現、**動工前須由業主／產品拍板**的決策點（已去重整併）。括號為建議。

### 8.1 架構級（阻擋動工）

| # | 決策點 | 影響 | 建議 |
| --- | --- | --- | --- |
| Q1 | **Zeabur 排程觸發方案**：Zeabur 內建 cron／常駐 worker 容器／外部排程器打 endpoint？ | 決定整個發送引擎能否在客戶站自動運行；排程／重試／斷點續發的狀態機設計 | MVP 採方案 A（Zeabur cron 每分鐘打 `/api/cron/newsletter-dispatch`）+ 心跳健康檢查；打包附 worker 容器範本為進階選項 |
| Q2 | **資料模型命名**：是否採用 §2 仲裁的 `NewsletterCampaign`／`NewsletterRecipient`／`User` 同意欄位 + `EmailConsentLog`？ | 避免做出三套打架的表 | 採用 §2，並先做 Phase 0 |
| Q3 | **多客戶 Email 基礎設施**：每客戶各自 provider，還是平台共用？ | 共用模式下一個壞客戶會拖垮全體 domain 信譽連帶交易信失效 | 強制每客戶自設 provider + SPF/DKIM/DMARC，onboarding 列為解鎖電子報的前置步驟 |

### 8.2 法遵級

| # | 決策點 | 建議 |
| --- | --- | --- |
| Q4 | **歷史用戶同意**：上線前既存、無同意記錄者，預設未同意還是 grandfather？是否做 re-permission 確認信？ | 預設未同意（最保守）；提供一次性 re-permission 引導，文字經律師確認 |
| Q5 | **退訂類別法律定義歸屬**：開課公告／問卷／加價購算不算「直接促銷」？由平台統一定義還是允許客戶自訂？ | 平台統一定義「含任何銷售連結即走促銷門檻」，不交創作者自行判斷（避免繞過 opt-out） |
| Q6 | **澳門第 8/2005 號**：是否需獨立程式邏輯，或文件提醒客戶自行諮詢即可？ | 以香港標準從嚴覆蓋 + 文件提醒；如需獨立邏輯另案 |
| Q7 | **退訂 token 有效期**：永久 vs 長效（如 12 個月）？secret 旋轉時舊連結失效如何處理？ | 永久有效（符合「隨時可退訂」）；secret 旋轉設 grace period 雙 secret 驗證 |

### 8.3 產品政策級

| # | 決策點 | 建議 |
| --- | --- | --- |
| Q8 | **INSTRUCTOR／EDITOR 權限**：INSTRUCTOR 可否發促銷信／只能寄自己課程學員？EDITOR 可否發促銷？誰能匯 CSV／覆蓋同意？ | 見 §2.4 矩陣建議；INSTRUCTOR 預設僅限自己課程學員、覆蓋同意僅 ADMIN |
| Q9 | **單次 campaign 收件上限**：訂多少？超過採拒絕還是自動分批？ | 設可調上限（預設如 5000–10000），超過自動分批並告知 |
| Q10 | **發送頻率上限**：每帳號 24h 發送／收件上限預設值？採硬上限還是警告？ | ADMIN 可設，預設保守值，超過需二次確認 |
| Q11 | **地區／語言／幣別欄位來源**：`User.locale`／`country` 由用戶自填／結帳填／cf-ipcountry？`Order.currency` 現況？ | 結帳／註冊主動讓用戶選地區；釐清 currency 欄位；地區分眾列 P2 |
| Q12 | **結帳頁是否支援 `coupon=CODE` 自動套用？** | 確認現況，若否需一併改結帳流程（影響 `PROMO-05`） |

### 8.4 功能取捨級

| # | 決策點 | 建議 |
| --- | --- | --- |
| Q13 | **開信／點擊追蹤**：是否做？隱私政策揭露與可否由創作者關閉？ | 做但預設可關、交易信永不追蹤、隱私政策揭露 |
| Q14 | **SPF／DKIM 未通過**：硬擋發送還是僅警告？ | MVP 警告 + 教學；是否硬擋視客戶門檻決定 |
| Q15 | **追蹤方案**：自家像素／轉址 vs Resend webhook，二擇一避免重複計數？ | 自家像素＋轉址為主；Resend webhook 用於退信／投訴 |
| Q16 | **版本歷史**：草稿是否需 5 版本還原（MVP 已降為單一最新快照）？ | 確認延到 P2 |

---

## 9. 開發里程碑

> 嚴格遵循「**法遵地基與發送引擎先行**」的順序。Phase 0–2 為 MVP P0，缺一不可上線。

| 階段 | 名稱 | 範圍 |
| --- | --- | --- |
| **Phase 0** | 資料模型與命名仲裁（地基前的地基） | 收斂 §2 單一 schema；定義 db push baseline 升級路徑；產出 §2.3 信件類型對照表與 §2.4 三角色權限矩陣 |
| **Phase 1** | 法遵地基（先於一切發送） | `User` 同意／退訂欄位 + `EmailConsentLog` 稽核（NULL=未同意）；HMAC 免登入退訂 token + `/unsubscribe` 偏好中心（行動版、a11y）；統一守門 `assertEmailConsent`（業務層）；合規頁尾 + 實體地址閘門；前台同意收集（註冊／結帳）；後台學員電子報狀態 + ADMIN 覆蓋記 AdminLog |
| **Phase 2** | 可靠發送引擎 | Campaign 狀態機（原子轉換／防連點／暫停取消）；DB 游標 + 冪等鍵 + 斷點續發批次引擎（500 筆/批）；Zeabur 友善排程觸發 + 心跳與靜默失敗告警；速率節流（Token Bucket）；發送『當下』即時過濾；測試信（限內部／不計信譽／加標記／rate-limit）；provider 未設定降級為只能存草稿 |
| **Phase 3** | 撰寫體驗與模板（MVP 收尾） | 區塊 content schema + 單軌 table-based 渲染器（<102KB 檢查、相容清單、sanitize、純文字版）；桌機/手機真實預覽；草稿自動儲存（並發鎖定）；複製；主旨/Preheader 輔助；merge tag + fallback；圖片上傳；發送前法遵 Checklist 與強制預覽；寄件人品牌一次設定 |
| **Phase 4** | 分眾與促銷 | 單層 AND/OR 分眾 + debounce 即時人數（定義發送當下 vs 預覽一致性）；一般 vs 促銷同意門檻硬性分流；促銷專屬區塊（課程卡/優惠券/靜態倒數）；優惠券綁定 + 防超賣/售罄體驗 + UTM 自動標記；手動勾選 + CSV 匯入（去重/退訂比對/編碼/同意具結） |
| **Phase 5** | 送達率與成效（P1） | 開信像素 + 點擊改寫（自有網域、未綁網域降級、防 Open Redirect）；Resend webhook 接收硬退/軟退/投訴 → 自動隔離 + 退信率/投訴率警戒與自動暫停；RFC 8058；成效報表依類型切版 + 1 小時內有數據；SPF/DKIM/DMARC 設定引導；PostHog 事件 + CSV 匯出（法遵遮蔽） |
| **Phase 6** | 進階（P2，明確延後） | 地區/語言欄位與台港澳分眾及雙幣別自動分版；A/B 測試；行為觸發自動化／系列信；一人一碼優惠券；冷名單再激活與活躍度評分；Double Opt-in 開關；發送時間建議（待累積歷史資料） |

---

## 附錄 A：風險登錄（Top Risks）

| # | 風險 | 緩解 |
| --- | --- | --- |
| R1 | 把發送塞進單一 cron API route 必撞 Zeabur 60 秒逾時、campaign 卡死 SENDING | 調度／執行分離 + cursor 續跑 + 心跳補救（§3.3） |
| R2 | 容器重啟／OOM 導致 SENDING 卡死且無告警 | `lastHeartbeatAt` + cron 撿回逾時 campaign + 雙通道告警 |
| R3 | 誤用既有 `EmailDeliveryLog`（交易信導向）塞電子報 → 冪等與查詢錯亂 | 新建 `NewsletterRecipient` 獨立冪等鍵（§2.1） |
| R4 | `runWithConcurrency` 被誤當速率限制（並發 ≠ 每秒封數）→ 觸發 429 後半段全 FAILED | 另建時間軸速率層（Token Bucket，`SEND-03`） |
| R5 | 守門函式插入點錯誤（放 transport 層）→ 誤殺交易信 | 插在業務層、逐一盤點現有寄信呼叫點（`CONSENT-02`） |
| R6 | 香港 opt-in 時機合規（同意只放設定頁屬事後補救）→ 刑責風險 | 改註冊／結帳流程於收集點取得（跨模組，`CONSENT-06`） |
| R7 | 退訂 token 被 email client 預取 → 用戶「被退訂」 | GET 顯示確認頁、POST 才生效（`CONSENT-03`） |
| R8 | 放棄 Milkdown 自建 email builder 工程量被嚴重低估 | 評估引入 react-email/mjml 降低自建 HTML 相容風險；單軌渲染設為 code review 紅線 |
| R9 | 自建 email HTML 跨客戶端破版（Outlook table 怪癖、Gmail >102KB 裁切） | 相容矩陣 + 102KB 檢查 + Litmus/Email on Acid 驗證（`WRITE-03`） |
| R10 | 多客戶共用 IP／provider 污染送達率，一壞客戶拖垮全體 | 強制各客戶自設 provider + DNS 驗證（Q3） |
| R11 | 本地 volume 圖片未掛 persistent volume → 重啟後已寄出的信全破圖 | 絕對公開 URL + 上傳 UI 與部署文件雙重警示（`WRITE-20`） |
| R12 | schema migration 在既有客戶 DB（db push 無歷史）撞 P3005 | 走 `scripts/prisma-migrate-deploy.cjs` baseline 機制（§2.6） |
| R13 | Apple MPP／Gmail Image Proxy 致開信率系統性高估 → 創作者誤判成效 | 報表顯著免責標注，活躍度以點擊/購買為主（§3.8） |
| R14 | 舊用戶一律 NULL 致促銷信初期可寄對象幾乎為 0 → 功能上線即「沒人能寄」 | 配合 re-permission 引導流程（Q4、§5.3） |

---

## 附錄 B：需求與驗收標準統計

| 模組 | 需求數 | 驗收標準數 |
| --- | :---: | :---: |
| WRITE 核心撰寫體驗 | 15 | 22 |
| TMPL 模板系統 | 7 | 8 |
| SEND 排程與發送引擎 | 12 | 18 |
| PROMO 促銷與推廣 | 9 | 10 |
| AUD 發送對象管理與分眾 | 9 | 12 |
| CONSENT 退訂與法遵 | 12 | 20 |
| DELIV 送達率與寄信健康 | 11 | 12 |
| ANALYTICS 成效分析與追蹤 | 9 | 11 |
| **合計** | **84** | **113** |

> 本表為「整併去重後」的可施工數量（對弈原始產出為 103 需求／172 AC，經跨主題去重與收斂）。每條 AC 皆可由 QA 逐條勾選驗收。

---

*本文件由「創作者視角提案 → 工程＋法遵對抗性挑戰 → 首席產品技術主管仲裁」的多輪雙向對弈產生，並經完整性審視補全。動工前請先完成 §8 開放問題的業主決策，並依 §9 Phase 0 收斂單一資料模型。*

