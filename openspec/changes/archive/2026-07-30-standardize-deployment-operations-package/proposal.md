## Why

本次 Zeabur 部署花費大量時間反覆排查主機初始化、build/runtime 相依套件、資料庫連線、Port、版本識別、永久硬碟、網址切換與 cron 驗證問題。舊版專案雖保留 Zeabur skill lock，但目前缺少可直接交接執行的 onboarding 規範與完整安裝包，導致每次安裝、更新或增加服務都必須重新推理流程。

## What Changes

- 新增一個集中式部署作業包，統一保存安裝、更新、加服務、驗收、回滾與故障排除規範。
- 將 Zeabur 主機、ZeaburOS/k3s、project、PostgreSQL、Docker image、runtime dependencies、Port、環境變數、秘密、/data volume、domain、cron 與清理步驟寫成可執行的檢查流程。
- 新增安裝前 preflight、部署後 health gates、更新前備份／回滾、增加服務的相依性檢查，以及禁止輸出秘密的安全規則。
- 提供適合 AI agent 交接的 AGENT.md／onboarding 說明，讓 sr 工作與部署作業包能互相銜接。
- 將本次實際遇到的失敗模式與可觀測驗證方式納入規範，避免只依賴人工記憶。

## Capabilities

### New Capabilities

- `deployment-operations-package`: 可重複執行且可交接的部署、更新、加服務、驗收、回滾與故障排除作業包。

### Modified Capabilities

（目前沒有既有 spec；本 change 新增獨立部署能力。）

## Impact

- Affected specs: openspec/changes/standardize-deployment-operations-package/specs/deployment-operations-package/spec.md
- Affected documentation:
  - New: docs/deployment/AGENT.md
  - New: docs/deployment/install.md
  - New: docs/deployment/update.md
  - New: docs/deployment/add-service.md
  - New: docs/deployment/verification.md
  - New: docs/deployment/troubleshooting.md
  - New: docs/deployment/rollback.md
  - New: docs/deployment/checklists/preflight.md
  - New: docs/deployment/checklists/post-deploy.md
- Affected project guidance:
  - Modified: AGENTS.md
  - Modified: docs/ZEABUR-DEPLOYMENT-RUNBOOK.md
- Affected operational assets:
  - New: deploy/zeabur/preflight.sh
  - New: deploy/zeabur/verify.sh
  - New: deploy/zeabur/update.sh
  - New: deploy/zeabur/add-service-checklist.sh
