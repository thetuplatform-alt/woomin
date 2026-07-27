# 優惠券系統（Coupon System） — BDD 規格

## 概述

讓平台管理者能建立與管理優惠券，學員在結帳頁輸入優惠碼即可享有折扣。系統自行管理折扣邏輯（不依賴 Stripe 原生 Promotion Code），確保 Stripe 與 PAYUNi 兩套金流行為一致。

---

## 行為規格

### 場景群組 A：資料模型與基礎建設

#### 場景 A1：Coupon 資料模型
**Given** 系統需要儲存優惠券資訊
**When** 執行資料庫遷移
**Then** 建立 `Coupon` 資料表，包含以下欄位：
  - `id` (主鍵)
  - `name` (名稱，內部識別)
  - `code` (代碼，唯一，大寫)
  - `description` (說明，選填)
  - `discountType` (枚舉：`AMOUNT` 固定金額 / `PERCENT` 百分比)
  - `amountOff` (固定折抵金額，整數，選填)
  - `percentOff` (百分比折扣 1-100，選填)
  - `maxDiscountAmount` (百分比折扣上限金額，選填)
  - `maxRedemptions` (總兌換次數上限，null=無限)
  - `timesRedeemed` (已兌換次數，預設 0)
  - `maxPerUser` (每人使用上限，null=無限)
  - `minimumAmount` (最低消費金額，選填)
  - `firstTimeOnly` (僅限首購用戶，預設 false)
  - `active` (啟用狀態，預設 true)
  - `startsAt` (生效時間，null=立即)
  - `expiresAt` (到期時間，null=永不)
  - `createdAt`, `updatedAt`
  - 與 `Course` 的多對多關聯（適用課程範圍，空=全站適用）

#### 場景 A2：CouponRedemption 使用記錄
**Given** 系統需要追蹤優惠券的使用情況
**When** 執行資料庫遷移
**Then** 建立 `CouponRedemption` 資料表，包含：
  - `id`, `couponId`, `userId`, `orderId`
  - `amount` (實際折抵金額)
  - `createdAt`
  - couponId + userId 的複合索引（快速查詢個人使用次數）

#### 場景 A3：Order 擴充
**Given** 訂單需要記錄優惠券資訊
**When** 執行資料庫遷移
**Then** `Order` 資料表新增：
  - `couponId` (關聯到 Coupon，選填)
  - `couponDiscount` (優惠券折抵金額，選填)

---

### 場景群組 B：後台優惠券管理

#### 場景 B1：優惠券列表頁
**Given** 管理員進入後台
**When** 點擊側邊欄「優惠券」導航項目
**Then** 看到 `/admin/coupons` 頁面，顯示所有優惠券列表，包含：名稱、代碼、折扣內容、已使用/上限、狀態 badge（啟用/停用/已過期）、有效期間

#### 場景 B2：建立新優惠券
**Given** 管理員在優惠券列表頁
**When** 點擊「新增優惠券」按鈕並填寫表單
**Then** 系統驗證輸入後建立優惠券：
  - 代碼自動轉為大寫
  - 代碼不可與既有代碼重複
  - 折扣類型為「固定金額」時必填 `amountOff`
  - 折扣類型為「百分比」時必填 `percentOff`（1-100）
  - 建立成功後導回列表頁並顯示成功訊息

#### 場景 B3：編輯優惠券
**Given** 管理員在優惠券列表頁
**When** 點擊某張優惠券的「編輯」按鈕
**Then** 進入編輯頁面，可修改所有欄位（代碼除外），儲存後返回列表

#### 場景 B4：停用/啟用優惠券
**Given** 管理員在優惠券列表頁
**When** 切換某張優惠券的啟用狀態
**Then** 優惠券的 `active` 狀態即時更新，停用後學員無法再使用該代碼

#### 場景 B5：側邊欄導航
**Given** 管理員進入後台
**When** 查看側邊欄
**Then** 在「訂單管理」下方看到「優惠券」導航項目（帶有 Ticket 圖示）

---

### 場景群組 C：前台優惠碼驗證 API

#### 場景 C1：驗證成功 — 固定金額折扣
**Given** 存在一張啟用中的優惠券，代碼 `SAVE200`，類型為固定金額折抵 NT$200，適用全站
**When** 用戶在結帳頁輸入代碼 `save200`（不分大小寫）並提交驗證
**Then** 系統回傳驗證成功，折抵金額 NT$200，以及套用後的最終價格

#### 場景 C2：驗證成功 — 百分比折扣
**Given** 存在一張啟用中的優惠券，代碼 `OFF20`，類型為百分比折扣 20%，上限 NT$500
**When** 用戶對一個 NT$3,000 的課程使用此代碼
**Then** 系統回傳折抵金額 NT$600，但因上限限制，實際折抵 NT$500

#### 場景 C3：驗證成功 — 百分比折扣無上限
**Given** 存在一張啟用中的優惠券，代碼 `OFF20`，類型為百分比折扣 20%，無上限
**When** 用戶對一個 NT$3,000 的課程使用此代碼
**Then** 系統回傳折抵金額 NT$600

#### 場景 C4：驗證失敗 — 代碼不存在
**Given** 不存在代碼為 `FAKE` 的優惠券
**When** 用戶輸入 `FAKE` 進行驗證
**Then** 系統回傳錯誤「此優惠碼不存在」

#### 場景 C5：驗證失敗 — 已停用
**Given** 優惠券 `OLDCODE` 的 active 為 false
**When** 用戶輸入 `OLDCODE` 進行驗證
**Then** 系統回傳錯誤「此優惠碼已失效」

#### 場景 C6：驗證失敗 — 不在有效期間
**Given** 優惠券 `EARLY` 的 startsAt 為未來日期，或 `EXPIRED` 的 expiresAt 已過
**When** 用戶輸入該代碼進行驗證
**Then** 系統回傳錯誤「此優惠碼不在有效期間內」

#### 場景 C7：驗證失敗 — 總兌換次數已滿
**Given** 優惠券 `LIMITED` 的 maxRedemptions=100，timesRedeemed=100
**When** 用戶輸入 `LIMITED` 進行驗證
**Then** 系統回傳錯誤「此優惠碼已達使用上限」

#### 場景 C8：驗證失敗 — 個人使用次數已滿
**Given** 優惠券 `ONCE` 的 maxPerUser=1，且該用戶已使用 1 次
**When** 同一用戶再次輸入 `ONCE` 進行驗證
**Then** 系統回傳錯誤「您已達此優惠碼的使用上限」

#### 場景 C9：驗證失敗 — 不適用於此課程
**Given** 優惠券 `COURSE_A` 僅適用於課程 A
**When** 用戶在課程 B 的結帳頁使用 `COURSE_A`
**Then** 系統回傳錯誤「此優惠碼不適用於此課程」

#### 場景 C10：驗證失敗 — 未達最低消費
**Given** 優惠券 `MIN1000` 的 minimumAmount=1000
**When** 用戶對一個 NT$500 的課程使用此代碼
**Then** 系統回傳錯誤「訂單金額未達最低消費 NT$1,000」

#### 場景 C11：驗證失敗 — 僅限首購用戶
**Given** 優惠券 `WELCOME` 的 firstTimeOnly=true
**When** 已有購買記錄的用戶使用此代碼
**Then** 系統回傳錯誤「此優惠碼僅限首次購買用戶使用」

#### 場景 C12：訪客用戶驗證
**Given** 訪客用戶（未登入）在結帳頁
**When** 輸入優惠碼進行驗證
**Then** 系統仍可驗證代碼的基本有效性（存在、啟用、有效期、適用課程、最低消費），但跳過個人使用次數和首購限制的檢查（因為無法確認身份）

---

### 場景群組 D：前台結帳頁 UI

#### 場景 D1：優惠碼輸入區塊
**Given** 用戶進入結帳頁（`/checkout?courseId=xxx`）
**When** 頁面載入完成
**Then** 在右欄「訂單摘要」的小計與總計之間，看到優惠碼輸入欄位和「套用」按鈕

#### 場景 D2：套用成功的 UI 變化
**Given** 用戶在優惠碼欄位輸入有效代碼
**When** 點擊「套用」按鈕且驗證成功
**Then**
  - 輸入欄位隱藏，改為顯示已套用的優惠券資訊（代碼名稱 + 折抵金額）
  - 顯示「✕」移除按鈕
  - 訂單摘要新增「優惠券折抵」行項目，顯示負數金額（如 `-NT$200`）
  - 「總計」金額即時更新為折後價

#### 場景 D3：套用失敗的 UI 提示
**Given** 用戶輸入無效的優惠碼
**When** 點擊「套用」按鈕且驗證失敗
**Then** 在輸入欄位下方顯示紅色錯誤訊息（對應各種失敗原因）

#### 場景 D4：移除已套用的優惠碼
**Given** 用戶已成功套用優惠碼
**When** 點擊「✕」移除按鈕
**Then**
  - 優惠券資訊消失，恢復顯示輸入欄位
  - 「優惠券折抵」行項目移除
  - 「總計」金額恢復為原本金額

#### 場景 D5：帶有優惠碼提交付款
**Given** 用戶已套用優惠碼
**When** 點擊「確認送出」按鈕
**Then** 請求 `/api/payment/create` 時帶上 `couponCode` 參數

---

### 場景群組 E：訂單建立與金流整合

#### 場景 E1：建立訂單時二次驗證優惠券
**Given** 用戶帶著 couponCode 提交訂單
**When** `/api/payment/create` 處理請求
**Then** 系統對優惠券進行完整的二次驗證（與 validate API 相同邏輯），驗證失敗則拒絕建立訂單

#### 場景 E2：折後金額寫入訂單
**Given** 優惠券驗證通過，課程促銷價 NT$2,990，優惠券折抵 NT$200
**When** 系統建立訂單
**Then**
  - `Order.amount` = 2,790（實際付款金額）
  - `Order.originalAmount` = 原價
  - `Order.couponId` = 優惠券 ID
  - `Order.couponDiscount` = 200

#### 場景 E3：Stripe 金流 — 使用折後價
**Given** 金流為 Stripe，訂單金額已含優惠券折扣
**When** 建立 Stripe Checkout Session
**Then** 使用 `price_data` 模式，金額為折後價（不使用 Stripe 原生 promotion code）

#### 場景 E4：PAYUNi 金流 — 使用折後價
**Given** 金流為 PAYUNi，訂單金額已含優惠券折扣
**When** 建立 PAYUNi 付款表單
**Then** `TradeAmt` = 折後價

#### 場景 E5：Webhook 確認後寫入兌換記錄
**Given** 訂單帶有 couponId
**When** Stripe Webhook 或 PAYUNi Notify 確認付款成功
**Then**
  - 建立 `CouponRedemption` 記錄（couponId, userId, orderId, 實際折抵金額）
  - `Coupon.timesRedeemed` 加 1
  - 以上操作在同一個 transaction 中完成

#### 場景 E6：折後價為零 — 跳過金流
**Given** 課程促銷價 NT$200，優惠券折抵 NT$200，折後價為 NT$0
**When** 系統建立訂單
**Then**
  - 不呼叫任何金流閘道
  - 直接建立 Order（status=PAID）和 Purchase 記錄
  - 建立 CouponRedemption
  - 執行 post-payment actions（歡迎信、追蹤等）

#### 場景 E7：折後價不可為負數
**Given** 課程促銷價 NT$100，優惠券固定折抵 NT$200
**When** 系統計算折後價
**Then** 折後價為 NT$0（下限為零），不可為負數

---

### 場景群組 F：退款時的優惠券處理

#### 場景 F1：退款不回復優惠券使用次數
**Given** 用戶使用優惠券購買課程後申請退款
**When** 管理員執行退款操作
**Then** `Coupon.timesRedeemed` 不減少，`CouponRedemption` 記錄保留（避免被濫用重複使用）

---

### 場景群組 G：訂單管理頁優惠券資訊

#### 場景 G1：訂單詳情顯示優惠券
**Given** 管理員查看一筆使用了優惠券的訂單
**When** 開啟訂單詳情
**Then** 可看到「優惠券」欄位，顯示優惠券代碼和折抵金額

---

## Acceptance Criteria

### 資料模型
- [ ] AC-01：Prisma schema 包含 `Coupon` model，具備所有規格中定義的欄位與枚舉
- [ ] AC-02：Prisma schema 包含 `CouponRedemption` model，具備 couponId+userId 複合索引
- [ ] AC-03：`Order` model 新增 `couponId` 和 `couponDiscount` 欄位
- [ ] AC-04：`Coupon` 與 `Course` 之間建立多對多關聯

### 後台管理
- [ ] AC-05：側邊欄在「訂單管理」下方顯示「優惠券」導航項目
- [ ] AC-06：`/admin/coupons` 頁面顯示優惠券列表，含名稱、代碼、折扣、使用量、狀態、有效期
- [ ] AC-07：可新增優惠券，表單包含所有必要欄位，代碼自動轉大寫並檢查唯一性
- [ ] AC-08：可編輯優惠券（代碼除外）
- [ ] AC-09：可切換優惠券的啟用/停用狀態

### 前台驗證 API
- [ ] AC-10：`POST /api/coupon/validate` 接受 `{ code, courseId }` 參數，回傳折扣資訊或錯誤
- [ ] AC-11：驗證代碼不分大小寫（輸入自動轉大寫比對）
- [ ] AC-12：所有驗證失敗情境回傳明確的中文錯誤訊息（不存在、已失效、過期、超限、不適用、未達最低消費、首購限制）
- [ ] AC-13：百分比折扣正確計算折抵金額，並受 maxDiscountAmount 上限限制
- [ ] AC-14：訪客用戶可驗證優惠碼的基本有效性，跳過個人相關限制

### 前台結帳 UI
- [ ] AC-15：結帳頁訂單摘要區塊包含優惠碼輸入欄位和「套用」按鈕
- [ ] AC-16：套用成功後顯示優惠券資訊、折抵金額、移除按鈕，並更新總計
- [ ] AC-17：套用失敗後在輸入欄位下方顯示紅色錯誤訊息
- [ ] AC-18：點擊移除按鈕可清除已套用的優惠碼，恢復原始金額
- [ ] AC-19：提交付款時 request body 包含 `couponCode` 參數

### 訂單建立與金流
- [ ] AC-20：`/api/payment/create` 接受 `couponCode` 參數，並進行完整的二次驗證
- [ ] AC-21：訂單的 `amount` 為折後金額，`couponId` 和 `couponDiscount` 正確寫入
- [ ] AC-22：Stripe Checkout Session 使用折後價建立 `price_data`
- [ ] AC-23：PAYUNi `TradeAmt` 為折後價
- [ ] AC-24：折後價為零時，跳過金流，直接建立 PAID 訂單和 Purchase 記錄
- [ ] AC-25：折後價下限為 0，不可為負數

### 兌換記錄
- [ ] AC-26：付款成功（Webhook/Notify）後，在同一 transaction 中建立 CouponRedemption 並遞增 timesRedeemed
- [ ] AC-27：退款時不回復 timesRedeemed，CouponRedemption 記錄保留

### 訂單管理
- [ ] AC-28：後台訂單詳情頁顯示優惠券代碼和折抵金額（若有使用）

---

## 排除範圍（Out of Scope）

- Stripe 原生 Promotion Code 的同步或整合（本系統獨立管理）
- 多張優惠券疊加（一筆訂單僅能使用一張）
- 優惠券的批量匯入/匯出
- 優惠券使用統計分析頁面（可在後續迭代加入）
- 推薦碼/邀請碼機制
- 訂閱制折扣（duration/repeating 概念，本平台為單次購買）
