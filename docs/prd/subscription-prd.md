# 課程訂閱制 PRD — 設計文件

> 版本：v2（2026-07-10，經四視角對抗性設計評審修訂：金流正確性／UX 旅程／台灣法遵／升級相容）
> 狀態：設計定稿，進入開發
> 相關 BDD 規格：[docs/bdd/subscription.md](../bdd/subscription.md)

## 1. 目標

讓每門課程除了「買斷」之外，可同時販售兩種訂閱：

| 類型 | 語意 | 結束條件 |
|------|------|---------|
| **無限訂閱**（UNLIMITED） | 不取消就一直扣款、一直能看 | 用戶取消 / 扣款失敗終止 |
| **期限訂閱**（FIXED_TERM，類似分期付款） | 繳滿 N 期 | 預設**轉為永久擁有**（分期付款語意）；可設定為「期滿結束存取」（END_ACCESS） |

買斷與訂閱**同時存在**。未設定訂閱方案的課程行為與現狀一致（本平台是買斷原始碼賣多客戶的產品，升級不得影響既有行為——**§9 三項安全/正確性修復除外**，該三項是刻意的行為變更）。

## 2. 三大金流支援策略

| | Stripe | PAYUNi | SHOPLINE Payments |
|---|---|---|---|
| 策略 | 原生 Billing（Checkout `mode:'subscription'`） | 官方「續期收款」API（`/api/period/Page`，gateway 代管排程） | **v1 不支援**（降級） |
| 每期通知 | `invoice.paid` / `invoice.payment_failed` webhook | 續期收款 Notify（`PeriodOrderNo` 為冪等鍵） | — |
| 無限訂閱 | 原生 | `PeriodTimes=900`（技術上限近似無限，見 §12 揭露要求） | — |
| 期限訂閱 | 平台數期數，繳滿後主動 `subscriptions.cancel()` | 原生 `PeriodTimes=N` | — |
| 失敗重試 | Smart Retries | 無自動重試；後台「重新扣款」（`mdfStatus reauth`） | — |
| 取消 | `subscriptions.cancel()` | `mdfStatus end`（不可逆） | — |

**SHOPLINE v1 降級理由**：定期扣款需嵌入式 SDK 綁卡＋3DS（與現有導轉式整合完全不同）、API 端點未全驗證、開通條件未確認。啟用 SHOPLINE 的站台前台隱藏訂閱、API 拒絕、後台告警，三處一致。

**Stripe client 硬性規定**：所有訂閱相關 Stripe 呼叫（Customer find-or-create、recurring Price 建立、subscriptions.cancel、hosted_invoice_url、退款）**一律使用 gateway-factory 的 DB 設定 client（StripeGateway 內部實例）**，禁止走 `lib/stripe.ts` 的 env-only client——「只在後台填 key」的客戶站必須完整可用。

**capability 介面**（fail-closed）：

```typescript
interface PaymentGateway {
  // ...現有四方法不變...
  readonly supportsSubscription?: boolean
  createSubscriptionSession?(params: CreateSubscriptionSessionParams): Promise<CreatePaymentResult>
  cancelSubscription?(params: { subscription: CourseSubscription }): Promise<{ success: boolean; error?: string }>
}
```

「目前 gateway 是否支援訂閱」由 `lib/payment/subscription-support.ts` 單一 helper 回答：以 `getActiveGatewayType()` + **靜態 capability 對照表**實作，**不實例化 gateway、不驗憑證、絕不 throw**（未設定金流回 false）——未設金流的客戶站銷售頁不得因此 500。

## 3. 資料模型

### 新增 Model

```prisma
enum SubscriptionPlanType { UNLIMITED FIXED_TERM }
enum BillingInterval      { MONTH YEAR }
enum TermEndBehavior      { GRANT_LIFETIME END_ACCESS }
enum SubscriptionStatus   { PENDING ACTIVE PAST_DUE CANCELED COMPLETED }

model CourseSubscriptionPlan {
  id / courseId / label
  type SubscriptionPlanType
  interval BillingInterval
  price Int                      // 每期金額，≥2（PAYUNi PeriodAmt 下限 >1 元）
  totalPeriods Int?              // FIXED_TERM 必填 2–900
  termEndBehavior TermEndBehavior @default(GRANT_LIFETIME)
  renewalReminderDays Int?       // YEAR 方案強制 ≥7 不可為 null（卡組織 pre-billing 通知要求）；MONTH 預設 null
  enabled / sortOrder / stripePriceId
  createdAt / updatedAt
}

model CourseSubscription {
  id / userId / courseId / planId
  status SubscriptionStatus @default(PENDING)
  gateway String                 // 'stripe' | 'payuni'
  gatewaySubscriptionId String?  // Stripe sub id / PAYUNi PeriodTradeNo
  gatewayTradeNo String? @unique // PAYUNi 專用 MerTradeNo（≤25 碼自產，如 SUB+YYYYMMDD+12hex）
  // 方案快照
  planType / interval / pricePerPeriod / totalPeriods / termEndBehavior
  paidPeriods Int @default(0)    // ⚠️ 唯一合法定義：該訂閱 PAID 期款 Order 的計數，在建立期款 Order 的同一交易內重算，禁止 +1 或取 gateway 序號
  currentPeriodEnd DateTime?     // 更新一律 max(現值, 新值)，防晚到 webhook 回退
  lastPaymentAt / canceledAt / cancelReason / completedAt
  pendingGatewayCancelAt DateTime?  // gateway 取消失敗待重試（maintenance tick 為 retry owner）
  attentionReason String?           // 異常標記（如 'TERM_ENDED_UNDERPAID' / 'WEBHOOK_STALE' / 'CANCEL_RETRY_EXHAUSTED'）
  // 同意證據（法遵：chargeback / 消保舉證）
  consentAt DateTime?
  consentTextVersion String?     // 當下顯示的扣款條款/取消政策版本代碼
  // 通知防重
  reminderSentForPeriod Int?     // 即將扣款提醒已寄到第幾期
  accessEndNoticeSentAt DateTime?
  // 電子發票偏好快照（首次結帳收集；可更新，見 §5）
  invoiceType / invoiceCarrierType / invoiceCarrierId / invoiceTaxId / invoiceTitle / invoiceLoveCode / invoiceAddress
  createdAt / updatedAt
  @@index([userId]) @@index([courseId]) @@index([status, currentPeriodEnd])
}
```

**並發防重**（TOCTOU 防線）：migration 以手寫 SQL 建 **partial unique index**：
`CREATE UNIQUE INDEX ... ON "CourseSubscription"("userId","courseId") WHERE "status" IN ('PENDING','ACTIVE','PAST_DUE')`（Prisma 不建模，純 DB 約束）。

### 既有 Model 擴充

- **Order**：`subscriptionId`、`periodNumber`、`gatewayPeriodKey @unique`（Stripe=invoice id、PAYUNi=PeriodOrderNo）、`@@unique([subscriptionId, periodNumber])`。**每期扣款 = 一張 Order(PAID)** → 發票／營收／退款複用。`Order.amount 一律填 gateway 回報的實扣金額`（Stripe `invoice.amount_paid/100`、PAYUNi `AuthAmt`）；實扣 ≠ 快照 pricePerPeriod 時照常入帳開票但記告警。
- **User**：`stripeCustomerId String?`。
- **PurchaseSource** 加 `SUBSCRIPTION`；**AdminAction** 加 `CANCEL_SUBSCRIPTION`。

### Migration 拆分（baseline 誤判爆炸半徑控制）

拆 **3 個 migration**：(1) 既有 enum ADD VALUE；(2) 既有表 ADD COLUMN（Order/User）；(3) 全新 enum 型別＋新表＋partial unique index。硬性限制：**新 enum 值不得在同一 migration 內被任何 DML/DEFAULT 使用**（PG 同交易限制）。全部冪等（IF NOT EXISTS / DO $$ duplicate_object）。發版前驗證配方：以舊版 schema `db push` 建庫 → `node scripts/prisma-migrate-deploy.cjs --dry-run` 確認三包皆列入待套用 → 實跑兩次驗證冪等。

### 權限語意（單一事實來源）

**訂閱訂戶的權限完全由訂閱週期驅動，課程 accessType（LIFETIME/DURATION/FIXED_DATE）僅適用買斷**——此語意在後台方案區塊以說明文字揭示，結帳頁訂閱模式**不顯示**買斷的 accessPolicy 觀看期限文案。

- 每期扣款成功 → `Purchase.expiresAt = currentPeriodEnd + 7 天寬限`（`SUBSCRIPTION_GRACE_DAYS = 7`，統一常數；對用戶顯示的「可觀看至」一律用實際 expiresAt 含寬限）
- 期滿轉永久 → `expiresAt = null`
- 取消/失敗 → 不再延長，讀取時自然斷權（零排程依賴）
- 新增 `lib/purchase/is-active.ts` 的 `isPurchaseActive()` 收斂散落的手寫判斷

## 4. 完整生命週期（含所有邊界情境決策）

### 4.1 建立（結帳）

1. 銷售頁選方案 → `/checkout?courseId=…&plan={planId}`；未登入 → 登入引導，**callbackUrl 必須保留 plan 參數**
2. 訂閱僅限已登入正式會員（訪客/guest shell 拒絕）
3. 結帳頁揭露（締約時揭露，法遵要求）：每期金額、週期、期數、**FIXED_TERM 總繳金額（NT$Y × N 期 = 總計 NT$X，與買斷價並列）**、期滿行為、下次扣款日（PAYUNi 月繳含「每月 N 日扣款，當月無此日則月底」）、取消政策全文（**含「中途取消不轉永久、已繳期款不退」**）、擴充版數位內容例外同意（「訂閱後立即開通、並同意自今日起定期扣款，放棄 7 日猶豫期」）
4. **同意後端驗證與存證**：`recurringConsent` 必為 true 否則 4xx；`consentAt`+`consentTextVersion` 持久化到訂閱（搭配 Order 既有 IP/UA 構成證據鏈）
5. 阻擋規則：**任何有效（未撤銷且未過期）Purchase 都阻擋新訂閱**（含未過期的時限型買斷、取消後仍在已付期間的訂閱——UI 顯示「你目前仍可觀看至 X 日，屆時可重新訂閱」）；已有 ACTIVE/PAST_DUE 訂閱阻擋；**PENDING 不永久阻擋**（見 4.2）
6. 建單交易：`CourseSubscription(PENDING)` + 第 1 期 `Order(PENDING, periodNumber=1)`（發票偏好寫入兩處）
7. Stripe：Customer find-or-create（`customers.create` 帶冪等鍵 `customer_create_{userId}`；本地以 `updateMany({ where: { id, stripeCustomerId: null } })` 條件寫入，count=0 改讀既有值）→ 確保 recurring Price（DB-key client）→ Checkout `mode:'subscription'`，metadata（session 與 subscription 層都含 subscriptionId/orderNo）
8. PAYUNi：`/api/period/Page` form_post。參數推導：`MerTradeNo=gatewayTradeNo`；`PeriodAmt=plan.price`；`PeriodType=month|year`；**`PeriodDate`：月繳=建單日的 day-of-month（1–31，PAYUNi 規則當月無該日則月底）、年繳=建單日+1 年的 YYYY-MM-DD**；`PeriodTimes`：FIXED_TERM=N、UNLIMITED=900；`FType=build`（當日首扣）；`API3D=1`；NotifyURL/ReturnURL 指向訂閱專用 route。**首扣是否計入 PeriodTimes 第 1 期（off-by-one）列入發版前 sandbox 驗證清單（§12）**

### 4.2 PENDING 訂閱的復用與汰換（防鎖死）

- 同 user+course+plan 的 30 分鐘內 PENDING 訂閱＋其第 1 期 Order **復用**（比照既有訂單復用）
- 超過 30 分鐘的 stale PENDING：新結帳嘗試時**自動作廢**（轉 CANCELED，cancelReason='checkout_abandoned'；Stripe 有 session 者 best-effort `checkout.sessions.expire`）後建新的，交易內執行（partial unique index 保證併發下只有一筆存活）
- maintenance tick 將 >24 小時的 PENDING 批次轉 CANCELED('checkout_abandoned')
- **晚到的成功 webhook 打在已作廢訂閱上** → 走「異常期款」路徑（§4.4）

### 4.3 首期付款成功（事件亂序安全）

Stripe 不保證事件順序（`invoice.paid`(billing_reason=subscription_create) 常早於 `checkout.session.completed`），兩事件**都必須能獨立完成首期開通**，冪等互補：

- 任一事件到達：解析本地訂閱——session 事件用 metadata；invoice 事件**從 subscription 層 metadata 取 subscriptionId**（stripe SDK v20 / API `2026-01-28.clover`：invoice 的訂閱資訊在 `invoice.parent.subscription_details`，必要時 retrieve subscription 讀 metadata）。**解析不到本地訂閱一律回非 2xx 讓 Stripe 重試，不得回 200 吞掉**
- 首期路徑：以 `subscriptionId + periodNumber=1` 找到預建的 PENDING Order → **update**（補 gatewayPeriodKey、實扣金額、轉 PAID）＋訂閱轉 ACTIVE＋記 gatewaySubscriptionId＋Purchase 展期＋開發票＋寄訂閱成功信。第 2 期起才走「原子 create、unique 衝突=已處理」
- **`mode='subscription'` 的 checkout.session.completed 絕不可落入既有一次性 handlePaidCheckoutSession**（否則 LIFETIME 課會被 computeExpiresAt 直接發永久權限）
- `currentPeriodEnd` 資料來源：**invoice line item 的 `period.end`**（不是 invoice 層 period——首期 invoice 層 period_start==period_end==當下）；或 subscription item 的 `current_period_end`（clover API 已把 current_period_* 移到 item 層）
- PAYUNi：首期 period Notify（PeriodOrderNo 尾碼 _1）同樣走「update 預建 PENDING Order」路徑
- 成功頁：**首期 Order 在 checkout.session.completed 即轉 PAID**（不等 invoice.paid），確保 30 秒輪詢內完成；訂閱模式輪詢逾時文案改為「訂閱處理中，稍後可至我的訂閱查看」

### 4.4 每期續扣（第 2 期起）與異常期款

**正常路徑**（訂閱 status ∈ ACTIVE/PAST_DUE）：單一 DB 交易內——以 gatewayPeriodKey 原子建立期款 Order(PAID, 實扣金額)（unique 衝突=重複通知，冪等返回）→ **paidPeriods = 交易內 count 該訂閱 PAID 期款 Order**（禁止 +1 或取 ThisPeriod）→ `currentPeriodEnd = max(現值, 新期末)` → 訂閱回 ACTIVE → Purchase 展期。交易外：開發票、寄第 N 期收據信（含「管理訂閱」連結）、PostHog。

- periodNumber：PAYUNi = ThisPeriod（失敗期允許留空洞）；Stripe = 交易內現有期款數推導，unique 撞到則重算重試
- 續期金額驗證：實扣 ≠ pricePerPeriod → 照常入帳開票 + AdminLog 告警

**異常期款路徑**（訂閱 status ∈ CANCELED/COMPLETED，或 PENDING 已作廢）：**不展期、不建正常期款**——建立標記異常的 Order + 嘗試自動退款（Stripe refund；PAYUNi 標記需人工退款）+ AdminLog + 管理員告警信。CANCELED 的 PAYUNi 訂閱收到 Notify 額外代表 `mdfStatus end` 未生效，告警必須明示。

**退款併發防線**：續扣 handler 在 upsert Purchase 前檢查訂閱 status（防止 markAsRefunded 剛撤銷的 Purchase 被 in-flight webhook 經 upsert「已撤銷→恢復」邏輯復活）。

### 4.5 期滿（FIXED_TERM）

paidPeriods ≥ totalPeriods 時（在第 N 期入帳的同一交易內判定）：

- **順序：先 DB 交易（COMPLETED + GRANT_LIFETIME 時 Purchase 轉永久），後呼叫 gateway cancel（Stripe）**。cancel 失敗 → 寫 `pendingGatewayCancelAt`，maintenance tick 重試；重試期間若又多扣一期 → 異常期款路徑（自動退款）
- GRANT_LIFETIME：寄繳清恭喜信；END_ACCESS：不轉永久，權限於期末+寬限自然結束，**期末前 7 天由 maintenance 寄「存取即將結束」信**
- PAYUNi 由 gateway 自然停止（PeriodTimes=N），不需呼叫取消
- **未繳滿防呆**：處理最後一個排程期（PAYUNi NextAuthDate 為空或 ThisPeriod==TotalTimes；Stripe subscription.deleted）時若 paidPeriods < totalPeriods → **不得轉 COMPLETED**，設 `attentionReason='TERM_ENDED_UNDERPAID'` + 管理員告警信 + 後台醒目標示「已終止但未繳滿（11/12）」

**「差一期死局」救援 SOP（寫入 AGENTS.customer.md）**：非自願終止的 FIXED_TERM 訂戶（願意繼續繳），管理員可：PAYUNi 對失敗期 reauth 補扣；重試路徑已死時以手動收款＋`grantCourseAccess` 手動轉永久。扣款失敗信與取消確認信告知「如需恢復請聯繫客服」。

### 4.6 扣款失敗（dunning）

- Stripe `invoice.payment_failed` → PAST_DUE。**失敗信去重：僅在狀態首次由 ACTIVE→PAST_DUE 時寄**（Smart Retries 每次重試都發事件，不得轟炸 8 封）；PostHog `subscription_payment_failed` 同樣僅在轉態時發（或帶 attempt_count）
- 補繳成功（invoice.paid）→ 自動回 ACTIVE + 展期
- Stripe 重試耗盡 `customer.subscription.deleted` →（非 COMPLETED 時）轉 CANCELED + **寄「訂閱已終止」信**（含聯繫客服恢復指引）+ 管理員告警
- PAYUNi 失敗 Notify → PAST_DUE + 失敗信。**PAYUNi 用戶自救動線**：/my-subscriptions 的 PAST_DUE 卡片顯示具體指引（確認卡片額度/效期）＋「取消並重新訂閱」動線（PAYUNi 唯一自助換卡法）＋站台聯絡信箱；失敗信同步含此指引；後台提供「重新扣款」（reauth）
- 管理員信號：PAST_DUE 與 gateway 終止都寄管理員告警信（不能只靠後台統計卡）
- 寬限 7 天內權限不中斷；斷權日在失敗信中明示「補繳成功即恢復」

### 4.7 取消（含期限訂閱中途取消——支援）

兩種訂閱都可隨時取消。效果：立即停止未來扣款、已付期間內繼續可看（至實際 expiresAt 含寬限）、期限訂閱**不轉永久**、已繳不自動退款、可於權限結束後重新訂閱。

- **順序：先 gateway 後本地**——Stripe `subscriptions.cancel()`（失敗有 deleted webhook 兜底）；PAYUNi `mdfStatus end`（無 webhook 兜底：gateway 呼叫失敗 → 對用戶報錯不改本地狀態；gateway 成功但本地寫入失敗 → 同請求內重試，最後防線是 4.4 的異常期款告警）
- 管理員代取消：同語意 + AdminLog `CANCEL_SUBSCRIPTION`
- Dialog 與取消確認信一律顯示實際存取截止日（= expiresAt 含寬限）

### 4.8 退款

期款退款走 `markAsRefunded`（每期一張 Order），但訂閱期款分支：

- Dialog 警告「將同時取消訂閱並收回課程權限」
- **撤權以訂閱的 (userId, courseId) 定位 Purchase，不得依賴 Order.orderId 反查**（每期 upsert 會覆寫 Purchase.orderId，退非最新期時 orderId 反查匹配 0 筆靜默失敗）
- 退款成功 → gateway 取消（失敗寫 pendingGatewayCancelAt）→ 訂閱 CANCELED → Purchase 撤銷
- 首期 7 日內消費者主張解約的 SOP = 退首期（此路徑完整處理），寫入 AGENTS.customer.md

## 5. 前台 UI / 使用者旅程

| 觸點 | 內容 |
|------|------|
| 銷售頁 | default.tsx＋**PricingSection**（接受可選 plans props）＋sticky-cta 顯示方案；FIXED_TERM 卡必顯示**總繳金額**與「中途取消不轉永久」；促銷倒數並存時標示「促銷價僅適用買斷」；**LandingPageProps 新增欄位一律 optional**（客戶站客製頁升級編譯相容是硬性要求）；repo 內三個已註冊客製頁（ios-vibe-coding/react-beginner/test-course）同步更新 |
| 結帳頁 | §4.1 揭露清單＋自動扣款同意＋發票欄位；優惠券輸入區隱藏（v1 訂閱不支援券） |
| 成功頁 | 輪詢沿用；order-status API 擴充回傳 `subscription { status, nextBillingAt, planLabel }`；訂閱逾時文案「訂閱處理中」 |
| `/my-subscriptions` | 逐狀態顯示：ACTIVE→下次扣款日/金額；PAST_DUE→補繳連結(Stripe)或自救指引(PAYUNi)；CANCELED→**可觀看至 X 日**；COMPLETED(END_ACCESS)→存取截止日；FIXED_TERM→進度「已繳 9/12 期，再繳 3 期即轉永久」；期款歷史逐筆連到訂單（發票/收據入口）；**「更新發票資訊（適用未來期款）」表單**（複用 checkoutInvoiceSchema）；取消 Dialog |
| 全站入口 | header 用戶下拉選單新增「我的訂閱」；/my-courses 訂閱課卡顯示徽章＋連結 |
| 播放頁斷權 | 過期 redirect 銷售頁（含 §9 修復） |

## 6. 後台 UI

| 位置 | 內容 |
|------|------|
| 課程定價 tab | 訂閱方案 CRUD＋兩套語意說明（accessType 僅適用買斷）＋gateway 不支援告警＋**客製銷售頁提示**（landingPageMode=html 或非 default registry 時提示「客製頁需手動更新才會顯示訂閱選項」）；StickySaveBar dirty 正確追蹤動態方案列表 |
| `/admin/subscriptions` | 統計卡（活躍、MRR、PAST_DUE）＋列表（狀態/課程篩選、attentionReason 醒目標示）＋詳情（方案快照、期款歷史、同意證據 consentAt/版本、取消、PAYUNi reauth、發票偏好編輯）＋**排程心跳逾 48h 告警**＋**Stripe webhook 失聯偵測告警**（存在 ACTIVE Stripe 訂閱但超過一個週期無 invoice.paid） |
| 訂單 | 期款標記「訂閱第 N 期」＋連結；退款 Dialog 訂閱警告 |
| Sidebar | 銷售與金流 → 訂閱管理（adminOnly） |
| 金流設定頁 | **Stripe webhook 說明文案更新為完整事件清單**：checkout.session.completed、async_payment_succeeded/failed、invoice.paid、invoice.payment_failed、customer.subscription.deleted |

## 7. Email（8 個用戶模板 + 1 個管理員告警模板，登記進 emailTemplateDescriptions）

1. 訂閱成功（方案、每期金額、下次扣款日、如何取消）
2. 第 N 期扣款成功收據（含「管理訂閱／取消訂閱」連結——卡組織要求）
3. 扣款失敗（Stripe 附 hosted invoice 補繳連結；PAYUNi 附自救指引；**僅 ACTIVE→PAST_DUE 轉態時寄一次**）
4. 取消確認（實際存取截止日、恢復管道）
5. 分期繳清轉永久
6. 即將扣款提醒（依 renewalReminderDays；YEAR 強制 ≥7 天）
7. 存取即將結束（END_ACCESS 期滿與 CANCELED 的期末前 7 天）
8. 訂閱已終止（gateway 非自願終止，含恢復指引）
9. 管理員訂閱告警（PAST_DUE / 終止 / 異常期款 / TERM_ENDED_UNDERPAID，參數化單模板）

SUBSCRIPTION 來源 Purchase 排除於既有課程到期提醒 cron。首期成功寄 #1（不重複寄標準購買確認信）；管理員首購通知沿用既有 notifyAdminOnPurchase 機制。

## 8. 排程（maintenance tick）

訂閱扣款零排程（gateway 代管）。maintenance 職責：即將扣款提醒（防重：`reminderSentForPeriod` 條件式 updateMany 先 claim 再寄）、存取即將結束信（`accessEndNoticeSentAt`）、stale PENDING 清理、`pendingGatewayCancelAt` 重試、異常偵測（webhook 失聯 / TERM_ENDED_UNDERPAID → attentionReason＋管理員告警）、心跳 SiteSetting。

觸發（雙入口）：
1. `GET /api/cron/subscription-maintenance`：僅 `Authorization: Bearer CRON_SECRET`（不收 query param；production 未設 secret 一律拒絕）；vercel.json 註冊
2. piggyback `/api/cron/newsletter-dispatch`：**maintenance 先跑且硬性預算 ≤10 秒，dispatch 視窗相應縮短（總和 <55s）**；gating 以 SiteSetting 時間戳**條件式 updateMany 原子 claim（開始時 claim）**每 20 小時一次；錯誤隔離不影響 newsletter

**舊客戶站覆蓋**：v1.7.3 前部署的站沒有 newsletter worker——`/upgrade-platform` 與 `/onboarding` 的更新流程增加「檢查 newsletter worker 存在、心跳 24h 內有更新，缺失則補建」步驟；後台心跳逾時告警（§6）讓故障可見。

## 9. 順手修復的既有漏洞（刻意的行為變更，AC-61 例外清單）

1. `/api/lesson/stream-url`、`/api/lesson-progress` 改 allowlist（修 expired 落穿——過期用戶原可取得簽名影片 URL）
2. `/api/payment/create` 與 checkout page「已購買」檢查改 `isPurchaseActive()`（過期用戶可回購）
3. `upsertPaidPurchase` 展期時清除未來的 CourseExpirationReminder（修續費後提醒不重發）

## 10. 追蹤

PostHog：subscription_started / subscription_renewed / subscription_payment_failed（僅轉態）/ subscription_canceled / subscription_completed；checkout 漏斗事件加 `plan_type`（buyout/unlimited/fixed_term）。Meta CAPI：首期發 Purchase。

## 11. 排除範圍（v1）

SHOPLINE 訂閱（含綁卡 SDK 與手動續約模式）、訂閱優惠券、Bundle 訂閱、多幣別（TWD only）、方案升降級 proration、自助換卡（Billing Portal / PAYUNi 卡號修改；PAYUNi 以「取消重訂」替代）、按比例退款、試用期、UNLIMITED 年化成本錨點顯示（決策：v1 不顯示）。

## 12. 部署 / 發版前驗證清單

- **PAYUNi sandbox 實測**（發版前必做，負責人：平台方）：(a) `/api/period/Page` 是否需商務開通；(b) `FType=build` 首扣是否計入 PeriodTimes（off-by-one）；(c) PeriodTimes=900 在支付頁對消費者的顯示（若顯示期數/總額，結帳頁政策文案需含「授權頁顯示之期數為系統技術上限，實際扣款持續至您取消為止」——此文案 v1 直接內建）；(d) period Notify/Return 的實際 payload 欄位
- migration dry-run 配方（§3）
- 客戶溝通：Stripe webhook 事件清單更新（既有客戶必須到 Stripe Dashboard 補訂閱事件，否則續扣收不到——後台有失聯偵測告警兜底）；PAYUNi 續期收款開通申請管道；AGENTS.customer.md 增補訂閱客服 SOP（首期 7 日解約、未繳滿救援、發票資訊變更）
- 升級既有客戶站：三包 migration 冪等；未設定訂閱方案課程零行為變化（§9 除外）
