# WooMin deployment package

這是安裝、更新、增加服務、驗證、回滾與故障排除的唯一入口。所有操作都以客戶自己的 GitHub repository 與 Zeabur workspace 為邊界；本 package 不包含任何 token、密碼、connection string、既有 project ID 或固定網域。

## 操作路由

- [install](install.md)：第一次建立 customer-owned project、PostgreSQL、app、`/data` volume 與 secrets。
- [update](update.md)：只部署已提交的 revision，並執行 health gates。
- [add-service](add-service.md)：增加 cron worker 或選配 provider，保留既有資料資源。
- [verification](verification.md)：部署後以可觀測檢查取代 dashboard 的 Running 狀態。
- [rollback](rollback.md)：以 Git revert／舊 revision 重新部署，禁止刪除資料庫或 persistent volume。
- [troubleshooting](troubleshooting.md)：依 stage 分類 build、runtime、database、HTTP、volume 與 cron 問題。

## 必須停下來交給客戶確認的事項

1. browser authorization：需要登入 Zeabur 或 GitHub 的瀏覽器流程時，要求客戶在自己的帳號完成授權。
2. billing：租用主機、建立付費資源、變更方案或退款，不能由 package 自動確認。
3. third-party credentials：Email、Cloudflare、金流、OAuth 與自有網域憑證只由客戶輸入並保存在對應 secret store。
4. account choice：確認目前 CLI／瀏覽器帳號、workspace、server 與 project 後才可執行任何 mutation。
5. upgrade conflict：有衝突、migration risk 或 health gate 失敗時，保留 branch 與報告，等待人工決定。

## Agent dry-run contract

每次操作先輸出 `repository`、`branch`、`commit`、`target`、`stage` 與 `next action`。先執行 `deploy/zeabur/preflight.sh`，失敗時不得建立或刪除遠端資源。所有 log 只顯示 secret 名稱，不顯示 secret 值。
