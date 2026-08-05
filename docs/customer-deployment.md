# Customer deployment handoff

這份文件給每位客戶的獨立交付包使用。客戶擁有自己的 GitHub repository、Zeabur workspace、project、PostgreSQL、app、`/data` volume 與 secrets；vendor 不代管或共用這些資源。

## 交付前 checklist

- [ ] 確認 Zeabur workspace、server、region 與 billing owner。
- [ ] 確認 ZeaburOS/k3s ready，再建立 project、PostgreSQL、app 與 `/data` volume。
- [ ] 確認 app 使用 TCP `8080`、`HOSTNAME=0.0.0.0`，並依 dependency order 先 database 後 app。
- [ ] 建立獨立 GitHub repository，保留 customer `origin`。
- [ ] 執行 `deploy/customer/bootstrap.sh` 與 `deploy/zeabur/preflight.sh`。

## GitHub Actions 設定

| 類型 | 名稱 | 來源 | 驗證方式 |
| --- | --- | --- | --- |
| Secret | `ZEABUR_TOKEN` | 客戶 Zeabur workspace token | workflow 只驗證存在 |
| Variable | `ZEABUR_PROJECT_ID` | customer project ID | target review |
| Variable | `ZEABUR_SERVICE_ID` | customer app service ID | deployment output |
| Variable | `ZEABUR_DOMAIN` | customer HTTPS domain | homepage/version checks |
| Variable | `DEPLOY_BRANCH` | 預設 `main` | trigger branch |

## Zeabur build-time/runtime variables

建立以下 runtime variables；`APP_URL` 與 `NEXT_PUBLIC_APP_URL` 同時建立 build-time variables：

| 名稱 | 類型 | 來源／用途 | 驗證 |
| --- | --- | --- | --- |
| `DATABASE_URL` | secret/reference | `${POSTGRES_CONNECTION_STRING}` | migration 與 db health |
| `AUTH_SECRET` | secret | 客戶產生的隨機值 | login/session |
| `NEWSLETTER_UNSUBSCRIBE_SECRET` | secret | 客戶產生的隨機值 | unsubscribe route |
| `CRON_SECRET` | secret | 與 cron worker 相同 |五個核心 routes |
| `APP_URL` | build + runtime | 正式 HTTPS URL | Server Actions/version |
| `NEXT_PUBLIC_APP_URL` | build + runtime | 正式 HTTPS URL | client config |
| `GIT_COMMIT_SHA` | build + runtime | workflow 觸發 SHA | `/api/version` |
| `LOCAL_STORAGE_ROOT` | runtime | 固定 `/data/uploads` | volume/restart marker |

## Database、volume 與 cron

PostgreSQL 必須先 Running，app 才能執行 migration。persistent volume 掛載 `/data`，應用寫入 `/data/uploads`；任何失敗或 rollback 都不得刪除它。cron worker 由 `deploy/cron-worker/install.sh` 安裝，env file mode `600`、systemd service active、正式 URL 與 `CRON_SECRET` 必須與 app 一致。

## 日常更新與回滾

push 到 `main`（或明確設定的 `DEPLOY_BRANCH`）會部署完整 SHA。確認首頁、`/api/version`、migration、`/data` 與 cron 後才算成功。失敗時重跑修正後 revision；需要回復時 revert production branch 並重新部署舊 SHA。保留 database、volume、domain、deployment ID 與 rollback IDs。

## Rotation 與轉移

rotation 時在 Zeabur/GitHub secret store 產生新值，更新 worker 與 app 後重跑 health gates；不要把舊值寫入 issue、log 或 Git。轉移帳號前先由新 owner 完成 browser authorization、billing 與第三方 credential 設定，再更新 repository variables；account choice 未確認前停止操作。
