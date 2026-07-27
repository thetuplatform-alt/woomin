# CRM 付款後寄信安全修復 — Debug SR

## 概述

本次 SR 要修的是「付款成功後，自動加入 CRM 流程並寄出 Email」這條線的安全性與穩定性。

現在最大的問題不是畫面不好看，而是後台自動流程可能在錯的時間做錯事：

- 訂單還沒真正完成，就先寄出購課歡迎信。
- CRM 寄信入口沒有上鎖。
- 同一封 CRM 信可能被兩個流程同時寄出。
- 追蹤連結可以長期重複使用，造成報表失真。

這些問題會影響付款、寄信、報表與登入相容性；其中大多數集中在 CRM，但不是 100% 都是 CRM 本身。

## 問題分類

| 分類 | 對應問題 | 白話說明 |
|------|----------|----------|
| 付款後自動流程 | #1、#3 | 錢還沒完全處理好，就先把人加進 CRM 並寄信 |
| CRM 寄信入口 | #2 | 有一個寄信開關沒有上鎖 |
| CRM 寄信併發 | #4、#10 | 同一封信可能重複寄，且處理數字可能看起來成功但其實失敗 |
| CRM 追蹤連結 | #5、#6、#7、#9 | 點擊/開信追蹤有安全與統計失真問題 |
| 登入相容性 | #8 | 特定主機環境下，登入資料可能受影響 |

## 處理決策

這個 SR 先修安全與資料正確性，不跟 UI/UX 改版綁在一起。

原因：

1. 付款和寄信是「不能錯」的流程。
2. UI/UX 改版通常會改很多畫面，容易讓風險混在一起。
3. 先把底層流程修穩，之後 UI/UX 改版比較不會踩到壞掉的邏輯。

UI/UX 問題應另開一份 SR，等本 SR 完成後再接，除非 UI/UX 問題本身會造成付款或寄信錯誤。

## 行為規格

### 場景 1：付款失敗時不可寄 CRM 信

**Given** 學員完成付款回調，但付款交易後段發生錯誤  
**When** 系統回復到付款失敗或訂單未完成狀態  
**Then** 不可建立 CRM enrollment  
**And** 不可建立 CRM Email delivery  
**And** 不可寄出 day-0 歡迎信

### 場景 2：付款真正成功後才進 CRM

**Given** 訂單已成功標記為已付款，且觀看權限已建立  
**When** 付款流程正式完成  
**Then** 系統才可以建立 CRM enrollment 與 Email delivery  
**And** day-0 歡迎信的寄送失敗不可讓付款流程失敗

### 場景 3：CRM cron 必須上鎖

**Given** 外部請求呼叫 `/api/cron/crm-sequences`  
**When** 沒有提供正確的 cron 密碼  
**Then** 系統回傳未授權  
**And** 不執行任何待寄信件

### 場景 4：同一封 CRM 信只能被處理一次

**Given** 同一筆待寄信件同時被 cron 與購課流程拿到  
**When** 兩邊都嘗試寄出  
**Then** 只有一邊可以取得處理權  
**And** 學員最多收到一封相同信件

### 場景 5：寄信結果數字要可信

**Given** 有 50 封待寄 CRM 信  
**When** Email 服務未設定或全部寄送失敗  
**Then** 系統不可回報「成功處理 50 封」  
**And** 回應需能分辨成功、失敗、略過數量

### 場景 6：CRM 追蹤 token 要有期限

**Given** Email 裡的開信或點擊追蹤連結  
**When** token 已超過有效期限  
**Then** 不建立新的開信或點擊記錄  
**And** 點擊追蹤不可繼續放大報表數字

### 場景 7：CRM tracking secret 必須獨立

**Given** 正式站缺少 `CRM_TRACKING_SECRET`  
**When** 系統產生或驗證 CRM 追蹤 token  
**Then** 不可自動改用登入系統的 secret  
**And** 系統需明確報錯，讓部署者補上專用 secret

### 場景 8：點擊追蹤不可變成任意跳轉入口

**Given** CRM click token 指向外部網址  
**When** 目的網址不在允許範圍內  
**Then** 系統不可跳轉到該網址  
**And** 不建立有效點擊記錄

### 場景 9：只改真正的 href

**Given** Email HTML 同時有 `data-href` 和 `href`  
**When** 系統改寫連結為追蹤連結  
**Then** 只改真正的 `href`  
**And** 不可誤改 `data-href`

### 場景 10：登入 POST body 不可被吃掉

**Given** 主機環境需要修正登入網址 host  
**When** 使用者送出登入表單  
**Then** 系統建立新的登入請求時必須保留 POST body  
**And** 補上 `duplex: 'half'` 以避免不同 Node/Next 版本相容性問題

## Acceptance Criteria

- [x] AC-01：新增測試，證明付款交易 rollback 時不會建立 CRM 資料、不會寄 day-0 Email。
- [x] AC-02：CRM enrollment 從付款交易內移出，改成交易完成後才執行。
- [x] AC-03：day-0 Email 寄送失敗不可影響已成功付款訂單。
- [x] AC-04：`/api/cron/crm-sequences` 補上 `CRON_SECRET` 驗證；未授權時不執行寄信。
- [x] AC-05：CRM delivery 處理改成先取得處理權，再寄信，避免重複寄送。
- [x] AC-06：CRM delivery 回傳成功、失敗、略過數量，不再只回傳查詢到幾筆。
- [x] AC-07：CRM click/open token 加上有效期限，過期 token 不記錄。
- [x] AC-08：正式站必須使用獨立 `CRM_TRACKING_SECRET`，不可 fallback 到登入系統 secret。
- [x] AC-09：click redirect 只允許安全網址；不允許時導回首頁。
- [x] AC-10：link rewriter 不會誤改 `data-href`。
- [x] AC-11：登入 host 修正流程保留 POST body，並補 `duplex: 'half'`。
- [x] AC-12：`pnpm jest __tests__/crm --runInBand` 通過。
- [x] AC-13：`pnpm lint` 通過。
- [x] AC-14：`pnpm build` 通過。

## 交付結果

- `grantPaidOrderAccess` 只做付款交易內的授權資料；單課程 CRM enrollment 改由 `executePostPaymentActions` 在交易完成後觸發。
- `/api/cron/crm-sequences` 現在需要 `Authorization: Bearer <CRON_SECRET>`；未授權時回 `401`，不處理待寄信件。
- CRM cron 回應格式改為：

```json
{
  "selected": 2,
  "claimed": 2,
  "sent": 1,
  "failed": 1,
  "skipped": 0,
  "unclaimed": 0
}
```

- `CrmEmailDeliveryStatus` 新增 `PROCESSING`，並已加入 migration：`20260630230000_add_crm_delivery_processing_status`。
- CRM click/open token 會寫入 `iat` 與 `exp`；正式站必須設定 `CRM_TRACKING_SECRET`，不可共用登入系統 secret。
- click redirect 預設只允許同站 host；需要外部 host 時才用 `CRM_TRACKING_ALLOWED_REDIRECT_HOSTS` 明確加入。
- `.env.local` 指向的資料庫查證結果：`CrmEmailDelivery` 總數 `0`，`SENT` `0`。沒有已寄出的舊格式 CRM tracking Email，因此不加入 legacy grace window。
- UI/UX 改版仍屬下一份 SR，本次沒有混入畫面調整。

## 驗證紀錄

- `pnpm jest __tests__/crm/payment-integration.test.ts __tests__/crm/cron-route.test.ts __tests__/crm/delivery-service.test.ts __tests__/crm/tracking-service.test.ts __tests__/crm/click-route.test.ts __tests__/crm/link-rewriter.test.ts __tests__/crm/auth-route.test.ts --runInBand`：通過。
- `pnpm jest __tests__/crm --runInBand`：12 個測試檔、33 個測試通過。
- `pnpm lint`：通過，僅有既有 warning。
- `pnpm build`：通過；migration 已成功套用，設定同步顯示不需回填。
- `curl http://localhost:3010/api/cron/crm-sequences`：無 token 回 `401 {"error":"Unauthorized"}`。
- `curl -H 'Authorization: Bearer cron_secret_123' http://localhost:3010/api/cron/crm-sequences`：回 `200` 與 outcome counts。

## Debug 順序

1. 先補會失敗的測試，重現付款 rollback、公開 cron、重複寄信。
2. 修付款後 CRM 觸發時機。
3. 修 CRM cron 授權。
4. 修 CRM delivery 處理權與結果統計。
5. 修 tracking token、secret、redirect、link rewrite。
6. 最後補登入 `duplex: 'half'` 相容性修正。
7. 跑 CRM 測試、lint、build。

## 排除範圍（Out of Scope）

- 不做 CRM 後台畫面 redesign。
- 不改 Email 模板視覺。
- 不改課程銷售頁 UI。
- 不改結帳頁 UI，除非測試證明目前 UI 會造成付款或寄信錯誤。
- 不處理新的行銷自動化功能，只修既有流程的安全與正確性。
