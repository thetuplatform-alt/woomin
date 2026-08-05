## Context

此專案是 Next.js 16、Prisma 7 與 PostgreSQL 組成的單實例課程平台，Dockerfile 已針對 Zeabur standalone runtime、啟動期 migration 與 8080 port 設計。圖片與附件預設落在 `/data/uploads`，所以正式 App Service 必須在建立當下把持久硬碟掛到 `/data`；既有 service 事後補掛缺乏可靠更新路徑。

本機 Zeabur CLI 原先登入 `fish`，但 `.env` 的 `api_key` 已驗證屬於 `thetuplatform-alt`，且使用者已允許部署期間把全域 CLI 切換到該帳號。目標帳號已有本次建立的騰訊雲東京 2C／8 GB／80 GB 主機 `6a69de894ac7e3522bbc12f0`，費用每月 US$6；VM 為 `RUNNING`、`ProvisioningStatus=READY`，但 Zeabur managed runtime 尚未完成，`HasK3s=false` 且最後事件停在 `Validating server hardware`。目前沒有 project、PostgreSQL、App Service、volume 或 domain。任何恢復流程都必須重用該 server ID，不得再次租用。

## Goals / Non-Goals

**Goals:**

- 全程只操作 API key 對應的 `thetuplatform-alt` 帳號。
- 租用且只租用已核准的東京 2C／8 GB／80 GB 主機，並支援中斷後冪等續跑。
- 建立隔離的 PostgreSQL 與正式網站服務。
- 正式服務從建立當下就具備 `/data` 持久硬碟，且由容器內與平台設定兩側驗證。
- 使用免費 Zeabur HTTPS 子網域完成首次上線，讓 build-time 與 runtime URL 完全一致。
- 啟動既有 cron worker，使排程、電子報與清理端點能被持續觸發。
- 以資料庫、內部 HTTP、外部 HTTPS、版本與儲存測試作為完成門檻。

**Non-Goals:**

- 不使用或修改 `fish` Zeabur 帳號的任何資源。
- 不修改課程平台功能、資料模型或 UI。
- 不在本次設定自有網域、Email、金流、Google／Apple 登入、Cloudflare Stream 或 S3。
- 不把 API key、資料庫密碼或自動產生的 secrets 寫入 Git 或部署狀態檔。
- 不在未取得額外同意時刪除已租用的付費主機或正式資料。

## Decisions

### 驗證並切換 Zeabur 帳號

Zeabur CLI v0.21.0 把設定路徑硬編碼為 `$HOME/.config/zeabur/cli.yaml`，不遵守 `XDG_CONFIG_HOME`，因此原先的隔離設定假設不可實現。使用者已明確允許在部署期間把全域 CLI 切換到 `thetuplatform-alt`，部署完成後再切回 `fish`。第一個閘門仍是 `auth status` 的 username 必須精確等於 `thetuplatform-alt`；若不相符立即停止。登入時關閉 shell xtrace、把 token 保存在 shell variable並抑制登入輸出，登入後立即 unset token。Zeabur CLI 的 `--token` 介面仍會讓 token 在登入程序存活期間短暫存在 process argv；本設計承諾不回顯、不寫入部署狀態、不進 Git與縮短暴露時間。最後先登出 `thetuplatform-alt`，再執行瀏覽器授權並以 `auth status` 精確驗證 `fish`，否則帳號恢復 task 不得標記完成。

### 重用已核准的東京專用主機方案

主機規格固定為 provider `TENCENT`、region `ap-tokyo`、plan `bundle_starter_nmc_lin_med8_01`，即 2 CPU、8 GB、80 GB。該主機已建立，ID 固定為 `6a69de894ac7e3522bbc12f0`；恢復時先用 `server get --json` 驗證 ID、provider、region、硬體與 VM `RUNNING`，絕不再次呼叫 `server rent`。主機 readiness 分成兩層：VM gate 要求 `ProvisioningStatus=READY` 與 `VMStatus=RUNNING`；managed runtime gate 要求 `HasK3s=true` 且事件含 `Server initialized`。只有兩層都通過才能部署 PostgreSQL 或 App Service。若 managed runtime 仍停在 `Validating server hardware`，保存現況並停在 Task 2.1，不以手工安裝 K3s 繞過 Zeabur 註冊。替代方案 GCP 台灣成本顯著較高，東京 2C／4 GB 則無法為 Next.js Docker build 保留足夠餘裕。

### 以本機部署狀態檔提供冪等續跑

`.realms-deploy.json` 僅記錄非敏感識別碼、步驟、網址與驗證旗標；`.gitignore` 必須忽略它。每完成一個外部資源步驟立即原子更新狀態，重跑前先查遠端資源仍存在才重用。替代方案只依聊天紀錄無法抵抗 session 中斷。

狀態資料形狀：

```json
{
  "step": "server_ready",
  "zeaburAccount": "thetuplatform-alt",
  "serverId": "...",
  "projectId": "...",
  "serviceIds": { "db": "...", "buildCarrier": "...", "app": "..." },
  "domain": "...zeabur.app",
  "checks": {
    "volumeVerified": false,
    "uiVolumeVerified": false,
    "internalHttpVerified": false,
    "externalHttpVerified": false,
    "versionVerified": false,
    "cronVerified": false
  },
  "updatedAt": "RFC3339 timestamp"
}
```

### 以 build carrier 與帶硬碟的正式服務分離職責

先用原始碼建立暫時的 build carrier，取得建置成功的 OCI image；正式 App Service 再以該 image 建立，且建立 spec 同時包含 `volumes: [{ id: "data", dir: "/data" }]` 與 8080 port。正式網址、環境設定與對外流量只屬於正式服務。這避免直接 deploy 建出的 service 缺少硬碟又無法可靠補掛。

免費子網域會在 build carrier 階段依序嘗試 `thetu`、`thetu-course`、`thetu-platform`，前三個皆被占用時使用 `thetu-<projectId末六碼>`；每個名稱只有在 Zeabur 明確接受綁定後才停止嘗試。設定 `APP_URL` 與 `NEXT_PUBLIC_APP_URL` 為相同 HTTPS URL 並觸發最終 build，確保 Next.js Server Actions origin 白名單與正式網址一致。若最終網址與任一 build-time URL 不同，一律更新兩者並重新建置 image，runtime-only 修改不得通過。正式服務健康後移轉網址並刪除純暫時的 build carrier。

### 將 secrets 與資料庫設定只注入遠端正式環境

`DATABASE_URL` 使用同專案 PostgreSQL 服務提供的私有連線值。`AUTH_SECRET`、`NEWSLETTER_UNSUBSCRIBE_SECRET` 與 `CRON_SECRET` 各自以密碼學安全亂數產生，三者不得相同；只寫入 Zeabur variables，不進 `.env`、狀態檔或命令輸出。`LOCAL_STORAGE_ROOT` 固定為 `/data/uploads`。公開 URL 相關值同時設為 build-time 與 runtime 所需值。

| Variable | Build-time | Runtime | Validation |
|---|---:|---:|---|
| `DATABASE_URL` | 否 | 是 | 非空且來源為同 project 的 PostgreSQL private variable |
| `AUTH_SECRET` | 否 | 是 | 32 bytes 以上安全亂數 |
| `NEWSLETTER_UNSUBSCRIBE_SECRET` | 否 | 是 | 32 bytes 以上且不同於其他 secrets |
| `CRON_SECRET` | 否 | 是 | 32 bytes 以上且不同於其他 secrets |
| `APP_URL` | 是 | 是 | 等於最終 HTTPS URL，無結尾斜線 |
| `NEXT_PUBLIC_APP_URL` | 是 | 是 | 等於 `APP_URL` |
| `LOCAL_STORAGE_ROOT` | 否 | 是 | 精確等於 `/data/uploads` |

secret 檢查在值仍存在 shell memory 時以 exact-value comparison 掃描 `.realms-deploy.json` 與 `git diff`，同時掃描禁止欄位名稱 `api_key`、`DATABASE_URL`、`AUTH_SECRET`、`NEWSLETTER_UNSUBSCRIBE_SECRET`、`CRON_SECRET`。檢查只輸出命中位置與欄位名稱，不輸出命中值；完成後 unset 所有 secret variables。

### 安裝並驗證既有 cron worker

在專用主機上傳 `deploy/cron-worker/install.sh` 與 `deploy/cron-worker/worker.sh`，使用既有契約建立長駐 curl-loop，傳入正式 `APP_URL` 與同一個 `CRON_SECRET`。不新增另一台付費主機。驗收必須確認 `systemctl --user is-active woomin-cron-worker.service` 回傳 `active`，並在 75 秒觀察窗內讓 `newsletter-dispatch`、`assignment-cleanup`、`newsletter-automation-dispatch`、`course-expiration`、`subscription-maintenance` 五個核心 route 以 Bearer token 取得 2xx。`cloudflare-stream-sync` 只有在 Cloudflare Stream 已設定時才要求 2xx；本次未啟用時允許其回傳明確的未設定錯誤，且不影響 `cronVerified`。任何 401／403 都代表 secret 不一致並立即失敗。

### 採用 fail-closed 分層驗收

每個階段只在前一層明確成功後繼續。PostgreSQL 建立後每 15 秒查詢一次，最多 10 分鐘；成功條件是最新 deployment 成功、service 可用且匯出非空 `DATABASE_URL`，任何明確 terminal failure 或第 10 分鐘仍未符合即停止。正式 app service 必須同時通過：Zeabur 硬碟頁顯示 `/data`、service 建立 spec 含 `/data` volume、容器內 `/data` 是 mount 且可寫、localhost:8080 回應、外部 HTTPS 回應、`/api/version` 可辨識部署版本、資料庫 migration 無錯誤、cron 核心 routes 有成功證據。若無法自動讀取硬碟頁，必須取得使用者對該頁顯示 `/data` 的明確確認，否則 `uiVolumeVerified` 維持 false。任何一項失敗都不得寫成 `done` 或宣稱完成。

## Implementation Contract

### Observable behavior

- 使用者最終取得一個可公開存取的 `https://<subdomain>.zeabur.app` 網址，首頁與 `/api/version` 均成功回應。
- Zeabur `thetuplatform-alt` 帳號內有一台 RUNNING 的騰訊雲東京 2C／8 GB／80 GB 主機，以及同一主機上的獨立 project、PostgreSQL 與正式 app service。
- 正式 app service 的 `/data` 是持久掛載且可寫，應用程式使用 `/data/uploads`。
- 容器啟動紀錄顯示 migration 成功，排程 worker 持續運作。

### Interfaces and state

- 帳號驗證輸出必須解析為 username `thetuplatform-alt`。
- 主機選擇三元組固定為 `TENCENT`／`ap-tokyo`／`bundle_starter_nmc_lin_med8_01`。
- 正式網站對外 port 為容器 TCP 8080。
- `.realms-deploy.json` 遵循 Decisions 所列 JSON 形狀，僅保存非敏感值。
- 遠端必要 variables 包含 `DATABASE_URL`、`AUTH_SECRET`、`NEWSLETTER_UNSUBSCRIBE_SECRET`、`CRON_SECRET`、`APP_URL`、`NEXT_PUBLIC_APP_URL`、`LOCAL_STORAGE_ROOT`；secret 值不得回顯。
- 免費子網域候選順序固定為 `thetu`、`thetu-course`、`thetu-platform`、`thetu-<projectId末六碼>`。
- 失敗報告固定包含 `failedStep`、`reason`、`serverId`、`projectId`、非空的 `serviceIds`、`domain`、`recurringCostUSD: 6`、`resourcesRetained` 與 `resumeAction`；不存在的資源以 `null` 表示。

### Failure modes

- 帳號不符、方案不可用、付款失敗或主機未 RUNNING：停止且不建立後續資源。
- 既有主機 `HasK3s=false` 或未出現 `Server initialized`：保留每月 US$6 主機並停止，不建立 project services、不重租、不手工安裝 K3s。
- build 失敗：保留診斷所需 log 與已租主機，報告目前每月費用，不建立無硬碟的正式服務。
- 正式服務建立時缺少 volume 證據：停止，不綁正式網址、不注入正式流量設定、不將 service 記為 app。
- 內部或外部健康檢查失敗：保留可診斷資源與狀態，不刪除正式資料，不宣稱完成。
- PostgreSQL 在 10 分鐘內未同時符合 deployment 成功、service 可用及 `DATABASE_URL` 非空：記錄 `failedStep: db_deployed` 並停止。
- cron 五個核心 routes 任一非 2xx，或任何 route 回 401／403：記錄 `failedStep: cron_verified` 並停止；未設定 Cloudflare Stream 導致的明確 provider error 不列入核心失敗。
- 成功收尾時登出 `thetuplatform-alt` 並透過瀏覽器授權恢復 `fish`；失敗暫停時明確報告目前 CLI 帳號，不得把帳號恢復標記完成。

### Acceptance criteria

- Zeabur CLI 查詢顯示目標帳號精確為 `thetuplatform-alt`。
- Server get 顯示 provider Tencent Cloud、location Tokyo、VM status RUNNING、約 2 CPU／8 GB／80 GB。
- Project service list 包含 PostgreSQL 與唯一被記錄為正式 app 的服務。
- Zeabur 硬碟設定與容器命令共同證明 `/data` 已掛載且測試檔可跨 app restart 保留。
- 容器內 `http://127.0.0.1:8080` 與外部 HTTPS URL 都取得成功 HTTP 回應。
- `/api/version` 的 commit SHA 與本次部署的本機 Git HEAD 相符，不得為 `unknown`。
- cron worker 狀態正常，cron endpoint 以正確 secret 成功回應。
- 五個核心 cron routes 在 75 秒驗證窗內各有一次 2xx 證據；未啟用的 Cloudflare Stream route 不阻擋完成。
- `git check-ignore .realms-deploy.json` 成功，且 `git diff` 不含任何 secret 值。

### Scope boundaries

本次包含租主機、建立 Zeabur 資源、部署現有 image、必要 variables、免費網址、永久硬碟、cron 與驗收；不包含應用功能修改、自有網域、Email、金流、OAuth、進階影片或物件儲存設定。

## Risks / Trade-offs

- [租用完成後部署失敗仍會持續計費] → 每階段即時記錄 server ID，失敗時明確回報費用與資源狀態，不自動刪除付費主機。
- [2 CPU build 時間較長] → 使用 8 GB 記憶體方案並等待 build 完整結束，不以 timeout 誤判失敗。
- [免費子網域名稱可能被占用] → 依固定候選順序嘗試，最後以 project ID 末六碼形成實務上唯一的 fallback，將平台接受的最終值寫入狀態檔後才完成 build。
- [API 或 CLI 無法直接建立帶 volume 的 service] → 重用 build carrier image 透過 PREBUILT_V2 template 建立正式服務；拿不到建立當下的 volume 證據就停止。
- [本地 volume 限制未來多實例擴展] → 本次固定單實例；多實例時另案遷移 S3 相容儲存。
- [Zeabur CLI token 短暫存在 process argv，且 CLI 不支援 XDG 隔離] → 經使用者授權切換全域 CLI，關閉 xtrace、抑制輸出、縮短登入程序時間並立即 unset token；完成後登出目標帳號並以瀏覽器授權恢復 `fish`，不把「不落地」誤寫成「從未進 argv」。

## Migration Plan

1. 驗證 CLI 已切到 `thetuplatform-alt` 並讀取安全狀態檔。
2. 重用 server `6a69de894ac7e3522bbc12f0`，等待 `HasK3s=true` 與 `Server initialized` 後建立 project 與 PostgreSQL。
3. 建立 build carrier，確定免費 HTTPS 子網域與 build-time URL，完成最終 image build。
4. 使用該 image 建立自帶 `/data` volume 的正式服務，注入必要 variables。
5. 完成 migration、內部 8080、volume、restart persistence、外部 HTTPS 與版本驗證。
6. 安裝並驗證 cron worker。
7. 外部驗收成功後移除 build carrier，狀態標記為 `done`。

Rollback 原則：正式網址切換前可刪除無狀態的暫時 build carrier；網址切換後若新服務失敗，停止流量並保留 PostgreSQL 與 volume。已租主機與正式資料只有在使用者另行明確授權後才能刪除。

## Open Questions

無。本次首次上線採免費 Zeabur 子網域；自有網址與 Email 留待後續設定。
