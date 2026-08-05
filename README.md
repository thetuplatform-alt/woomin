# WooMin

這是一個以 `Next.js 15 + Prisma 7` 建構的課程販售平台，現在採用 `Simple-first` 架構：

- 預設部署以 `Zeabur` 為主
- 圖片與附件預設使用本地 volume
- 影片預設支援 `YouTube`
- `Cloudflare Stream / S3 / SMTP / Google / Apple` 都改為上線後再啟用的進階功能

## Quick Start

1. 安裝依賴

```bash
pnpm install
```

2. 建立環境變數檔

```bash
cp .env.example .env
```

只需要先填這一項：

```env
DATABASE_URL="postgresql://user:password@localhost:5432/course_platform"
```

登入功能也不需要額外補 `AUTH_TRUST_HOST`、`NEXTAUTH_URL` 或 `AUTH_URL`。

3. 初始化 Prisma

```bash
pnpm prisma generate
pnpm prisma db push
```

4. 啟動開發環境

```bash
pnpm dev
```

5. 完成首次 setup

登入後進入 setup flow，依序選擇：

1. 影片方案：`YouTube` 或 `Cloudflare Stream`
2. 圖片儲存：本地儲存或 S3 相容儲存
3. Email：可先跳過
4. Google 登入：可先跳過
5. Apple 登入：可先跳過

## Zeabur 部署建議

完整客戶交付與運維入口在 [`docs/deployment/AGENT.md`](docs/deployment/AGENT.md)，首次初始化請先閱讀 [`docs/customer-deployment.md`](docs/customer-deployment.md)。客戶使用自己的 Zeabur workspace、獨立 GitHub repository 與 PostgreSQL；GitHub Actions 只更新既有 app service，不會自動租用或刪除付費資源。

- App Service 掛上 PostgreSQL，提供 `DATABASE_URL`
- 額外掛一個 persistent volume 到 `/data`（應用程式會在其下使用 `/data/uploads`）
- `APP_URL` 與 `NEXT_PUBLIC_APP_URL` 都要填正式 HTTPS 網址，並在 Zeabur 標記為 **build-time 變數**；這兩項會在 Docker build 時寫入 Server Actions 的 origin 白名單
- 不需要先準備 S3、Cloudflare Stream、SMTP 或 OAuth 憑證

部署前執行 `./deploy/customer/bootstrap.sh` 與 `./deploy/zeabur/preflight.sh`；部署後依 `docs/deployment/verification.md` 驗證 migration、`8080`、`/api/version` SHA、`/data` 與 cron。需要 billing、browser authorization、第三方憑證或 account choice 時，停下來由客戶確認。

若之後要啟用進階功能，可在以下位置補設定：

- `/admin/setup`
- `/admin/settings`

## 排程機制

Zeabur 不會自動替客戶執行這個 repo 的 cron route。請在一台能長時間運作、可以連到正式網址的主機上執行一次安裝腳本；腳本會建立一個 curl-loop worker，不需要另開一個付費 Zeabur 服務：

```bash
export APP_URL="https://example.com"
export CRON_SECRET="與 App Service 相同的密鑰"
./deploy/cron-worker/install.sh
```

worker 會每分鐘觸發電子報、作業附件清理、Cloudflare Stream 同步與自動化電子報；課程到期提醒與訂閱維運則預設每天觸發一次。若不安裝或主機重開後沒有讓 worker 自動啟動，到期提醒、扣款提醒、電子報佇列與附件清理都可能停止。

如果安裝腳本顯示主機沒有 `systemd`，macOS 請用內建的 `launchd`。先建立設定檔：

```bash
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$HOME/Library/LaunchAgents/me.woomin.cron-worker.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>me.woomin.cron-worker</string>
  <key>ProgramArguments</key><array><string>/bin/sh</string><string>-c</string><string>. "$HOME/.config/woomin/cron-worker.env" &amp;&amp; "$HOME/.local/bin/woomin-cron-worker.sh"</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
PLIST
launchctl load "$HOME/Library/LaunchAgents/me.woomin.cron-worker.plist"
```

看到 `launchd` 已載入後，worker 會在登入時自動啟動；要停止它可執行 `launchctl unload "$HOME/Library/LaunchAgents/me.woomin.cron-worker.plist"`。

## 常用指令

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm prisma generate
pnpm prisma db push
pnpm prisma studio
pnpm admin:init <email>
```

`pnpm build` 只負責產生 Prisma Client 與 Next.js build，不會連線資料庫或修改資料。Docker 容器啟動時才會執行 migration 與設定同步。

## 進階整合

以下功能都不是啟動必填項目：

- Cloudflare Stream
- S3-compatible storage
- SMTP / Resend
- Google OAuth
- Apple OAuth

需要時再到後台設定，或補上對應環境變數即可。

## 部署限制與說明

- 本地 volume 適合 Zeabur 單實例部署，主要用於圖片與附件。
- 若未來要走多實例、跨區或更高可用性，仍建議改用 S3 相容物件儲存。
- YouTube 適合低門檻上線，不適合高度保護型付費影片場景。
- 若要使用 Cloudflare Stream、社群登入或 Email 發信，請在後台設定完成後再啟用。
