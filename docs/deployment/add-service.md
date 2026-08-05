# Add service：增加服務

## Cron worker

在能長期連線正式 URL 的主機執行 `deploy/cron-worker/install.sh`。env file 必須 mode `600`，`APP_URL` 與 app 相同，`CRON_SECRET` 必須相同；systemd user service 必須 active。驗證五個核心 routes 皆 2xx，Cloudflare Stream route 若未設定 provider 可標為 non-blocking。

## Optional providers

Cloudflare Stream、Email、金流、OAuth 與自有網域是選配。憑證由客戶在 Zeabur secret store 或後台輸入；不能提交 Git、workflow variable 或 state file，也不阻擋基本平台上線。

新增任何 service 前，先確認 account、project、dependency order、port、volume 與 rollback resource；若需要 billing、browser authorization 或第三方憑證，停止並交給客戶。
