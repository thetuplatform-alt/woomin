## 1. 帳號隔離與可續跑狀態

- [ ] 1.1 `Target account isolation`／「驗證並切換 Zeabur 帳號」：依使用者授權把全域 CLI 切換到 `.env` API key 對應帳號，只有 `auth status` 精確回報 `thetuplatform-alt` 才能繼續，登入後立即 unset token；部署成功後登出目標帳號、啟動瀏覽器授權並以 `auth status` 精確回報 `fish` 驗證恢復完成，不宣稱 Zeabur CLI v0.21.0 支援不存在的 XDG 隔離。
  - Evidence: `npx zeabur@latest auth status --json` verified username `thetuplatform-alt`; restoring `fish` is intentionally deferred until terminal deployment success.
- [x] 1.2 `Durable non-secret deployment state`／「以本機部署狀態檔提供冪等續跑」：讓 `.realms-deploy.json` 在寫入任何資源 ID 前已被 `.gitignore` 忽略，並以規格 JSON 形狀記錄初始 step、帳號及 RFC3339 時間；以 `git check-ignore .realms-deploy.json`、JSON parse、禁止欄位名稱掃描及 shell memory 中 secret exact-value comparison 驗證，命中時只輸出位置而不輸出值。

## 2. 主機、專案與資料庫

- [x] 2.1 `Confirmed dedicated server provisioning`／「重用已核准的東京專用主機方案」：只查詢並重用 server `6a69de894ac7e3522bbc12f0`，不得再次呼叫 `server rent`；以 `server get --json` 驗證 `TENCENT`、Tokyo、2 CPU、約 8 GB／80 GB、`ProvisioningStatus=READY`、`VMStatus=RUNNING`、`HasK3s=true` 及 `Server initialized` 事件。managed runtime 未完成時保存每月 US$6 主機並停止，不建立 project services、不手工安裝 K3s。
-  - Evidence: `npx zeabur@latest server get --id 6a69de894ac7e3522bbc12f0 --json` verified the exact Tencent Cloud Tokyo server, `ProvisioningStatus=READY`, `VMStatus=RUNNING`, 2 CPU, 7685 MB memory, 80512 MB disk, `HasK3s=true`, and Zeabur event `Zeabur system components reinstalled successfully!`; `server exec` verified `/usr/local/bin/k3s` and `k3s_service=active`.
- [x] 2.2 `Isolated project and database`：在已確認主機建立獨立 Zeabur project 與 PostgreSQL，每 15 秒輪詢且最多 10 分鐘，只有最新 deployment 成功、service 可用及非空 `DATABASE_URL` 三者同時成立才保存 project／service ID；以 project region 對應 server ID、deployment 查詢、service list 及 private variable presence 驗證，terminal failure 或 timeout 記錄 `failedStep: db_deployed` 並停止。
  - Evidence: project `6a6a062c9949111176cf2768` reports region `server-6a69de894ac7e3522bbc12f0`; template `B20CX0` returned `Template deployed`; service list contains PostgreSQL `6a6a064c9949111176cf2772`; service instruction returned a non-empty connection configuration without persisting its secret value.

## 3. 映像、網址與正式服務

- [ ] 3.1 「以 build carrier 與帶硬碟的正式服務分離職責」第一階段：用現有 `Dockerfile` 建立暫時 build carrier，依序嘗試 `thetu`、`thetu-course`、`thetu-platform`、`thetu-<projectId末六碼>` 取得免費 HTTPS 子網域，設定一致的 build-time `APP_URL`／`NEXT_PUBLIC_APP_URL` 後完成最終 OCI image；以平台接受的 domain、build log 成功、image reference 及 build-time URL 比對驗證，若 domain 改變必須重建 image，runtime-only 修改不得完成本 task。
  - Blocker/Evidence: build carrier `6a6a07239949111176cf27f4` has domain `thetu.zeabur.app`; its first build compiled successfully but runtime lacked `DATABASE_URL`, so the carrier was configured with `${POSTGRES_CONNECTION_STRING}` plus URL/storage variables. Runtime image packaging then required explicit `@prisma/adapter-pg` and runner-level `zod` copies after container logs exposed missing modules. Deployment `6a6a1062eac99cc636f2c92a` crashed on the missing `zod`; the corrected deployment `6a6a1293eac99cc636f2ca79` is currently `BUILDING`. No production app was created.
- [ ] 3.2 `Production image and persistent storage`：使用 build carrier image 建立初始 spec 已包含 TCP 8080 與 `/data` persistent volume 的正式 app service，且未取得 service spec 與 Zeabur 硬碟頁的雙重平台證據前不記錄為 production app；以 spec 顯示 `/data`、硬碟頁顯示 `/data` 驗證，無法自動讀取 UI 時由使用者明確確認，否則 `uiVolumeVerified` 維持 false。
- [ ] 3.3 `Secure production configuration`／「將 secrets 與資料庫設定只注入遠端正式環境」：依設計矩陣注入私有 `DATABASE_URL`、三個互不相同且至少 32 bytes 的安全亂數 secret、`LOCAL_STORAGE_ROOT=/data/uploads` 及一致的正式 HTTPS URL，且不回顯或落地 secret；以遠端七個 variable 名稱與 build/runtime scope、URL 值比對、本機狀態、`git diff` 禁止欄位及 exact-value 掃描驗證。

## 4. Fail-closed 正式驗收

- [ ] 4.1 `Database migration and application health`／「採用 fail-closed 分層驗收」：確認啟動期 migration 成功、容器內 `http://127.0.0.1:8080` 回應，任一失敗時保留診斷資源且不得推進；以 runtime log、內部 curl 狀態碼及狀態旗標驗證 `Failure modes` 契約。
- [ ] 4.2 驗證 `Production image and persistent storage` 的 restart persistence：在 `/data` 寫入帶隨機內容的 marker、restart 正式服務後讀回完全相同內容；以 restart 前後 checksum 與平台硬碟頁驗證 `Interfaces and state` 及 `/data` 掛載契約。
- [ ] 4.3 驗證外部 `Observable behavior`：把免費 HTTPS 網址只綁到正式 app，確認首頁與 `/api/version` 成功，且 commit SHA 等於本機 Git HEAD 且不是 `unknown`；以外部 curl 狀態、JSON／文字版本值及 `APP_URL` 比對完成 `Acceptance criteria`。

## 5. 排程、清理與交付

- [ ] 5.1 `Scheduled worker activation`／「安裝並驗證既有 cron worker」：在同一專用主機上傳並安裝 `deploy/cron-worker/install.sh` 與 `worker.sh`，使用正式 URL 與相同 `CRON_SECRET` 啟動長駐 worker；以 systemd user service 為 `active`、75 秒內五個核心 routes 各自 2xx 且無任何 401／403 驗證。未啟用 Cloudflare Stream 時，`cloudflare-stream-sync` 的明確 provider-not-configured error 不阻擋 `cronVerified`。
- [ ] 5.2 `Safe cleanup and cost reporting`：所有健康閘門成功後刪除無狀態 build carrier、登出 `thetuplatform-alt` 並啟動瀏覽器授權恢復 `fish` CLI 登入，保留正式 server、database、app、volume 與 domain；以 service list、`auth status` 回報 `fish` 及 `.realms-deploy.json` 的 `step: done` 和全 true checks 驗證。若任一步驟失敗，依 `Failure modes` 輸出固定欄位 `failedStep`、`reason`、各資源 ID、domain、`recurringCostUSD: 6`、`resourcesRetained`、`resumeAction` 與目前 CLI 帳號，且不自動刪除付費或持久資源。
- [ ] 5.3 確認 `Scope boundaries`：檢查本次 diff 與遠端服務只涵蓋部署狀態、Zeabur 正式環境及 cron，未修改應用功能、未設定自有網域、Email、金流、OAuth、進階影片或物件儲存；以 `git diff --stat`、service list 與 variable 名稱清單人工核對。
