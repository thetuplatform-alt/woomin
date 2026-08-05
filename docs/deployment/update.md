# Update：日常部署

1. 在客戶 repository 將修正提交到 `DEPLOY_BRANCH`（預設 `main`）。dirty worktree 不得直接部署。
2. 由 `.github/workflows/deploy-zeabur.yml` 使用觸發 commit 的完整 SHA 建置並只更新指定 app service。
3. 等待 deployment terminal state，保存 deployment ID，執行 [verification](verification.md)。
4. 失敗時保留 deployment、database、volume、domain 與 state；修正後可重跑 workflow，不可刪除資料資源。

若要升級 vendor 版本，先保留 customer `origin`，加入 vendor `upstream`，在 upgrade branch 做 migration dry-run 與衝突報告；未經人工確認不得 merge 或 deploy。

可先執行 `deploy/zeabur/upgrade-report.sh`。它會輸出原 production commit、origin/upstream、dirty worktree 與人工審查門檻；失敗時保留 branch，不自動合併。
