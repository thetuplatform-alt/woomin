# Vimeo 影片來源 — BDD 規格

## 概述

平台目前支援 YouTube 連結與 Cloudflare Stream 影片作為課程單元影片來源。此功能新增 Vimeo 作為第三種單元影片來源，讓管理員可直接貼上 Vimeo 影片網址，學員在已授權的課程播放頁可正常觀看，並保留平台既有的觀看進度、完成判定、浮水印與基本播放器操作體驗。

## 行為規格

### 場景 1：管理員貼上一般 Vimeo 網址
**Given** 管理員正在編輯某個課程單元，且影片來源選擇 Vimeo  
**When** 管理員貼上有效的 Vimeo 影片網址並套用  
**Then** 系統接受該網址，顯示 Vimeo 影片預覽，並可儲存到該單元

### 場景 2：管理員貼上 Unlisted Vimeo 網址
**Given** 管理員正在編輯某個課程單元，且 Vimeo 影片網址包含 `h` privacy hash  
**When** 管理員套用並儲存該網址  
**Then** 系統保留可播放所需的 privacy hash，不會只留下數字影片 ID

### 場景 3：管理員貼上無效 Vimeo 輸入
**Given** 管理員正在編輯某個課程單元，且影片來源選擇 Vimeo  
**When** 管理員貼上非 Vimeo 網址、空值或無法辨識的 Vimeo URL  
**Then** 系統不會套用影片，並顯示清楚的錯誤訊息

### 場景 4：學員播放 Vimeo 單元影片
**Given** 學員已登入且具備該課程單元的觀看權限  
**When** 學員進入使用 Vimeo 影片來源的單元播放頁  
**Then** 學員可看到 Vimeo 影片播放器，並能播放、暫停、快轉、調整音量、切換全螢幕與切換可用倍速

### 場景 5：Vimeo 影片更新學習進度
**Given** 學員正在觀看 Vimeo 影片單元  
**When** 影片播放時間推進或播放結束  
**Then** 系統會更新單元觀看進度、觀看時間與完成狀態，行為與既有 YouTube / Cloudflare Stream 來源一致

### 場景 6：未授權訪問仍不洩漏影片來源
**Given** 訪客或未購買學員嘗試訪問非免費 Vimeo 單元  
**When** 系統檢查課程單元存取權限  
**Then** 系統不會回傳 Vimeo 影片來源資料，並依現有流程要求登入或導回課程銷售頁

### 場景 7：既有 YouTube 與 Cloudflare Stream 行為不受影響
**Given** 既有課程單元使用 YouTube 或 Cloudflare Stream  
**When** 管理員編輯或學員播放這些既有單元  
**Then** 原本的影片解析、預覽、播放、進度追蹤與 Cloudflare Stream 受保護播放仍維持原行為

### 場景 8：Vimeo 不進入 Cloudflare 媒體中心
**Given** 管理員使用 Vimeo 作為單元影片來源  
**When** 管理員儲存該單元或查看媒體中心  
**Then** Vimeo 影片只綁定在該單元，不會建立 Cloudflare Stream 媒體庫項目，也不提供平台上傳到 Vimeo 的流程

## Acceptance Criteria

- [ ] AC-01：後台單元影片設定提供 Vimeo 作為第三個可選來源，且可輸入 Vimeo URL。
- [ ] AC-02：系統可解析 `https://vimeo.com/{id}` 與 `https://player.vimeo.com/video/{id}` 類型網址。
- [ ] AC-03：系統可解析並保留含 `h` privacy hash 的 Vimeo 網址，以支援 Unlisted 影片嵌入。
- [ ] AC-04：無效 Vimeo 輸入會顯示錯誤，不會覆寫既有有效影片資料。
- [ ] AC-05：Vimeo 影片設定儲存後，重新載入後台編輯頁仍能顯示 Vimeo 來源、來源 ID/網址與預覽。
- [ ] AC-06：前台播放頁可播放 Vimeo 影片，並支援播放、暫停、進度拖曳、音量、全螢幕與可用倍速切換。
- [ ] AC-07：Vimeo 影片播放時會呼叫既有觀看進度與觀看時間回報流程，播放結束會觸發完成判定。
- [ ] AC-08：Vimeo 播放器支援既有課程影片浮水印 overlay，且偵測到浮水印被破壞時會暫停或停用播放。
- [ ] AC-09：未授權使用者無法從課程單元資料取得 Vimeo 來源 ID 或可播放 URL。
- [ ] AC-10：既有 YouTube 解析、後台預覽、前台播放與縮圖行為維持不變。
- [ ] AC-11：既有 Cloudflare Stream 媒體庫選取、上傳、簽名播放與處理中輪詢行為維持不變。
- [ ] AC-12：Vimeo 不會出現在 Cloudflare Stream 媒體中心，也不新增 Vimeo 上傳或同步媒體庫功能。
- [ ] AC-13：資料庫 schema、Prisma Client、TypeScript 型別與驗證規則都接受 Vimeo provider。
- [ ] AC-14：影片來源正規化測試涵蓋 YouTube、Cloudflare Stream、Vimeo 一般網址、Vimeo player 網址、Vimeo privacy hash 與無效輸入。
- [ ] AC-15：專案可通過至少一次 `pnpm prisma generate`、影片來源驗證腳本與 TypeScript/建置層級檢查。

## 排除範圍（Out of Scope）

- 不支援從本平台上傳影片到 Vimeo。
- 不支援同步 Vimeo 帳號影片庫到平台媒體中心。
- 不串接 Vimeo OAuth 或 Vimeo API Token 設定。
- 不保證 Vimeo Private / Password-protected / domain-restricted 影片一定可播放；這些受 Vimeo 帳號權限與影片隱私設定限制。
- 不改變全站初始設定流程中的預設影片託管方案；本次新增的是單元層級 Vimeo 來源。
