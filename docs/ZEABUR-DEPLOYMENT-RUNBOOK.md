# Zeabur 部署維運手冊

這份文件記錄 `thetu` 在 Zeabur 部署時遇到的問題、根因與固定檢查順序。下次部署應先照本文件做 preflight，再開始建置；不要把「能建立服務」當成「網站已上線」。

## 這次遇到的問題與永久處理方式

### 1. 主機已租用，但 Zeabur 系統元件未完成

現象：主機顯示 `RUNNING`，但狀態頁顯示偵測到 0 個服務（預期 9 個），且 `HasK3s=false`。因此 CLI 可以列出主機，卻不能正常建立或啟動託管服務。

處理：在主機狀態頁執行「更新 ZeaburOS」，直到 `ProvisioningStatus=READY`、`HasK3s=true`、k3s systemd 服務 active。這不是應用程式的問題，而是主機初始化尚未完成。

固定檢查：租用後先確認 ZeaburOS/k3s 健康，再建立 project、database、app。

### 2. 專案區域參數不是一般區域名稱

專屬主機上的 project 必須使用 `server-<serverId>` 作為 region；直接使用 `ap-tokyo` 會把 project 建到不同類型的區域或造成後續服務不一致。

固定檢查：建立 project 前先取得實際 server ID，並確認 project 的 region 等於該 server ID。

### 3. 資料庫雖然建立，應用程式仍可能沒有連線設定

資料庫服務與應用服務是兩個獨立步驟。應用服務必須設定 `DATABASE_URL=${POSTGRES_CONNECTION_STRING}`（使用 Zeabur reference variable，不要把資料庫密碼寫入程式碼或文件）。

固定檢查：database pod 必須 Running；app service 的 `DATABASE_URL` 必須存在；啟動日誌必須看到 migration 完成。

### 4. 502 不是單純 Port 問題，而是容器 crash-loop

這次應用實際監聽 `0.0.0.0:8080`，Port 設定正確。502 的真正原因是容器啟動命令執行資料庫同步腳本時缺少 runtime module，程序因此退出。

已處理：

- runner 显式提供 `@prisma/adapter-pg`。
- runner 显式提供 `zod`（pnpm 的巢狀 symlink 不會自動完整帶入 standalone image）。
- runtime startup scripts、Prisma CLI、migration assets 分開打包，避免只依賴 builder 的 node_modules。
- `DATABASE_URL` 在 app service 注入，而不是依賴 image 內的 `.env`。

固定檢查：每次新增「啟動時執行」的 TypeScript 腳本，都要檢查它的所有 import 是否存在於 runner image；不能只看 `pnpm install` 在 builder 成功。

### 5. 不能在 Zeabur build context 依賴 `.git`

Zeabur 上傳的 Docker build context 不保證有可用的 `.git`。直接執行 `git rev-parse HEAD` 會把錯誤文字寫入公開的 `/api/version`。

已處理：部署時把本機 HEAD 設為 `GIT_COMMIT_SHA`，Dockerfile 支援 build-time `ARG`，啟動時再以同名 runtime variable 覆寫固定檔案；沒有 git 時不輸出診斷訊息，也不會回傳 `fatal:`。

固定檢查：`/api/version` 必須回傳預期 commit SHA，不得是 `unknown`、`fatal:` 或空字串。

### 6. build-time 與 runtime 設定不同

`APP_URL`、`NEXT_PUBLIC_APP_URL` 會影響 Next.js build 產物（例如 Server Actions allowed origins），不能只在 runtime variables 設定。這兩項必須在建置服務的 build variables 與 runtime variables 都確認。

固定檢查：使用正式網址建置，例如 `https://thetu.zeabur.app`；改網址後要重新 build。

### 7. 永久檔案空間不可漏掉

課程圖片與上傳檔案必須使用 persistent volume `/data`。沒有 volume 時，服務重建或重啟後檔案會消失。

固定檢查：app service 掛載 `/data`，並設定 `LOCAL_STORAGE_ROOT=/data/uploads`；部署完成後做一次寫入／重啟／讀取驗證。

## 舊版 v1.7.3 與目前版本的差異

`/Users/fishtv/Documents/Dev/realms-course-platform-v1.7.3` 的 `AGENTS.md` 內有完整的 `/onboarding` 行為規則：自動租主機、建立 project、建立 PostgreSQL、掛載 `/data`、注入 secrets、確認啟動順序、初始化 Prisma、最後才詢問網址與 Email。現在版本的 `AGENTS.md` 主要是 Spectra 工作流與 `sr` shorthand，沒有把這套 onboarding 行為規則搬回來。

兩個版本都有相同的 `skills-lock.json`，其中列有 `zeabur-auth`、`zeabur-server-rent`、`zeabur-project-create`、`zeabur-database`、`zeabur-dockerfile`、`zeabur-deployment-logs`、`zeabur-port-mismatch` 等外部 Zeabur skills。`skills-lock.json` 只是鎖定來源與版本，不等於這些 skill 的實作檔已存在於目前工作樹；目前可用的本地流程以 Spectra 為主。因此缺少的是「可執行的 onboarding 規則／部署 runbook」，不是單純少一行 API 設定。

Dockerfile 也已從舊版的「build 時執行全部 Prisma／同步腳本」改成目前的「啟動時執行同步腳本」。這個改法可以避免 build 時碰 production database，但也要求 runner image 明確攜帶 runtime dependencies；這就是本次 `@prisma/adapter-pg`、`zod` 問題的來源。

## 下次固定部署順序

1. 確認 Zeabur CLI 登入的是指定帳號，並記錄 account、server ID、project ID。
2. 確認主機是 ZeaburOS、k3s ready、online，再建立任何服務。
3. 以 `server-<serverId>` 建立 project。
4. 建立 PostgreSQL，等待 pod Running。
5. 建立 app/build carrier，注入 `DATABASE_URL` reference、`APP_URL`、`NEXT_PUBLIC_APP_URL`、`LOCAL_STORAGE_ROOT`、`GIT_COMMIT_SHA`。
6. 設定 8080、`HOSTNAME=0.0.0.0`，並掛載 `/data`。
7. 建置完成後先看 deployment status，再看 pod、runtime logs；不要只看服務有沒有 domain。
8. 依序驗證 migration、首頁、`/api/version`、登入／資料庫讀寫、檔案持久化。
9. 所有檢查通過後，才切回原本的 CLI 帳號並標記 Spectra task 完成。

## 本次部署狀態

目前 Zeabur 主機、project、PostgreSQL 與 domain 已建立；最新 app image deployment 正在建置。建置完成後仍需通過 pod、runtime log、首頁 HTTP 200 與 `/api/version` SHA 四項驗證，才算真正完成部署。
