## Why

目前部署依賴開發者本機的 Zeabur CLI、帳號與手動狀態，客戶接手後無法僅靠自己的 GitHub repository 完成初始化，也無法可靠地以 push 觸發更新。需要把部署責任、機密、資料庫與持久儲存清楚分離，讓每位客戶都能用自己的 GitHub 與 Zeabur 帳號重現同一套流程。

## What Changes

- 提供可交付給客戶的部署初始化流程：客戶 fork／複製 repository、建立自己的 Zeabur project 與 PostgreSQL、設定 persistent volume 與必要 variables。
- 建立以 GitHub Actions 為入口的自動部署流程：指定分支 push 後建置 Docker image、部署到客戶自己的 Zeabur app service，並在失敗時保留可診斷的 deployment log。
- 將 Zeabur API token、資料庫連線與應用 secrets 改由 GitHub Actions Secrets／Zeabur Variables 管理，不進 repository、狀態檔或 log。
- 提供首次設定、重新部署、回滾／重新執行與健康檢查文件，明確標示客戶需要準備的帳號、權限、變數與成本資源。
- 讓部署後能以 `/api/version` 回報實際部署的 Git commit SHA，方便客戶確認 push 是否已上線。
- 提供可重複使用的運維 Spectra skill；輸入 GitHub repository URL 與 `install`、`update`、`upgrade` 或 `troubleshoot` 動作後，先辨識 repository 狀態，再執行對應流程。
- 支援沒有 GitHub 版控的既有本機資料夾：初始化 Git、建立或連接 repository、保留現有程式碼，並在第一次部署前完成可追蹤的 commit。
- 支援以 vendor upstream 與 customer origin 分離的升級流程：先產生差異與衝突報告，通過驗證與使用者確認後才套用升級並部署。
- 新增集中式 deployment operations package，統一保存 preflight、ZeaburOS/k3s、runtime dependency、`/data` volume、cron、domain、health gates、回滾與故障排除規範。
- 已確認交付模式：客戶先在自己的 Zeabur workspace 完成一次性基礎資源初始化，後續由 GitHub Actions 自動部署更新；不由 workflow 自動租用或刪除付費基礎設施。
- 已確認 repository 模式：每個客戶使用獨立 GitHub repository，客製化與 secrets 不與其他客戶共用。

## Capabilities

### New Capabilities

- `customer-deployment-bootstrap`: 客戶可依文件完成獨立的 GitHub、Zeabur project、資料庫、volume、secrets 與首次上線設定。
- `github-zeabur-auto-deploy`: 客戶 push 指定分支後，GitHub Actions 可驗證、建置並部署對應 commit 到其 Zeabur app service。
- `deployment-health-and-recovery`: 自動部署完成後提供版本、HTTP、migration 與失敗診斷／重跑的可驗證結果。
- `repository-intake-and-operation`: 運維 skill 可從 GitHub URL 或本機 repository 辨識 install、update、upgrade、troubleshoot 所需的狀態與操作入口。
- `platform-upgrade-orchestration`: 以 upstream／origin、版本標記、資料庫 migration 與可回滾 commit 管理平台升級。
- `deployment-operations-package`: 提供可交接的安裝、更新、增加服務、驗收、回滾、故障排除與非秘密部署狀態規範。

### Modified Capabilities

（本次沒有既有 capability 需要修改；全部 capability 都是新增。）

## Impact

- Affected specs: `customer-deployment-bootstrap`, `github-zeabur-auto-deploy`, `deployment-health-and-recovery`, `repository-intake-and-operation`, `platform-upgrade-orchestration`, `deployment-operations-package`
- Affected code:
  - New: `.github/workflows/deploy-zeabur.yml`, `deploy/customer/bootstrap.sh`, `deploy/customer/verify-deployment.sh`, `skills/woomin-platform-ops/SKILL.md`, `docs/customer-deployment.md`, `docs/deployment/AGENT.md`, `docs/deployment/install.md`, `docs/deployment/update.md`, `docs/deployment/add-service.md`, `docs/deployment/verification.md`, `docs/deployment/troubleshooting.md`, `docs/deployment/rollback.md`, `deploy/zeabur/preflight.sh`, `deploy/zeabur/verify.sh`, `deploy/zeabur/update.sh`, `deploy/zeabur/state.schema.json`
  - Modified: `AGENTS.md`, `Dockerfile`, `README.md`, `docs/ZEABUR-DEPLOYMENT-RUNBOOK.md`, `.gitignore`, `.zeaburignore`
  - Removed: 不刪除既有應用功能或現有 cron worker
- Affected external systems: 客戶 GitHub repository、GitHub Actions、客戶 Zeabur workspace/project、PostgreSQL、persistent volume、客戶自管 secrets
