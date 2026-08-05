---
name: woomin-platform-ops
description: Customer-owned WooMin repository install, update, upgrade and troubleshoot routing.
---

# WooMin platform operations

輸入必須包含 `repository_url`（GitHub URL 或本機目錄）與 `operation`：`install`、`update`、`upgrade` 或 `troubleshoot`；可選 `target` 只接受客戶明確提供的 target，不接受內嵌 secrets。

## Safe routing

先輸出 `repository`、`branch`、`commit`、`target`、`stage`、`next action`，再執行只讀檢查：

```bash
git remote -v
git branch --show-current
git rev-parse HEAD
test -f Dockerfile
find prisma -maxdepth 2 -type f -name '*.sql' -o -name 'schema.prisma'
```

`install`：無 Git 時保留 worktree、初始化 Git、建立初始 commit；remote 非空時在 push 前停止並要求明確確認。`update`：只部署 committed revision，dirty worktree 必須拒絕。`upgrade`：保留 customer `origin`，加入 vendor `upstream`，建立 upgrade branch，產生 conflict/migration report；有未解衝突或 migration risk 時不得 merge/deploy。`troubleshoot`：只收集安全診斷，分類 local Git、build、deployment、runtime、migration、HTTP 或 persistent storage。

## Deployment contract

交付使用 [集中式 deployment package](../../docs/deployment/AGENT.md)。所有 Zeabur mutation 前先跑 `deploy/zeabur/preflight.sh`；需要 browser authorization、billing、third-party credentials 或 account choice 時停止交給客戶。禁止輸出 token、密碼、connection string、`.env` 值或 state secret。

## Upgrade recovery

升級失敗時保留 upgrade branch、deployment ID、原 production commit 與 rollback action；健康檢查未通過前不清理舊 deployment、database、volume 或 domain。回滾採 Git revert／舊 revision deployment，並以 `/api/version` 確認舊 SHA。
