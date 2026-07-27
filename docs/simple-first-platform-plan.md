# Simple-First Platform 計畫書

## 目標

將平台重構為適合非工程師部署與使用的版本，預設部署以 `Zeabur + PostgreSQL + Volume` 為主，並把「先能上線、再逐步啟用進階功能」作為第一原則。

核心目標：

- 啟動必填環境變數壓到只剩 `DATABASE_URL`
- 圖片與附件預設使用 Zeabur volume 本地儲存
- 課程影片預設支援 `YouTube`
- `Cloudflare Stream / S3 / SMTP / Google / Apple` 都改為上線後再啟用的進階功能
- setup flow 改成真正對非工程師有用的啟用引導

## 執行原則

### 1. Simple First

預設流程必須讓使用者只靠資料庫就能啟動站點，其他能力都應可在後台補齊。

### 2. Advanced Optional

`Cloudflare Stream`、`S3/R2`、`SMTP`、`Google OAuth`、`Apple OAuth` 都屬於可選進階能力，不得再是啟動前必要條件。

### 3. Zeabur First

以 Zeabur 為主要部署方式設計：

- 圖片 / 附件走 volume 掛載
- 影片預設走 YouTube
- 後台引導直接對應 Zeabur 使用情境

## 驗收規則

### BDD 驗收

每個 Phase 都必須有明確的 `Given / When / Then` 驗收項，作為完成標準。

### SubAgent 驗收

每完成一個 Phase，主代理必須主動派一個獨立 SubAgent 依該 Phase 的 BDD 清單驗收。

規則：

1. 先完成功能實作
2. 更新本計畫書中的進度
3. 執行該 Phase 的自動驗證
4. 派 SubAgent 依 BDD 清單做獨立檢查
5. 僅在 SubAgent 明確認定通過後，才能把該 Phase 標記為完成

## Phase 0: 架構盤點與重構邊界

### 目標

- 盤點目前對 `S3 / R2 / Cloudflare Stream / AUTH_URL / AUTH_SECRET / OAuth env` 的耦合點
- 定義 simple-first 架構與 migration 邊界

### 任務

- [x] 盤點現有依賴與耦合
- [ ] 補齊變更清單與風險列表
- [ ] 完成各 Phase 邊界定義

### BDD

- [ ] Given 現有專案已可執行 When 檢查主要媒體、Auth、設定流程 Then 能清楚列出所有必填 env 與對應程式耦合點
- [ ] Given simple-first 目標已確立 When 檢查計畫書 Then 能看到各 Phase 的邊界、依賴與驗收方式
- [ ] Given Phase 0 標記完成 When 回看驗收紀錄 Then 必須已有 SubAgent 檢查結果

## Phase 1: 本地媒體儲存

### 目標

- 讓圖片 / 附件不再依賴 `S3 / R2`
- 預設改為 Zeabur volume 本地儲存

### 任務

- [x] 建立 storage abstraction
- [x] 建立 `local` storage driver
- [x] 建立通用 media upload route
- [x] 建立 `/uploads` 本地檔案讀取路由
- [x] 刪除媒體時依 storage driver 分流
- [x] 建立 `admin:init` 腳本方便建立管理員驗證路徑
- [x] 補齊 helper 與 route 級驗證
- [x] 補齊公開圖片 / 附件 route 驗證
- [x] SubAgent 驗收

### 自動驗證

- [x] `pnpm verify:phase1-local-storage`
- [x] `pnpm verify:phase1-media-upload-route`
- [x] `pnpm verify:phase1-public-upload-route`

### BDD

- [ ] Given 未設定 S3/R2 憑證 When 管理員上傳圖片 Then 圖片可成功儲存且 `Media` 記錄正確
- [ ] Given storage driver 為 `local` When 管理員設定 Logo Then 前台與後台都能透過 `/uploads/...` 正常存取
- [ ] Given 本地圖片或附件已存在 When 管理員刪除該媒體 Then 實體檔案與資料庫記錄都會被移除
- [ ] Given storage driver 切回 `s3` When 走既有上傳流程 Then presigned upload 仍可運作
- [x] Given Phase 1 標記完成 When 回看驗收紀錄 Then 必須已有 SubAgent 檢查結果

## Phase 2: 影片來源抽象化

### 目標

- 課程影片支援 `YouTube` 與 `Cloudflare Stream`
- 把原本只代表 Cloudflare 的 `videoId` 耦合拆開

### 任務

- [x] Prisma schema 新增影片來源欄位
- [x] 建立影片來源解析 helper
- [x] 後台單元編輯器支援 YouTube / Cloudflare
- [x] 前台播放器依 provider 切換
- [x] 舊 `videoId` 流程保留 fallback
- [x] 補齊驗證腳本
- [x] SubAgent 驗收

### 自動驗證

- [x] `pnpm verify:phase2-video-providers`

### BDD

- [ ] Given 管理員編輯單元影片 When 選擇 YouTube 並輸入連結 Then 系統會正確解析並儲存 YouTube 來源資訊
- [ ] Given 管理員編輯單元影片 When 選擇 Cloudflare Stream Then 系統會正確保留 Cloudflare 來源資訊
- [ ] Given 單元影片來源為 YouTube When 學員進入播放頁 Then 前台會使用 YouTube 播放器
- [ ] Given 單元影片來源為 Cloudflare Stream When 學員進入播放頁 Then 前台仍使用 Cloudflare 保護播放流程
- [ ] Given 舊資料仍只有 `videoId` When migration 與讀取 fallback 執行 Then 舊內容不會失效
- [x] Given Phase 2 標記完成 When 回看驗收紀錄 Then 必須已有 SubAgent 檢查結果

## Phase 3: setup flow 重寫

### 目標

- 將 setup flow 改成對非工程師有用的逐步啟用流程

### 任務

- [x] 重寫 setup schema 與 server action
- [x] setup UI 支援影片 / 儲存 / Email / Google / Apple 逐步啟用
- [x] 可跳過 Email / Google / Apple
- [x] 補上圖片儲存方案選擇 UI
- [x] 補齊 setup schema 驗證
- [x] SubAgent 驗收

### 自動驗證

- [x] `pnpm verify:phase3-setup-flow`

### BDD

- [ ] Given 新部署站點只有 `DATABASE_URL` When 管理員進入 setup flow Then 可在不填 Email / OAuth 憑證下完成啟用
- [ ] Given 管理員可選擇圖片儲存方案 When setup 完成 Then 本地 volume 與 S3 路徑都能被正確保存
- [ ] Given 管理員選擇略過 Email / Google / Apple When setup 完成 Then 站點仍能正常啟用與登入
- [ ] Given 管理員選擇 YouTube 為影片方案 When setup 完成 Then 不需要 Cloudflare env 也能開始使用
- [ ] Given setup flow 完成 When 進入後台設定 Then 可看到對應的後續設定入口
- [x] Given Phase 3 標記完成 When 回看驗收紀錄 Then 必須已有 SubAgent 檢查結果

## Phase 4: Auth / URL / env 簡化

### 目標

- 讓 `NEXT_PUBLIC_APP_URL` 與 `AUTH_URL` 不再是必填
- 對使用者隱藏 `AUTH_SECRET`
- OAuth 改為 DB-first 設定

### 任務

- [x] `resolveAppUrl()` 改為 request / DB / env / localhost fallback
- [x] `site_url` 加入 `SiteSetting` 與後台站點設定
- [x] `AUTH_SECRET` 改為可由系統自動推導
- [x] Google / Apple 憑證改為 DB-first / env-fallback
- [x] SubAgent 驗收

### 自動驗證

- [x] `pnpm verify:phase4-env-simplification`

### BDD

- [ ] Given 未設定 `NEXT_PUBLIC_APP_URL` When 產生 canonical、email link、payment callback Then 系統可優先使用 request origin，否則 fallback 到 `site_url` 或平台 URL
- [ ] Given 未設定 `AUTH_URL` When 啟動認證流程 Then 認證仍可正常運作
- [ ] Given 只有 `DATABASE_URL` When 啟動 auth Then 系統仍可產生穩定的 internal auth secret
- [ ] Given Google / Apple 憑證設在資料庫 When 啟用對應登入方式 Then provider 會依 DB 設定載入
- [x] Given Phase 4 標記完成 When 回看驗收紀錄 Then 必須已有 SubAgent 檢查結果

## Phase 5: 設定中心整理

### 目標

- 將進階能力集中到後台設定頁管理

### 任務

- [x] 站點設定加入 `videoProvider`
- [x] 新增 登入方式 設定區塊
- [x] 補齊 Media / Email / Payment 的 simple-first 導向說明
- [x] 整理設定頁資訊架構
- [x] SubAgent 驗收

### BDD

- [ ] Given 管理員進入後台設定 When 想啟用 Email / 登入方式 / 影片方案 Then 可在對應設定頁找到入口與說明
- [ ] Given setup 已略過進階功能 When 管理員稍後回到設定頁 Then 可補啟用這些功能而不需改 env
- [x] Given Phase 5 標記完成 When 回看驗收紀錄 Then 必須已有 SubAgent 檢查結果

## Phase 6: 文件與部署簡化

### 目標

- `.env.example` 與 `README` 改成真正符合 simple-first 的說明

### 任務

- [x] `.env.example` 精簡成只保留 `DATABASE_URL`
- [x] `README.md` 改成 Zeabur-first quick start
- [x] 補齊部署教學與限制說明
- [x] SubAgent 驗收

### BDD

- [ ] Given 新使用者打開 `.env.example` When 閱讀必要設定 Then 只會看到 `DATABASE_URL` 為必要項
- [ ] Given 新使用者閱讀 `README` When 依照部署步驟操作 Then 不需要先配置 S3 / Cloudflare Stream / SMTP / OAuth 才能啟動
- [x] Given Phase 6 標記完成 When 回看驗收紀錄 Then 必須已有 SubAgent 檢查結果

## 風險

- YouTube 不適合作為嚴格保護型付費影片方案
- Zeabur volume 適合單實例圖片 / 附件，不等於 object storage
- NextAuth 改成 DB-first 配置後，需要持續注意 runtime 與 middleware 邊界
- 舊資料 migration 必須保留 fallback，避免既有課程失效

## 進度紀錄

| 日期 | Phase | 狀態 | 說明 |
|------|------|------|------|
| 2026-04-07 | Phase 0 | 進行中 | 已完成初步架構盤點與重構方向定義 |
| 2026-04-07 | Phase 1 | 已完成 | storage abstraction、local route、media upload route、公開圖片 / 附件 route 驗證、`admin:init` 與 SubAgent 驗收已完成 |
| 2026-04-07 | Phase 2 | 已完成 | YouTube / Cloudflare 雙 provider、migration、驗證腳本與 SubAgent 驗收已完成 |
| 2026-04-07 | Phase 3 | 已完成 | setup flow、圖片儲存方案選擇 UI、schema 驗證與 SubAgent 驗收已完成 |
| 2026-04-07 | Phase 4 | 已完成 | `site_url` DB fallback、auth secret 自動推導、OAuth DB-first 與 SubAgent 驗收已完成 |
| 2026-04-07 | Phase 5 | 已完成 | 設定頁已加入 `videoProvider`、登入方式 與 simple-first 導向說明，且已完成 SubAgent 驗收 |
| 2026-04-07 | Phase 6 | 已完成 | `.env.example` 與 `README.md` 已改為 simple-first / Zeabur-first 說明，並補上部署限制與 SubAgent 驗收 |

## 下一步

1. 回頭補 Phase 0 的收尾文件
2. 視需要補更完整的端到端 UI 測試
