## Context

目前 repository 已可由本機推送到 GitHub，但 Zeabur 部署仍依賴開發者 CLI session、手動建立服務與一次性的本機 deployment checkpoint。客戶交付後需要擁有自己的 GitHub repository、GitHub Actions、Zeabur workspace、PostgreSQL、persistent volume 與 secrets；平台原始碼不應持有客戶的遠端資源識別或機密。

## Goals / Non-Goals

**Goals:**

- 讓客戶能依一份 onboarding 文件，在自己的帳號中完成一次性初始化。
- 讓 push 到客戶指定的 production branch 後，由 GitHub Actions 只部署該客戶的 Zeabur project/app service。
- 讓每次部署可追蹤 commit SHA，並在失敗時提供安全且可重跑的錯誤資訊。
- 保留現有 Docker、Prisma migration、`/data` volume 與 cron worker 契約。
- 讓運維 skill 接受任意可存取的 GitHub URL，並依 repository 合約執行首次安裝、日常更新、版本升級或故障診斷。

**Non-Goals:**

- 不替客戶代管 GitHub repository、Zeabur workspace、資料庫密碼或應用 secrets。
- 不讓 GitHub Actions 建立或刪除客戶的付費主機、資料庫或 volume；初始化由客戶依文件執行並明確確認資源。
- 不把 production database、上傳檔案或 secrets 放入 GitHub artifacts。
- 不處理自有網域、付款、Email provider、OAuth 或多實例高可用性。
- 不在沒有使用者確認時自動合併有衝突的客製化升級。

## Decisions

### GitHub Actions 作為部署入口

部署 workflow 放在 `.github/workflows/deploy-zeabur.yml`，觸發條件為 push 到 `main`（可由 repository variable `DEPLOY_BRANCH` 改成其他分支）以及手動 `workflow_dispatch`。Workflow 使用客戶自行建立的 `ZEABUR_TOKEN`、`ZEABUR_PROJECT_ID`、`ZEABUR_SERVICE_ID` 與 `ZEABUR_DOMAIN`；token 只存在 Actions secret，project/service ID 存在 repository variable。每次部署將 `GIT_COMMIT_SHA` 傳給 Docker build 與 runtime，避免 Zeabur build context 依賴 `.git`。

選擇 GitHub Actions 而非把 Zeabur token 放入 application repository 或要求客戶共享開發者 CLI，因為權限、審計與交接邊界清楚，且每個客戶可以只複製自己的 workflow secrets。

### 初始化與持續部署分離

`deploy/customer/bootstrap.sh` 負責 preflight、產生非敏感設定範本、檢查 Zeabur CLI 登入帳號與輸出人工操作清單；它不租主機、不寫入 secrets、不替客戶刪除失敗資源。客戶完成 Zeabur UI／CLI 的 project、PostgreSQL、app、`/data` volume 與 variables 後，才把 IDs 與 secrets 填入 GitHub。

持續部署 workflow 只更新既有 app service image／source deployment，不擁有基礎設施生命週期，避免一次 push 造成資料庫或 volume 被重建。

### 客戶交付模式與 repository ownership

本方案採「客戶先初始化、之後自動更新」的交付模式。客戶必須使用自己的 Zeabur workspace 建立 project、PostgreSQL、app、`/data` volume 與 variables；GitHub Actions 只更新既有 app，不租用或刪除付費主機、資料庫或 volume。每個客戶使用獨立 GitHub repository，避免客製化、secrets、Actions logs 與 deployment target 互相混用。

替代方案是由 vendor 帳號集中代管，或所有客戶共用一個 repository；前者造成帳號與資料所有權不清，後者造成客製化與秘密隔離風險，因此不採用。

### Secrets 與設定分層

Zeabur Variables 保存 runtime 的 `DATABASE_URL`、`AUTH_SECRET`、`NEWSLETTER_UNSUBSCRIBE_SECRET`、`CRON_SECRET`、`APP_URL`、`NEXT_PUBLIC_APP_URL` 與 `LOCAL_STORAGE_ROOT`。GitHub Actions 只保存部署 API token 與非敏感 target IDs；workflow log 對 token、connection string 與 secret 名稱以外的值不做輸出。`APP_URL` 與 `NEXT_PUBLIC_APP_URL` 同時作為 build-time 與 runtime 變數，正式網域改變時必須重新部署。

### 健康檢查與回滾

Workflow 在部署後等待 deployment terminal state，再呼叫 `https://<domain>/api/version`，確認 HTTP 200、回傳 SHA 等於觸發 commit；同時確認首頁 HTTP 200。migration、container readiness 與 runtime logs 由 Zeabur deployment status/logs 提供；workflow 對 timeout 或非 2xx 失敗，保留 deployment ID 並提供重跑指令。回滾採 Git revert／重新執行舊 commit 的 image deployment，不直接刪除資料庫或 volume。

### 客戶交付包

README 與 `docs/customer-deployment.md` 提供交付前 checklist、一次性初始化、GitHub secrets／variables 表格、Zeabur variables 表格、首次驗證、日常 release、失敗處理、rotation 與轉移帳號規則。文件使用 placeholder，不包含目前專案的 project ID、domain、API token 或任何客戶資料。

### Repository intake 與運維 skill

`skills/woomin-platform-ops/SKILL.md` 定義可交接的操作入口。skill 接受 `repository_url`、`operation`（`install`、`update`、`upgrade`、`troubleshoot`）與可選 `target`。它先 clone 或檢查本機 checkout，辨識 `origin`、`upstream`、目前 branch、最新 commit、Dockerfile、`.env.example`、Prisma schema／migrations、部署 workflow 與 `/api/version`；再讀取非敏感的 `.woomin/deployment.yaml`。敏感值只從目前使用者授權的 shell／GitHub／Zeabur secret store 取得。

`install` 對沒有 GitHub 的舊資料夾先建立 Git、保留工作樹、產生初始 commit 與 remote 設定，再進入 Zeabur bootstrap。`update` 只部署已存在的 target commit。`upgrade` 先把 vendor repository 設為 `upstream`，建立 upgrade branch，輸出版本差異、migration 風險與衝突清單；只有無衝突且驗證成功，或使用者明確確認後才合併、commit、push 與部署。`troubleshoot` 只讀取 git status、deployment status、runtime logs、HTTP endpoints 與變數名稱，禁止輸出 secret 值。

### Platform upgrade orchestration

升級以 Git 為主體：customer `origin` 保存客製化，vendor `upstream` 保存平台版本。每次升級產生可追蹤 branch／commit，先執行 lint、test、Docker build dry-run、migration dry-run 與 health fixture；部署後必須確認 `/api/version` 為新 commit。失敗時保留 upgrade branch、deployment ID 與原 production commit，回滾採重新部署原 commit，不直接回復資料庫或刪除 volume。

### 集中式作業包與 agent 入口

`docs/deployment/` 是 customer handoff 與運維 agent 的完整入口；根目錄 `AGENTS.md` 只保留連結與不可違反的摘要。作業包必須分開說明 install、update、add-service、verification、rollback、troubleshooting 與 user-action stop points，避免客戶或 agent 依賴本次對話上下文。

### 以可觀測 health gates 取代服務顯示 Running

部署成功必須是分層 health gates 的結果，不得只依賴 Zeabur dashboard 的 Running。檢查集合包含 ZeaburOS/k3s readiness、database Running、runtime migration、container 8080、external HTTPS、`/api/version` SHA、`/data` mount、restart marker checksum 與五個核心 cron routes。optional provider-not-configured 必須獨立標記，不能掩蓋核心失敗。

### 以 schema 驅動狀態檔支援續跑

`deploy/zeabur/state.schema.json` 與被 gitignore 的 state file 保存非秘密 account、server、project、service IDs、domain、checks、failedStep、retained resources 與 resumeAction。任何 secret value、connection string 或 token 都不得進入狀態檔或 log。

### Runtime dependency closure 與正式服務 promotion

Docker build 成功不是 runtime 成功的替代品。promotion 前要驗證 Dockerfile CMD、standalone runner、Prisma assets、migration scripts 與所有 runtime imports 的 closure。暫時 build carrier 只產生 verified OCI image；正式服務建立時同時包含 image、8080 與 `/data` volume，並在 health gates 通過後才清理 carrier。

## Implementation Contract

- Push `main` 時 workflow SHALL 建立 Docker deployment，傳入觸發 commit 的 `GIT_COMMIT_SHA`，且 SHALL 只使用 secrets／variables 指定的 customer project 與 app service。
- Workflow SHALL 在 token 缺失、target ID 缺失、deployment failure、timeout、首頁非 2xx 或 `/api/version` SHA 不一致時以非零 exit code 結束；錯誤輸出 SHALL 包含 stage 與 deployment ID（若已取得），但 SHALL NOT 包含 secret 值。
- 成功 workflow SHALL 輸出 domain、commit SHA、deployment ID 與 version check 結果；`/api/version` SHALL 回傳非空且等於該 commit 的 SHA。
- `bootstrap.sh` SHALL 以 exit code 0 完成本機工具與設定檢查，或以可讀錯誤列出缺少的工具／欄位；它 SHALL NOT 自動建立付費資源。
- The platform operations skill SHALL accept a GitHub URL and an operation from `install`, `update`, `upgrade`, and `troubleshoot`, and SHALL print the selected repository, branch, commit, target, stage, and next action.
- An `install` operation on a directory without Git SHALL preserve the worktree, initialize Git, create or attach the requested GitHub remote, and stop for explicit confirmation before publishing existing local code when the remote is non-empty.
- An `upgrade` operation SHALL preserve the customer `origin`, use a separate vendor `upstream`, produce a conflict and migration report, and SHALL NOT merge or deploy unresolved conflicts.
- An `update` operation SHALL deploy only a committed revision and SHALL refuse to deploy a dirty worktree unless the user explicitly requests a local snapshot operation.
- A `troubleshoot` operation SHALL collect safe diagnostics and SHALL never print secret values; it SHALL identify whether the failure is local Git, build, deployment, runtime, database migration, HTTP health, or persistent storage.
- 客戶文件 SHALL 明確列出 `ZEABUR_TOKEN` secret、`ZEABUR_PROJECT_ID`／`ZEABUR_SERVICE_ID` variables、Zeabur runtime variables、volume `/data` 與 cron worker 的安裝位置。
- Deployment package SHALL provide a single agent entrypoint for install、update、add-service、verify、rollback and troubleshooting, and SHALL stop for browser authorization、billing、third-party credentials or account choice.
- Preflight SHALL verify CLI version、active account、ZeaburOS/k3s、project region、database readiness and existing resource state before mutation; failure SHALL be non-zero and SHALL NOT create or delete resources.
- Production service specification SHALL include verified OCI image、TCP 8080、`DATABASE_URL` reference、`APP_URL`/`NEXT_PUBLIC_APP_URL`、`GIT_COMMIT_SHA`、`LOCAL_STORAGE_ROOT=/data/uploads` and a persistent volume mounted at `/data` before first production start.
- Verification SHALL include migration、in-container HTTP、external HTTPS、pod readiness、version SHA、volume restart persistence and five core cron routes; optional provider-not-configured SHALL be non-blocking only when core checks pass.
- State schema SHALL reject secret-shaped fields and the package SHALL report failedStep、reason、resource IDs、retained resources and resumeAction without exposing secret values.
- In scope: GitHub Actions deployment workflow、customer bootstrap／verification scripts、Docker commit propagation、customer-facing documentation、secret/log guardrails。
- In scope: reusable repository operations skill、GitHub URL intake、legacy no-Git migration、upstream／origin upgrade workflow、safe diagnostics。
- Out of scope: application feature changes、database schema changes、automatic infrastructure provisioning、custom domains、billing、provider onboarding。

## Risks / Trade-offs

- [Risk] Zeabur CLI 或 API 介面改變 → [Mitigation] pin CLI version in workflow，並在 workflow 開始執行 version check；runbook 保留手動 fallback。
- [Risk] 客戶誤把 runtime secret 放進 GitHub variable 或 commit → [Mitigation] workflow 不接受 secret 的明文參數，文件使用 secret checklist，並在 preflight 掃描禁止檔名與常見 secret patterns。
- [Risk] push 後 migration 失敗造成服務不可用 → [Mitigation] migration 仍在 container startup 執行，部署失敗保留 deployment，使用 Git revert／重跑修復，不自動刪除資料庫或 volume。
- [Risk] 客戶只複製 workflow 未完成 Zeabur app／volume 初始化 → [Mitigation] bootstrap 與 workflow 都檢查必要 IDs、variables、domain 與 health endpoint，並在錯誤訊息指出 onboarding stage。
- [Risk] 升級時客戶客製化與 vendor 版本衝突 → [Mitigation] 先建立 upgrade branch、輸出衝突清單並阻止未確認的 merge／deploy。
- [Risk] 把沒有 GitHub 的舊資料夾直接發布覆蓋遠端 → [Mitigation] remote 非空時先停止並要求明確確認，保留本機 snapshot 與初始 branch。

## Migration Plan

1. 新增 workflow、bootstrap、verification script 與客戶文件，先在目前 repository 的非 production project 驗證。
2. 完成一次 customer fixture 的 GitHub secret／variable 設定，push 測試 commit，確認 build、deployment、首頁與 version SHA。
3. 將 workflow 與文件納入交付模板；既有手動部署 checkpoint 保留作為 migration 期間的 fallback，不自動改動既有 Zeabur 資源。
4. 若 workflow 失敗，使用 Zeabur deployment ID 查 log，修正後重新執行同一 workflow；若需回滾，revert 已部署 commit 並重新部署。

## Resolved Decisions

- 客戶交付採「客戶先初始化 Zeabur 基礎資源，GitHub Actions 持續更新」；不採全自動租主機／建資料庫模式。
- 每個客戶使用獨立 GitHub repository。
- production branch 固定預設為 `main`，可透過 repository variable `DEPLOY_BRANCH` 明確改變。
- workflow 使用固定版本 Zeabur CLI；不把 vendor CLI session 或 token 放入 application repository。
- upgrade 遇到衝突、migration risk 或 health gate 失敗時必須人工確認；不得自動 merge 或 deploy unresolved changes。
- cron worker 由交付包提供安裝腳本並在 app 建立後驗證；Cloudflare Stream、Email、金流、OAuth 與自有網域維持選配，不阻擋基本部署。
