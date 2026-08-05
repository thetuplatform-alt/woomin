# Install：第一次客戶交付

## 客戶先建立資源

在客戶自己的 Zeabur workspace 中建立 project、PostgreSQL、app service 與 persistent volume；專屬主機 project region 使用 `server-<serverId>`。確認 ZeaburOS/k3s ready、database pod Running 後再連接 app。

Production app service 的最低契約：TCP `8080`、`HOSTNAME=0.0.0.0`、`DATABASE_URL=${POSTGRES_CONNECTION_STRING}`、`APP_URL`、`NEXT_PUBLIC_APP_URL`、`GIT_COMMIT_SHA`、`LOCAL_STORAGE_ROOT=/data/uploads`，並掛載 `/data`。`APP_URL` 與 `NEXT_PUBLIC_APP_URL` 同時設定 build-time 與 runtime。

## GitHub 設定

每位客戶使用獨立 repository。建立以下 repository secret／variables：

| 類型 | 名稱 | 來源 | 驗證 |
| --- | --- | --- | --- |
| Secret | `ZEABUR_TOKEN` | 客戶自己的 Zeabur token | workflow 只檢查存在，不輸出值 |
| Variable | `ZEABUR_PROJECT_ID` | 客戶 project | preflight 與 deployment target |
| Variable | `ZEABUR_SERVICE_ID` | 客戶 app service | 只更新此 service |
| Variable | `ZEABUR_DOMAIN` | 客戶正式 HTTPS 網域 | `/` 與 `/api/version` |
| Variable | `DEPLOY_BRANCH` | 預設 `main` | push trigger |

使用固定版本 Zeabur CLI。bootstrap 只做工具與設定檢查，不自動租用、刪除或重建付費資源。

## 首次驗證

```bash
./deploy/customer/bootstrap.sh
./deploy/zeabur/preflight.sh
./deploy/zeabur/verify.sh --domain "$ZEABUR_DOMAIN" --expected-sha "$GIT_COMMIT_SHA"
```

確認 migration、pod 1/1、外部 HTTPS、`/api/version` SHA、`/data` restart marker 與五個核心 cron routes；optional provider 未設定只能列為 non-blocking。
