# 臺灣電子發票（統一發票）整合 — BDD 規格

## 概述

讓購買本平台原始碼的**講師／營運者（營業人）**，能在後台自助設定臺灣電子發票加值中心（綠界 ECPay／藍新 ezPay）憑證，並在學員購課付款成功後**自動或手動開立電子發票**，同時支援**作廢**與**折讓**。

此功能為**可選、預設關閉**：未啟用時平台行為與現在完全相同（不收發票資訊、不開立發票），符合平台「Simple-first、功能上線後再啟用」的一貫設計。同時將「金流」從綜合設定頁獨立成專屬後台頁面 `/admin/payments`，內含「金流收款」與「臺灣統一發票」兩個分頁。

**技術選型**：採用 npm 套件 [`@paid-tw/einvoice`](https://github.com/paid-tw/einvoice)（純 TypeScript、MIT、provider-agnostic）+ `@paid-tw/einvoice-ecpay` / `@paid-tw/einvoice-ezpay` adapter，包在自家 `lib/invoice/` 抽象層後面（對應現有 `lib/payment/` 模式）。**ECPay 優先實作、ezPay 次之**。

> ⚠️ 重要前置事實：PAYUNi（統一金流）**沒有開立發票的 API**。用 PAYUNi 收款的講師，發票一律透過 ECPay／ezPay 開立。因此「發票供應商」與「金流 gateway」**完全解耦、各自設定**。

---

## 角色定義

- **講師 / 營運者**：購買並部署本平台的人，後台角色為 `ADMIN`（部分操作開放 `EDITOR`）。是發票的「賣方」。
- **學員 / 買受人**：在前台購課的消費者。是發票的「買受人」。

---

## 完整 UX 全流程（講師買了系統後怎麼用）

### 階段 A — 設定（一次性）
1. 講師登入後台，左側欄出現新項目 **「金流收款」**（`/admin/payments`）。
2. 進入後看到兩個大分頁：**「金流收款」**（原金流設定，原封不動）、**「臺灣統一發票」**。
3. 切到「臺灣統一發票」分頁，預設是**未啟用**狀態：畫面顯示一段說明 + 「**閱讀申請指南**」連結（指向 `docs/台灣電子發票啟用指南.md` 的線上版／外部連結）+ 一個「**啟用電子發票**」開關。
4. 講師打開開關後，展開設定表單：
   - **供應商**：綠界 ECPay／藍新 ezPay 二選一。
   - **憑證**：MerchantID、HashKey、HashIV（HashKey/IV 為敏感欄位，已存值只顯示遮蔽提示，留空＝不變更）。
   - **賣方資訊**：賣方名稱、賣方統編。
   - **測試模式**：開／關（決定打 stage 還是正式環境）。
   - **付款成功後自動開立**：開／關。
5. 講師驗證串接：
   - **測試模式**：按「測試連線 / 試開發票」，系統向測試環境送一張測試發票並回傳結果。
   - **正式模式**：按「驗證正式憑證（不開票）」，系統只呼叫唯讀查詢端點驗證正式憑證，不開票、不消耗字軌。
6. 測試成功後按 **「儲存」**。若要正式上線，講師關閉「測試模式」、確認「啟用電子發票」為開，再儲存。

### 階段 B — 學員購課（日常）
7. 發票功能啟用後，學員在 `/checkout` 結帳頁多看到一個 **「發票資訊」** 區塊，可選：
   - **個人**（預設）→ 可留空（開立雲端發票存會員載具）或填**手機條碼載具**（`/` 開頭 8 碼）。
   - **公司**（B2B）→ 填**買方統一編號**（8 碼）+ **公司抬頭**。
   - **捐贈** → 填**捐贈碼 / 愛心碼**（3–7 碼數字）。
8. 學員完成付款。

### 階段 C — 開立與管理
9. 付款成功後：
   - 若「自動開立」為**開** → 系統自動向加值中心開立發票，發票號碼寫回該訂單。
   - 若為**關** → 訂單發票狀態顯示「未開立」，等待講師手動處理。
10. 講師到 **「訂單管理」** 列表，每筆訂單多一個 **「發票」** 狀態欄（未開立／已開立 發票號碼／已作廢／已折讓／開立失敗）。
11. 點進**訂單詳情**，依發票狀態出現對應操作按鈕：
    - 未開立且已付款 → **「開立發票」**
    - 已開立 → **「作廢」**、**「折讓」**
12. 學員退款／退課時，講師在訂單詳情點 **「折讓」** 開立折讓單沖銷稅額（跨期無法作廢時的正確做法）。

---

## 行為規格

### 場景 1：金流設定獨立成專屬頁面
**Given** 講師以 `ADMIN` 身分登入後台
**When** 查看左側導覽列
**Then** 看到「金流收款」項目，連到 `/admin/payments`；該頁含「金流收款」「臺灣統一發票」兩分頁；原 `/admin/settings` 頁面**不再**顯示金流設定區塊。

### 場景 2：金流收款分頁沿用既有功能
**Given** 講師在 `/admin/payments` 的「金流收款」分頁
**When** 設定 Stripe／PAYUNi 並儲存
**Then** 行為與改版前的金流設定完全一致（可儲存、可測試連線），既有金流設定值不流失。

### 場景 3：發票功能預設關閉，平台照常運作
**Given** 一個全新部署、從未設定過電子發票
**When** 學員購課並付款成功
**Then** 結帳頁**不**顯示發票資訊區塊；系統**不**嘗試開立發票；付款、開通課程、寄信等流程完全正常，無任何錯誤或警告中斷。

### 場景 4：講師啟用發票並填入憑證
**Given** 講師在「臺灣統一發票」分頁
**When** 打開「啟用電子發票」、選綠界 ECPay、填入 MerchantID/HashKey/HashIV/賣方資訊並儲存
**Then** 設定寫入 `SiteSetting`；HashKey/HashIV 以遮蔽形式回顯；再次編輯時這兩欄留空代表沿用原值不覆蓋。

### 場景 5：測試連線 / 試開發票
**Given** 講師已填入（測試）憑證但尚未確定正確
**When** 點「測試連線 / 試開發票」
**Then** 系統用測試環境向加值中心送出一筆測試開立，回傳「成功（含測試發票號碼）」或「失敗（含錯誤訊息）」，且**不**影響任何真實訂單。

### 場景 6：儲存發票設定的驗證與稽核
**Given** 講師填寫發票設定
**When** 提交儲存
**Then** 後端以 Zod 驗證欄位（統編 8 碼、必填項）；通過才寫入；操作記錄到 `AdminLog`（action 例如 `UPDATE_EINVOICE_SETTINGS`）。

### 場景 7：結帳頁收集買受人發票資訊
**Given** 發票功能已啟用，學員在 `/checkout`
**When** 學員選擇發票類型
**Then**
- 選「公司」時必須填 8 碼統編 + 抬頭，否則無法送出且顯示錯誤；
- 選「個人 + 手機條碼」時驗證 `/` 開頭 8 碼格式；
- 選「捐贈」時驗證 3–7 碼數字；
- 這些資訊隨建立訂單一併送出並存於 `Order`。

### 場景 8：付款成功後自動開立發票（冪等）
**Given** 發票功能啟用、「自動開立」為開、某訂單付款成功
**When** 付款成功 hook（`post-payment-actions`）執行
**Then** 系統依訂單上的發票資訊向加值中心開立發票，發票號碼與狀態寫回；**即使 hook 因 webhook 重送而重複觸發，同一訂單也只會開立一次**（資料庫唯一約束 + provider 固定對帳編號 + 重試前唯讀查詢共同保證冪等）。

### 場景 9：自動開立關閉時可手動開立
**Given** 「自動開立」為關、某訂單已付款且尚未開立
**When** 講師在訂單詳情點「開立發票」
**Then** 系統開立並更新狀態為「已開立」+ 發票號碼；重複點擊不會重複開立。

### 場景 10：訂單列表顯示發票狀態
**Given** 講師在「訂單管理」列表
**When** 檢視訂單
**Then** 每筆訂單顯示發票狀態標籤（未開立／已開立＋號碼／已作廢／已折讓／開立失敗）。

### 場景 11：作廢發票
**Given** 某訂單發票狀態為「已開立」且在可作廢期間
**When** 講師在訂單詳情點「作廢」並確認
**Then** 系統向加值中心送作廢，成功後狀態更新為「已作廢」，並記錄 `AdminLog`。

### 場景 12：折讓（退款沖銷）
**Given** 某已開立發票的訂單發生退款／退課
**When** 講師在訂單詳情點「折讓」並輸入折讓金額（預設為全額）
**Then** 系統向加值中心開立折讓單，成功後狀態更新為「已折讓」，並記錄 `AdminLog`。

### 場景 13：開立失敗不影響付款與開通
**Given** 發票功能啟用、自動開立為開，但加值中心回傳錯誤（憑證錯誤／額度用罄等）
**When** 自動開立失敗
**Then** 訂單發票狀態標記為「開立失敗」並保存錯誤訊息；學員的付款、課程開通、信件**完全不受影響**；講師可稍後在訂單詳情重試開立。

### 場景 14：權限控管
**Given** 任意使用者
**When** 存取 `/admin/payments` 或呼叫發票相關 Server Action
**Then** 僅 `ADMIN`（發票設定）／`ADMIN`‧`EDITOR`（依現有 `requireAdminAuth` 慣例）可存取；未授權者被擋下或重導。

### 場景 15：ezPay 使用固定 20 字對帳編號
**Given** 平台訂單號為 27 字，發票供應商為 ezPay
**When** 自動開立、手動開立或失敗重試建立 ezPay `PostData_`
**Then** `MerchantOrderNo` 固定為 `EZ` + 原訂單號 SHA-256 前 18 碼（共 20 個 ASCII 字元）；同一訂單每次結果相同；ECPay `RelateNumber` 仍保留完整平台訂單號。

### 場景 16：安全重試與遠端狀態回填
**Given** 本地發票狀態為 `FAILED`，可能是遠端成功後回應逾時或本地寫入失敗
**When** 管理員點「重新開立發票」
**Then** 系統先以同一 provider 對帳編號唯讀查詢；若遠端已有發票則同步號碼／狀態並停止，不再開第二張；只有明確 `NOT_FOUND` 才重送開立；憑證、網路或金額不一致時停止並回報錯誤。

### 場景 17：正式模式安全驗證憑證
**Given** 管理員填入正式環境 MerchantID / HashKey / HashIV 並關閉測試模式
**When** 點「驗證正式憑證（不開票）」
**Then** 系統呼叫 ECPay／ezPay 唯讀發票查詢端點；`NOT_FOUND` 視為連線與憑證驗證成功；AUTH／NETWORK 等錯誤照實回報；全程不開立發票、不消耗字軌。

### 場景 18：切換發票供應商不可沿用舊金鑰
**Given** 管理員已儲存其中一家供應商憑證
**When** 啟用狀態下切換到另一家供應商但未重新輸入 HashKey / HashIV
**Then** 系統拒絕儲存並要求輸入新憑證；HashKey / HashIV 同時驗證 provider 所需的 ASCII byte 長度。

### 場景 19：ezPay 折讓與作廢欄位符合限制
**Given** ezPay 發票需要折讓或作廢
**When** 系統建立 allowance request 或送出作廢原因
**Then** 折讓 `MerchantOrderNo` 為固定 20 字識別碼，同一「訂單＋折讓前累計＋本次金額」重試時不變；作廢原因自動限制在 20 UTF-8 bytes 內。

---

## Acceptance Criteria

**A. 金流頁面獨立**
- [ ] AC-01：後台側欄（桌機與手機）出現「金流收款」項目，連至 `/admin/payments`。
- [ ] AC-02：`/admin/payments` 以 shadcn `Tabs` 呈現「金流收款」「臺灣統一發票」兩分頁。
- [ ] AC-03：`/admin/settings` 頁面與其 scroll-spy 導覽**不再**包含金流設定區塊。
- [ ] AC-04：「金流收款」分頁可正常讀取／儲存／測試 Stripe 與 PAYUNi 設定（既有功能不退化）。
- [ ] AC-05：`/admin/payments` 受 middleware 保護，未登入或無權限者無法存取。

**B. 發票設定**
- [ ] AC-06：「臺灣統一發票」分頁預設顯示未啟用狀態 + 申請指南連結 + 啟用開關。
- [ ] AC-07：可設定供應商（ecpay／ezpay）、MerchantID、HashKey、HashIV、賣方名稱、賣方統編、測試模式、自動開立，並寫入 `SiteSetting` 對應 `einvoice_*` keys。
- [ ] AC-08：HashKey／HashIV 屬敏感欄位，回顯為遮蔽值；提交時留空＝不變更原值。
- [ ] AC-09：測試模式可試開測試發票；正式模式改以唯讀查詢驗證正式憑證，且不開票、不消耗字軌。
- [ ] AC-10：儲存發票設定會經 Zod 驗證並寫入 `AdminLog`。

**C. 結帳收集發票資訊**
- [ ] AC-11：發票功能**啟用時**，結帳頁顯示「發票資訊」區塊；**未啟用時**不顯示。
- [ ] AC-12：選「公司」需填 8 碼統編＋抬頭；選「手機條碼」驗證 `/`＋7 碼；選「捐贈」驗證 3–7 碼數字；驗證失敗無法送出。
- [ ] AC-13：所選發票資訊隨 `/api/payment/create` 送出並持久化於 `Order`。

**D. 開立／作廢／折讓**
- [ ] AC-14：自動開立為開時，付款成功後系統開立發票並把發票號碼／狀態寫回訂單。
- [ ] AC-15：同一訂單在 webhook 重送／管理員重試情況下**只會開立一次**（DB 唯一約束、固定 provider 對帳編號、遠端查詢後再重送）。
- [ ] AC-16：自動開立為關時，講師可於訂單詳情手動「開立發票」。
- [ ] AC-17：訂單列表顯示每筆訂單的發票狀態。
- [ ] AC-18：已開立發票可在訂單詳情「作廢」，成功後狀態更新並記錄 `AdminLog`。
- [ ] AC-19：已開立發票可在訂單詳情「折讓」（可指定金額），成功後狀態更新並記錄 `AdminLog`。
- [ ] AC-20：開立失敗時訂單標記「開立失敗」+ 錯誤訊息，且**不影響**付款／開通／寄信流程；可重試。

**E. 架構與相容**
- [ ] AC-21：發票邏輯封裝於 `lib/invoice/`（types + factory + adapter 包裝 `@paid-tw/einvoice`），對應 `lib/payment/` 模式；憑證來源為 `SiteSetting`。
- [ ] AC-22：`@paid-tw/einvoice` 僅在 Node runtime 的 Server Action／Route Handler 中呼叫，不在 Edge middleware 中使用；專案可成功 `pnpm build`（zod 4 與套件自帶 zod 3 共存無衝突）。
- [ ] AC-23：ezPay 最終加密 `PostData_` 的 `MerchantOrderNo` 固定為 20 字以內；ECPay `RelateNumber` 不受影響。
- [ ] AC-24：正式憑證驗證、失敗補開皆先走唯讀查詢；AUTH／NETWORK／金額不符時不得繼續開立。
- [ ] AC-25：啟用狀態切換 provider 時必須輸入新 HashKey / HashIV，並驗證 ASCII byte 長度（ECPay 16/16、ezPay 32/16）。
- [ ] AC-26：ezPay 折讓 `MerchantOrderNo` 不超過 20 字且重試固定；作廢原因不超過 20 UTF-8 bytes。

---

## 技術設計摘要（實作參考，非行為規格）

### 套件
- `@paid-tw/einvoice@0.4.0`（pin 版本，不用 `^`）+ `@paid-tw/einvoice-ecpay@0.4.0`（先）+ `@paid-tw/einvoice-ezpay@0.4.0`（後）。ESM、server-only。

### 新增設定 keys（`lib/validations/settings.ts` 的 `SETTING_KEYS`）
`einvoice_enabled`、`einvoice_provider`、`einvoice_merchant_id`、`einvoice_hash_key`(敏感)、`einvoice_hash_iv`(敏感)、`einvoice_test_mode`、`einvoice_auto_issue`、`einvoice_seller_name`、`einvoice_seller_tax_id`。

### Prisma（新 migration）
- **`Order`** 新增買受人發票偏好欄位：`invoiceType`(PERSONAL/COMPANY/DONATION)、`invoiceCarrierType`、`invoiceCarrierId`、`invoiceTaxId`、`invoiceTitle`、`invoiceLoveCode`。
- 新增 **`Invoice`** model（與 `Order` 1:1，`orderId @unique` 保證冪等）：`provider`、`invoiceNumber`、`randomNumber`、`status`(PENDING/ISSUED/FAILED/VOIDED/ALLOWANCE_ISSUED)、`amount`、`allowanceAmount`、`issuedAt`、`voidedAt`、`failReason`、`rawResponse Json`、`createdAt`、`updatedAt`。
- 新增 enum `InvoiceStatus`、`InvoiceType`。

### 檔案地圖
**新增**：`app/(admin)/admin/payments/page.tsx`、`components/admin/payments/payments-tabs.tsx`、`components/admin/payments/einvoice-settings-form.tsx`、`lib/invoice/{types,factory,ecpay-adapter,ezpay-adapter,index}.ts`、`lib/actions/einvoice.ts`、`lib/validations/einvoice.ts`、結帳發票欄位元件。
**修改**：`components/admin/sidebar.tsx`（加導覽項）、`app/(admin)/admin/settings/{page,client}.tsx`（移除金流區塊）、`components/admin/settings/settings-sidebar-nav.tsx`、`lib/actions/settings.ts`（敏感 keys＋revalidate 路徑）、`app/(main)/checkout/checkout-client.tsx`（發票區塊）、`app/api/payment/create/route.ts`（接收並存發票資訊）、`lib/payment/post-payment-actions.ts`（自動開立 hook）、`components/admin/orders/order-table.tsx`、`app/(admin)/admin/orders/[id]/page.tsx`（狀態欄＋操作）。

---

## 排除範圍（Out of Scope）

- 財政部大平台 / Turnkey 直連（一律走加值中心）。
- PAYUNi 原生電子發票（其 API 不存在）。
- B2B 三聯式「存證模式」進階流程、跨境 ezPay 外幣發票。
- 載具歸戶查詢、中獎通知、發票寄送列印（由加值中心處理）。
- 自動對帳 / 發票報表匯出。
- 多語系發票內容。
- Amego 等其他加值中心（架構保留可擴充，但本次不實作）。
