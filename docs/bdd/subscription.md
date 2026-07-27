# 課程訂閱制 — BDD 規格

> 版本：v2（經四視角設計評審修訂）。設計文件：[docs/prd/subscription-prd.md](../prd/subscription-prd.md)
> 本文件是 QA 行為審計的唯一依據。每條 AC 可由閱讀原始碼獨立驗證。

## 概述

課程除買斷外可販售「無限訂閱」與「期限訂閱」（類似分期付款，繳滿 N 期預設轉永久）。Stripe 走原生 Billing、PAYUNi 走官方續期收款 API、SHOPLINE v1 降級。每期扣款一張 Order 複用發票／營收／退款；權限以 Purchase 為單一事實來源（expiresAt=週期末+7 天寬限，讀取時斷權）。paidPeriods 唯一合法定義是「該訂閱 PAID 期款 Order 的交易內計數」。未設定訂閱方案的課程行為不變（除 PRD §9 三項刻意修復）。

---

## 行為規格（場景）

### 場景 1：管理員設定訂閱方案
**Given** 管理員在課程「定價」分頁
**When** 新增方案並儲存
**Then** 方案入庫；gateway=stripe 時同步 recurring Price（DB-key client）；gateway 不支援時顯示告警；課程用客製銷售頁時顯示「客製頁需手動更新」提示

### 場景 2：銷售頁選購
**Given** 課程有啟用方案且 gateway 支援
**When** 學員瀏覽銷售頁（default 頁或 repo 內三個客製頁）
**Then** 顯示方案（FIXED_TERM 含總繳金額與「中途取消不轉永久」），CTA 導向 `/checkout?courseId=…&plan={planId}`；未登入者登入回跳保留 plan 參數

### 場景 3：訂閱結帳
**Given** 已登入會員選擇方案
**When** 進入結帳頁
**Then** 完整揭露（PRD §4.1 清單），必勾自動扣款同意，優惠券區隱藏，買斷 accessPolicy 文案不出現；送出後後端驗證同意並存證

### 場景 4：訪客不能訂閱
**Given** 未登入或 guest shell 用戶帶 plan 送單
**Then** API 4xx 拒絕；前端顯示登入引導

### 場景 5：Stripe 首期成功（事件亂序安全）
**Given** Stripe 訂閱 Checkout 完成
**When** `checkout.session.completed` 與 `invoice.paid` 以任意順序到達
**Then** 任一先到者即完成開通（更新預建的第 1 期 PENDING Order → PAID、訂閱 ACTIVE、Purchase 展期、開發票、寄訂閱成功信），後到者冪等補齊；成功頁 30 秒輪詢內看到 PAID

### 場景 6：PAYUNi 首期成功
**Given** PAYUNi 續期收款支付頁完成首期授權
**When** 訂閱專用 period Notify 到達（PeriodOrderNo 尾碼 _1）
**Then** 驗簽解密後效果同場景 5；Return 導回以 gatewayTradeNo 反查訂閱 → 以首期 orderNo 導向成功頁，輪詢正常

### 場景 7：每期續扣成功
**Given** ACTIVE/PAST_DUE 訂閱本期扣款成功
**When** invoice.paid / period Notify 到達（含重送、亂序、並發）
**Then** 以 gatewayPeriodKey 冪等建期款 Order(PAID, 實扣金額)、paidPeriods=交易內 count、currentPeriodEnd=max(現值,新值)、狀態回 ACTIVE、Purchase 展期、開發票、寄收據信；重複通知零副作用

### 場景 8：期限訂閱繳滿轉永久
**Given** FIXED_TERM(GRANT_LIFETIME) paidPeriods 達 totalPeriods
**Then** 同交易內 COMPLETED+Purchase 永久，交易後 Stripe cancel（失敗→pendingGatewayCancelAt 由 maintenance 重試），寄繳清信

### 場景 9：期滿結束存取（END_ACCESS）
**Given** FIXED_TERM(END_ACCESS) 繳滿
**Then** COMPLETED、不轉永久、期末前 7 天寄「存取即將結束」信、期末+寬限後自然斷權

### 場景 10：扣款失敗與補繳
**Given** ACTIVE 訂閱扣款失敗
**Then** 轉 PAST_DUE、失敗信只寄一次（轉態時）、管理員收告警；Stripe 重試成功自動回 ACTIVE；重試耗盡 deleted → CANCELED＋「訂閱已終止」信；PAYUNi 用戶有自救動線、後台可 reauth

### 場景 11：取消（含期限訂閱中途取消）
**Given** 學員或管理員對 ACTIVE/PAST_DUE 訂閱取消
**Then** 先 gateway 後本地；Dialog/信件明示實際存取截止日、分期不轉永久、已繳不退；狀態 CANCELED、不再展期、期末斷權

### 場景 12：放棄結帳後重試
**Given** 用戶建立訂閱後在金流頁放棄
**When** 30 分鐘內重試同方案 → 復用 PENDING；超過 30 分鐘重試 → 舊 PENDING 作廢後新建
**Then** 兩種情況都能成功結帳，不被殘留 PENDING 鎖死

### 場景 13：終態後的晚到扣款（異常期款）
**Given** 訂閱已 CANCELED/COMPLETED/作廢
**When** 仍收到成功扣款 webhook
**Then** 不展期、建異常期款 Order、嘗試自動退款（Stripe）或標記人工退款（PAYUNi）、管理員告警

### 場景 14：訂閱期款退款
**Given** 管理員退某期訂閱 Order（含非最新期）
**Then** Dialog 警告後：退款、以 (userId, courseId) 撤銷 Purchase（不依賴 orderId 反查）、gateway 取消、訂閱 CANCELED、AdminLog

### 場景 15：SHOPLINE / 未設金流降級
**Then** 銷售頁無訂閱 UI、API 拒絕 planId、後台告警，三處一致；未設金流站台銷售頁正常渲染不 500

### 場景 16：到期斷權
**Given** expiresAt（含寬限）已過
**Then** 播放頁/stream-url/lesson-progress 全部拒絕，無落穿

### 場景 17：買斷回歸
**Given** 無訂閱方案課程
**Then** 買斷全流程行為不變（PRD §9 三項刻意修復除外）

### 場景 18：未繳滿即終止的救援
**Given** FIXED_TERM 中間期失敗後被終止或排程走完
**Then** 不轉 COMPLETED、attentionReason 標記、後台醒目顯示、管理員告警；reauth 補扣成功後期滿判定仍正確觸發

---

## Acceptance Criteria

### A. 資料模型與遷移
- [ ] AC-01：schema.prisma 新增 `CourseSubscriptionPlan` 與 `CourseSubscription` model 及 `SubscriptionPlanType`/`BillingInterval`/`TermEndBehavior`/`SubscriptionStatus` enum，欄位含 PRD §3 全部項目（含 consentAt/consentTextVersion、pendingGatewayCancelAt、attentionReason、reminderSentForPeriod、accessEndNoticeSentAt、發票偏好快照、gatewayTradeNo @unique）
- [ ] AC-02：`Order` 新增 subscriptionId/periodNumber/gatewayPeriodKey(@unique) 與 `@@unique([subscriptionId, periodNumber])`；`User` 新增 stripeCustomerId
- [ ] AC-03：`PurchaseSource` 加 `SUBSCRIPTION`；`AdminAction` 加 `CANCEL_SUBSCRIPTION`
- [ ] AC-04：migration 拆 3 包（既有 enum 增值／既有表加欄位／新型別+新表），全部冪等，新 enum 值不在同一 migration 內被 DML/DEFAULT 使用；PRD §12 記載 dry-run 驗證配方
- [ ] AC-05：第 3 包 migration 以手寫 SQL 建 partial unique index：`(userId, courseId) WHERE status IN ('PENDING','ACTIVE','PAST_DUE')`
- [ ] AC-06：新增 `lib/purchase/is-active.ts` 的 `isPurchaseActive()`，並替換以下呼叫點：public-courses.ts、payment/create route、checkout page、stream-url route、lesson-progress route

### B. 金流抽象層
- [ ] AC-07：PaymentGateway 介面新增可選 supportsSubscription/createSubscriptionSession/cancelSubscription；Stripe 與 PAYUNi 實作，SHOPLINE 不支援
- [ ] AC-08：`lib/payment/subscription-support.ts` helper 以 getActiveGatewayType()+靜態 capability 表實作，不實例化 gateway、不 throw、未設金流回 false；銷售頁/結帳/create API/後台皆以它 gating
- [ ] AC-09：所有訂閱相關 Stripe 呼叫（Customer、recurring Price、cancel、hosted_invoice_url、refund）走 gateway-factory DB 設定的 client，不走 lib/stripe.ts env client；「僅後台填 key、env 未設」情境可運作

### C. 後台方案管理
- [ ] AC-10：課程定價 tab 訂閱方案區塊：多方案 CRUD（label/type/interval/price/totalPeriods/termEndBehavior/renewalReminderDays/enabled），含兩套語意說明文字（accessType 僅適用買斷）
- [ ] AC-11：`lib/validations/subscription.ts` Zod：price ≥2 正整數；FIXED_TERM 必填 totalPeriods 2–900、UNLIMITED 禁止；**YEAR 方案 renewalReminderDays 必填且 ≥7**
- [ ] AC-12：方案 Server Action 有權限檢查（requireCourseManageAccess 或同等）、AdminLog、revalidatePath
- [ ] AC-13：gateway=stripe 時儲存同步 recurring Price（DB-key client；變價建新 Price 不歸檔仍被訂閱使用的舊 Price；失敗不阻擋儲存）
- [ ] AC-14：gateway 不支援（SHOPLINE／未設定）時區塊顯示告警；課程 landingPageMode=html 或 landingPageSlug 非 default registry 時顯示「客製銷售頁需手動更新才會顯示訂閱選項」提示
- [ ] AC-15：StickySaveBar dirty 正確涵蓋動態方案列表的新增/刪除/修改

### D. 銷售頁
- [ ] AC-16：LandingPageProps 新增訂閱方案資料且**全部 optional**（客戶站客製頁升級編譯相容）；僅「有啟用方案且 gateway 支援」時填入
- [ ] AC-17：default.tsx 未購買狀態渲染方案選項：每期價格、週期；FIXED_TERM 顯示「NT$Y × N 期＝總計 NT$X」與「中途取消不轉永久、已繳不退」摘要；點擊導向帶 plan 的結帳頁
- [ ] AC-18：PricingSection 接受可選訂閱方案 props 並渲染；repo 內三個已註冊客製頁（ios-vibe-coding/react-beginner/test-course）更新傳入
- [ ] AC-19：sticky-cta 有方案時顯示訂閱入口（optional props，未傳不渲染）
- [ ] AC-20：課程促銷顯示與方案並存時，標示「促銷價僅適用買斷」
- [ ] AC-21：訂閱中（權限有效）用戶造訪銷售頁走已購買分支；無方案/全停用/gateway 不支援時不渲染任何訂閱 UI

### E. 結帳與訂單建立
- [ ] AC-22：createOrderSchema 支援 planId+recurringConsent；API 驗證：方案 enabled、課程狀態、gateway 支援、**recurringConsent 必為 true 否則 4xx**
- [ ] AC-23：訂閱建立時持久化 consentAt 與 consentTextVersion 到 CourseSubscription；後台訂閱詳情可查看
- [ ] AC-24：訪客/guest shell 帶 planId 被 4xx 拒絕（明確錯誤碼）；結帳頁未登入顯示登入引導，**OAuth callbackUrl 保留 plan 參數**
- [ ] AC-25：阻擋規則：任何有效（未撤銷未過期）Purchase → 拒絕並回「可觀看至 X 日」資訊；已有 ACTIVE/PAST_DUE 訂閱 → 拒絕；已過期/撤銷 → 放行
- [ ] AC-26：PENDING 復用/汰換：30 分鐘內同 user+course+plan 復用（含第 1 期 Order）；stale PENDING 建新時交易內轉 CANCELED('checkout_abandoned') 並 best-effort expire Stripe session；放棄後重試可成功
- [ ] AC-27：建單交易內建 CourseSubscription(PENDING)+第 1 期 Order(PENDING, periodNumber=1)，發票偏好寫入訂閱快照與 Order
- [ ] AC-28：結帳頁訂閱模式揭露：每期金額/週期/期數/FIXED_TERM 總繳金額/期滿行為/下次扣款日（PAYUNi 月繳含「每月 N 日，當月無此日則月底」）/取消政策全文（含不轉永久、已繳不退）/擴充版數位內容例外同意文字；必勾自動扣款同意；不顯示買斷 accessPolicy 文案；優惠券區隱藏
- [ ] AC-29：API 對 planId+couponCode 拒絕或忽略（擇一，前後端一致）
- [ ] AC-30：買斷結帳（無 planId）路徑不變：不建訂閱、原有復用/零元/發票/優惠券路徑不受影響；訂閱訂單不進既有 30 分鐘 Order 復用（或復用鍵含 planId）
- [ ] AC-31：訂閱結帳金額 = plan.price（不吃課程促銷價）

### F. Stripe 訂閱
- [ ] AC-32：Customer find-or-create：customers.create 帶冪等鍵 `customer_create_{userId}`；本地 `updateMany({ where: { id, stripeCustomerId: null } })` 條件寫入，count=0 時改用既有值
- [ ] AC-33：Checkout `mode:'subscription'`，line_items 用 plan.stripePriceId（缺失時 price_data.recurring 降級）；session 與 subscription 層 metadata 都含 subscriptionId/orderNo
- [ ] AC-34：mode=subscription 的 checkout.session.completed **不落入既有一次性 handlePaidCheckoutSession**；該事件路徑：記 gatewaySubscriptionId、將第 1 期 PENDING Order 轉 PAID、訂閱 ACTIVE、Purchase 展期、觸發 post-payment side effects
- [ ] AC-35：invoice.paid 處理不依賴 session 事件先到：以 subscription metadata（經 invoice.parent.subscription_details 解析，必要時 retrieve subscription）取回本地訂閱；**解析不到回非 2xx** 令 Stripe 重試；billing_reason=subscription_create 走「更新預建第 1 期 Order」路徑，續期走「原子 create、unique 衝突=已處理」
- [ ] AC-36：currentPeriodEnd 取自 invoice line item 的 period.end（或 subscription item current_period_end），非 invoice 層 period；更新為 max(現值, 新值)
- [ ] AC-37：期款 Order.amount = invoice.amount_paid/100 實扣金額；與 pricePerPeriod 不符時照常處理+AdminLog 告警
- [ ] AC-38：invoice.payment_failed：僅 ACTIVE→PAST_DUE 首次轉態寄失敗信與 PostHog 事件（重試期間靜默）；customer.subscription.deleted：非 COMPLETED 時轉 CANCELED、寄「訂閱已終止」信、管理員告警；FIXED_TERM 未繳滿時設 attentionReason='TERM_ENDED_UNDERPAID' 且不轉 COMPLETED
- [ ] AC-39：FIXED_TERM 繳滿：同交易 COMPLETED（+GRANT_LIFETIME 時 Purchase 轉永久）→ 交易後 subscriptions.cancel；cancel 失敗寫 pendingGatewayCancelAt；期滿後又扣的期款走異常期款路徑（自動退款+告警）

### G. PAYUNi 訂閱
- [ ] AC-40：以 `/api/period/Page`（testMode 對應 sandbox 網域）form_post 建立：MerTradeNo=gatewayTradeNo（≤25 碼自產）、PeriodAmt、PeriodType=month|year、**PeriodDate 依 PRD §4.1 推導（月=建單日 day-of-month、年=建單日+1 年 YYYY-MM-DD）**、PeriodTimes（FIXED_TERM=N、UNLIMITED=900）、FType=build、API3D=1、訂閱專用 NotifyURL/ReturnURL；加密複用 payuni-crypto
- [ ] AC-41：新增訂閱專用 period Notify route（不混用既有 /api/payment/notify）：驗簽、時間戳重放防護、以 PeriodOrderNo 為 gatewayPeriodKey 冪等；首期（_1）走更新預建 Order 路徑
- [ ] AC-42：新增訂閱專用 period Return route：解密後以 gatewayTradeNo 反查訂閱 → 以首期 Order.orderNo 導向 /checkout/success（成功頁輪詢可運作）
- [ ] AC-43：成功期處理：期款 Order.amount=AuthAmt 實扣（不符快照時告警）、periodNumber=ThisPeriod（允許失敗期空洞）、paidPeriods=交易內 PAID 期款 count、currentPeriodEnd 依 NextAuthDate 或週期推算取 max、Purchase 展期、開發票、寄信；失敗期：PAST_DUE+失敗信（轉態去重）+管理員告警
- [ ] AC-44：取消先呼叫 mdfStatus end（帶 PeriodTradeNo）成功後才寫本地 CANCELED；gateway 失敗時回錯誤不改狀態；後台對 PAST_DUE 提供 reauth 重新扣款動作
- [ ] AC-45：最後排程期（NextAuthDate 空或 ThisPeriod==TotalTimes）處理時 paidPeriods<totalPeriods → 不轉 COMPLETED、設 attentionReason、管理員告警；reauth 晚到補扣成功後繳滿判定仍正確（count 語意天然支持）
- [ ] AC-46：CANCELED 訂閱收到 period Notify（代表 end 未生效）→ 異常期款路徑+告警明示

### H. 續扣共用引擎（兩 gateway 共用的處理核心）
- [ ] AC-47：存在共用的期款處理服務（如 lib/subscription/renewal.ts）：單一 DB 交易內完成「冪等建/更新期款 Order → count 重算 paidPeriods → max 更新 currentPeriodEnd → 訂閱狀態機 → Purchase 展期（expiresAt=currentPeriodEnd+7 天，常數 SUBSCRIPTION_GRACE_DAYS=7）→ 期滿判定」
- [ ] AC-48：期款處理前檢查訂閱 status：非 ACTIVE/PAST_DUE（含首期的 PENDING 例外）→ 異常期款路徑：建異常標記 Order、不展期、Stripe 自動退款/PAYUNi 標記人工、AdminLog+管理員告警
- [ ] AC-49：Purchase 展期走 upsertPaidPurchase（source=SUBSCRIPTION、取較晚到期日語意保留）且展期時清除未來 CourseExpirationReminder

### I. 權限與斷權
- [ ] AC-50：stream-url 與 lesson-progress 改 allowlist（僅 granted/free 放行）
- [ ] AC-51：checkCoursePurchased 對訂閱中權限有效者回 true；過期回 false（銷售頁回到可購買）
- [ ] AC-52：SUBSCRIPTION 來源 Purchase 排除於 course-expiration cron 的提醒與過期通知
- [ ] AC-53：payment/create 與 checkout page 買斷阻擋改 isPurchaseActive()（過期可回購、可訂閱；有效期內照擋）

### J. 前台訂閱管理
- [ ] AC-54：新增 /my-subscriptions（需登入）：逐狀態顯示（ACTIVE：下次扣款日/金額；PAST_DUE：Stripe hosted_invoice 補繳連結、PAYUNi 自救指引+「取消並重新訂閱」動線+聯絡信箱；CANCELED：可觀看至 X 日；COMPLETED(END_ACCESS)：存取截止日；FIXED_TERM：已繳 N/M 期+「再繳 K 期即轉永久」）；期款歷史逐筆連到訂單
- [ ] AC-55：提供「更新發票資訊（適用未來期款）」表單：複用 checkoutInvoiceSchema 驗證、更新訂閱快照、本人驗證
- [ ] AC-56：取消 Server Action：本人驗證、僅 ACTIVE/PAST_DUE、先 gateway 後本地、Dialog 與信件顯示實際存取截止日（含寬限）與「分期不轉永久、已繳不退、恢復管道」
- [ ] AC-57：header 用戶下拉選單新增「我的訂閱」；/my-courses 訂閱課卡顯示徽章+下次扣款日連向 /my-subscriptions
- [ ] AC-58：取消且斷權後可重新訂閱或買斷（UI 可走通）；取消但仍在已付期間 → 結帳被 AC-25 擋並顯示可觀看至日期

### K. 後台訂閱管理
- [ ] AC-59：/admin/subscriptions：requireOnlyAdminAuth、統計卡（活躍、MRR、PAST_DUE）、列表（狀態/課程篩選+分頁+attentionReason 醒目標示「已終止但未繳滿(N/M)」等）、詳情（方案快照、期款歷史、consentAt/consentTextVersion、發票偏好編輯+AdminLog）
- [ ] AC-60：後台代學員取消（同 AC-56 語意+AdminLog CANCEL_SUBSCRIPTION）
- [ ] AC-61：訂單列表/詳情期款標記「訂閱第 N 期」+連結；退款 Dialog 對訂閱期款顯示取消+收回權限警告
- [ ] AC-62：markAsRefunded 訂閱分支：撤權以訂閱 (userId, courseId) 定位 Purchase（不依賴 orderId 反查）；退款成功 → gateway 取消（失敗寫 pendingGatewayCancelAt）→ 訂閱 CANCELED
- [ ] AC-63：Sidebar 銷售與金流組新增訂閱管理（adminOnly）
- [ ] AC-64：後台告警：訂閱心跳 SiteSetting 逾 48 小時 → /admin/subscriptions 顯示「排程未運作」告警；存在 ACTIVE Stripe 訂閱且 currentPeriodEnd+寬限已過仍無新 invoice.paid → 顯示 webhook 設定告警
- [ ] AC-65：金流設定頁 Stripe webhook 說明文案更新為完整事件清單（checkout.session.completed、async_payment_succeeded/failed、invoice.paid、invoice.payment_failed、customer.subscription.deleted）

### L. Email
- [ ] AC-66：新增 8 個用戶模板+1 個管理員告警模板（PRD §7 清單），登記 emailTemplateDescriptions，走 EmailBranding+escapeHtml
- [ ] AC-67：首期成功寄「訂閱成功」信且不重複寄標準購買確認信；第 2 期起寄收據信（含管理訂閱連結）
- [ ] AC-68：失敗信/終止信/取消信含 PRD §4.6–4.7 規定的指引內容；全部 fire-and-forget 容錯不阻斷金流
- [ ] AC-69：管理員告警信觸發點：PAST_DUE 轉態、gateway 終止、異常期款、TERM_ENDED_UNDERPAID、webhook 失聯偵測

### M. 排程與維運
- [ ] AC-70：`GET /api/cron/subscription-maintenance`：僅 Bearer CRON_SECRET（不收 query param；production 未設 secret 拒絕）；職責：即將扣款提醒、存取即將結束信、stale PENDING 清理（>24h→CANCELED）、pendingGatewayCancelAt 重試、異常偵測+attentionReason、心跳
- [ ] AC-71：提醒防重以條件式 updateMany 先 claim（reminderSentForPeriod / accessEndNoticeSentAt）再寄，並發不重寄
- [ ] AC-72：newsletter-dispatch piggyback：maintenance **先跑**且硬性時間預算 ≤10 秒、dispatch 視窗相應縮短（總和 <55s）、SiteSetting 時間戳條件式 updateMany 原子 claim（開始時 claim）每 20 小時一次、錯誤隔離
- [ ] AC-73：vercel.json 註冊 subscription-maintenance；/onboarding 與 /upgrade-platform skill 增補「檢查 newsletter worker 存在與心跳，缺失補建」步驟說明
- [ ] AC-74：AGENTS.customer.md 增補：訂閱功能說明、PAYUNi 續期收款開通申請提示、Stripe webhook 事件清單、客服 SOP（首期 7 日解約=退首期、未繳滿救援、發票資訊變更）

### N. 追蹤與日誌
- [ ] AC-75：PostHog：subscription_started/renewed/canceled/completed；subscription_payment_failed 僅轉態時發（或帶 attempt 屬性）；checkout 漏斗事件加 plan_type
- [ ] AC-76：管理員取消記 AdminLog（CANCEL_SUBSCRIPTION）；方案 CRUD 記 UPDATE_COURSE；異常期款/退款記對應 AdminLog

### O. 回歸保護
- [ ] AC-77：無訂閱方案課程買斷全流程（bundle、免費課、優惠券、零元單、ATM/CVS、退款、發票）行為不變，**例外僅限 PRD §9 三項**：(1) stream-url/lesson-progress 過期改拒絕 (2) 過期回購從 400 改放行 (3) 展期清提醒記錄
- [ ] AC-78：未設定金流站台：銷售頁正常渲染（無 500）、無訂閱 UI；SHOPLINE 站台三處降級一致
- [ ] AC-79：`pnpm build` 與 `pnpm lint` 通過

## 排除範圍
SHOPLINE 訂閱、訂閱優惠券、Bundle 訂閱、多幣別、方案升降級、自助換卡、按比例退款、試用期、UNLIMITED 年化成本錨點。
