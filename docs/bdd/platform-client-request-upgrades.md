# Platform Client Request Upgrades — BDD 規格

## 概述
本次升級解決客戶回報的播放器、PDF、Cloudflare Stream、SHOPLINE ATM 與銷售頁問題，並補齊連結販售、邀請制與組合包銷售能力。平台擁有者需要能在後台安全管理課程可見性、媒體、付款方式與銷售頁，同時已上線客戶能透過 migration 無縫升級。

## 行為規格

### 場景 1：SHOPLINE ATM 可用且待付款資訊清楚
**Given** 管理員啟用 SHOPLINE Payments 並允許 ATM 付款方式  
**When** 學員在 checkout 建立訂單並選擇 ATM  
**Then** SHOPLINE checkout 會顯示 ATM 選項，導回後成功頁顯示待付款狀態與可用的付款資訊，訂單維持待付款直到 webhook 確認付款成功。

### 場景 2：PDF 講義必須經授權檢查
**Given** 一份 PDF 講義屬於某課程單元  
**When** 未登入或未購買的使用者嘗試開啟 PDF  
**Then** 系統拒絕存取或導向登入/購買流程，不暴露可長期直連的 storage URL。

### 場景 3：PDF 動態浮水印
**Given** 已購買學員開啟受保護 PDF  
**When** 系統產生 PDF 預覽或下載內容  
**Then** PDF 內含站名、課程/講義資訊、學員識別資訊與時間戳等浮水印。

### 場景 4：PDF 閱讀器 UX 可控
**Given** 學員在課程單元內閱讀 PDF  
**When** 學員開啟全螢幕閱讀器  
**Then** 關閉、返回、另開或下載控制不會被 header 或播放器遮住，並依後台設定顯示或隱藏下載入口。

### 場景 5：播放器下滑不造成卡頓或狀態錯亂
**Given** 學員正在播放影片並向下閱讀文字內容  
**When** 影片離開 viewport 或回到影片區  
**Then** 播放器不重建、不閃爍、不重置播放狀態，迷你播放器可由後台或課程體驗設定控制。

### 場景 6：Cloudflare Stream 上傳狀態可理解
**Given** 管理員上傳影片到 Cloudflare Stream  
**When** 上傳、轉檔、同步或建立本地 Media 記錄失敗  
**Then** 後台顯示明確狀態與錯誤原因，並提供重試或重新同步。

### 場景 7：Cloudflare Stream 同步與刪除一致
**Given** Cloudflare 遠端影片與本地 Media 記錄可能不同步  
**When** 管理員執行同步或刪除  
**Then** 系統能匯入遠端影片、更新本地狀態，並只在管理員明確操作時刪除遠端影片。

### 場景 8：課程可見性清楚
**Given** 管理員編輯課程  
**When** 管理員設定課程狀態  
**Then** 可選草稿、公開販售、連結販售、私密邀請；課程列表和詳情頁清楚顯示目前可見性與分享連結。

### 場景 9：邀請制購買
**Given** 課程設定為私密邀請  
**When** 使用者沒有有效邀請 token 或不符合邀請條件  
**Then** 無法進入購買流程；有效邀請可依期限、使用次數或 email 限制購買。

### 場景 10：組合包銷售
**Given** 管理員建立包含多門課程的組合包  
**When** 學員購買組合包且付款成功  
**Then** 系統為組合包內所有課程建立觀看權限，訂單與後台能辨識該次購買來自組合包。

### 場景 11：default 銷售頁有可用設計
**Given** 課程沒有客製 React 銷售頁  
**When** 訪客開啟課程頁  
**Then** 預設銷售頁使用課程資料產生專業版面，包含首屏、價格 CTA、亮點、課綱、講師/評價 fallback、FAQ/保障與 sticky CTA。

### 場景 12：升級既有客戶不中斷
**Given** 既有客戶已在線上使用舊 schema  
**When** 執行 Prisma migration  
**Then** 新欄位有安全預設值，既有訂單、課程、購買紀錄與媒體資料不需要人工修復即可繼續運作。

## Acceptance Criteria
- [ ] AC-01：Prisma schema 與 migration 檔案涵蓋新增資料模型/欄位，且對既有資料有安全預設值。
- [ ] AC-02：SHOPLINE 建立 session 時可依後台設定包含 ATM/VirtualAccount payment method。
- [ ] AC-03：SHOPLINE webhook 能保存 ATM 付款資訊，付款前訂單保持 PENDING，付款成功後建立課程權限。
- [ ] AC-04：checkout success/order status UI 能呈現待付款狀態與 ATM 付款資訊。
- [ ] AC-05：PDF 不再只靠公開 storage URL 提供課程內閱讀，需經登入與購買/試閱授權檢查。
- [ ] AC-06：PDF 輸出可動態套用學員識別資訊浮水印。
- [ ] AC-07：PDF 閱讀器不被 header 遮擋，且下載入口可由設定控制。
- [ ] AC-08：播放器下滑/回到影片區不重建播放器，不造成播放進度或狀態錯亂。
- [ ] AC-09：Cloudflare 影片列表能同步遠端狀態，顯示處理中、可播放、失敗與錯誤訊息。
- [ ] AC-10：Cloudflare 遠端刪除需明確操作，且不可批次誤刪非本次建立的影片。
- [ ] AC-11：課程後台可明確設定公開販售、連結販售、私密邀請與草稿。
- [ ] AC-12：私密邀請課程沒有有效邀請時不可 checkout。
- [ ] AC-13：後台可建立、停用、複製邀請連結，並能設定期限、使用次數與 email 限制。
- [ ] AC-14：後台可建立組合包、選擇多門課程、設定價格與啟用狀態。
- [ ] AC-15：購買組合包成功會授權組合包內所有課程。
- [ ] AC-16：前台課程列表不顯示連結販售與私密邀請課程。
- [ ] AC-17：default 銷售頁在沒有客製頁時仍具備完整專業版面與 responsive CTA。
- [ ] AC-18：所有新增後台異動有權限檢查，重要異動寫入 AdminLog。
- [ ] AC-19：公開或半公開 API 有合理 rate limiting 或授權保護。
- [ ] AC-20：`pnpm lint`、`pnpm build`、Prisma migration/generate 檢查通過。
- [ ] AC-21：QA 使用 Chrome 實際操作 localhost 驗證主要流程：後台設定、課程/邀請/組合包、checkout、PDF、播放器、媒體頁。

## 排除範圍（Out of Scope）
- 不搬移既有客戶已上傳的檔案內容。
- 不刪除 Cloudflare 帳號中既有生產影片，除非該影片是測試流程中新建立且可識別。
- 不改變現有 Stripe / PAYUNi 的既有成功付款流程，除非為了共同 checkout UI 相容。
