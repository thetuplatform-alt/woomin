## Why

目前程式碼僅存在本機，且先前 Zeabur CLI 的預設登入屬於錯誤帳號。需要建立一套可稽核、可重跑且不會混用帳號資源的正式部署流程，將課程平台安全發佈到使用者指定的 `thetuplatform-alt` Zeabur 帳號。

## What Changes

- 使用 `.env` 中既有的 Zeabur API key 把 CLI 明確切換到 `thetuplatform-alt`，部署完成後再由瀏覽器授權恢復 `fish` CLI 登入。
- 重用已在目標帳號租妥的騰訊雲東京 2C／8 GB／80 GB 主機 `6a69de894ac7e3522bbc12f0`，不得重複租用；恢復部署時先完成 Zeabur managed runtime readiness。
- 建立獨立 Zeabur 專案、PostgreSQL 服務與正式 App Service。
- 以專案現有 Dockerfile 建置映像，並以帶有 `/data` 永久硬碟的正式服務承載網站。
- 注入正式環境必要設定與自動產生的獨立密鑰，綁定可用的 HTTPS 網址。
- 以固定候選順序取得免費子網域；build-time URL 不一致時強制重新建置，不以 runtime-only 修正通過驗收。
- 驗證資料庫 migration、容器內 `/data` 可寫、內部 8080 連線、外部 HTTPS 健康狀態與正式版本資訊。
- 以明確的 timeout、成功狀態、核心 cron route 回應與失敗報告格式消除部署判斷歧義。
- 將非敏感部署狀態記錄在本機可續跑的狀態檔，且確保該檔案不會提交到 Git。

## Capabilities

### New Capabilities

- `zeabur-production-deployment`: 規範帳號隔離、主機租用、資料庫、映像建置、永久儲存、正式網址、機密設定及端到端驗收。

### Modified Capabilities

（無）

## Impact

- Affected specs: `zeabur-production-deployment`
- Affected code:
  - New: `.realms-deploy.json`
  - Modified: none
  - Removed: none
- Existing local guardrail: `.gitignore` already ignores `.realms-deploy.json`
- Affected existing deployment inputs: `Dockerfile`, `.dockerignore`, `.zeaburignore`, `package.json`, `prisma/schema.prisma`, `prisma/migrations/`
- Affected external systems: `thetuplatform-alt` Zeabur 帳號、騰訊雲東京專用主機、Zeabur Project、PostgreSQL、App Service、持久硬碟與 HTTPS 網址
- Cost impact: 新增騰訊雲東京 2C／8 GB／80 GB 主機，目錄查詢價格為每月 US$6
- Current checkpoint: 主機已存在且 VM 為 `RUNNING`，但 `HasK3s=false`、最後事件為 `Validating server hardware`；尚未建立 Zeabur Project、PostgreSQL、App Service、volume 或 domain
