## 1. 作業包基礎與入口

- [ ] 1.1 建立集中式作業包而非只擴充根目錄 AGENTS，並交付 Deployment package entrypoint：建立 docs/deployment/AGENT.md、目錄索引與 user-action stop rules，讓新 agent 能找到 install、update、add-service、verify、rollback、troubleshooting；以檔案連結檢查與人工從入口追到每份文件驗證。
- [ ] 1.2 [P] 建立 Secret and state-file protection 與以 schema 驅動的部署狀態檔支援續跑：建立 deploy/zeabur/state.schema.json、gitignore 規則與非秘密狀態範例，定義 account、resource IDs、checks、failedStep、resumeAction、retained resources；以 JSON parse、禁止 secret-key scan、git check-ignore 驗證。

## 2. 前置檢查與安裝流程

- [ ] 2.1 建立 Preflight and account isolation 的 deploy/zeabur/preflight.sh，唯讀檢查 CLI version、active account、server ID、ProvisioningStatus、VMStatus、HasK3s、project region 與既有資源，失敗時非零退出且不產生遠端 mutation；以 mock/實際 CLI JSON fixture 與 shellcheck 或 sh -n 驗證。
- [ ] 2.2 建立 install 文件與 checklist，實作 Production service specification 與使用模板建立正式服務，暫時 carrier 只負責建置的固定順序：ZeaburOS/k3s、project、PostgreSQL、build carrier、image promotion、正式 app、8080、/data、variables、domain、cron；以內容審查確認每步有輸入、成功輸出、失敗停止條件與 resumeAction。
- [ ] 2.3 [P] 建立部署狀態初始化與續跑規則，讓安裝中斷後可由非秘密 state file 重用 server/project/database/app IDs 且禁止重租付費主機；以兩次連續執行的 idempotency fixture、state schema 與 resource-retention assertion 驗證。

## 3. 映像、服務與安全設定

- [ ] 3.1 建立 Production service specification 的 template/schema 範例，要求 verified OCI image、TCP 8080、/data volume、DATABASE_URL reference、APP_URL/NEXT_PUBLIC_APP_URL、GIT_COMMIT_SHA 與 dependency order 在正式服務第一次啟動前存在；以 template validation 與 exported service spec review 驗證。
- [ ] 3.2 建立 Secret and state-file protection 的秘密注入規範與檢查，涵蓋 DATABASE_URL、AUTH_SECRET、NEWSLETTER_UNSUBSCRIBE_SECRET、SETTINGS_ENCRYPTION_KEY、CRON_SECRET 與第三方 token 只進遠端 variables；以 redacted variable listing、tracked-file exact-value scan 與 log scan 驗證。
- [ ] 3.3 [P] 建立把 runtime dependency closure 當成映像驗收項目的檢查，解析 Dockerfile CMD、runtime scripts、Prisma assets 與 standalone runner imports，缺少 @prisma/adapter-pg、zod、dotenv、pg 或 script 時阻止 image promotion；以 fixture image manifest、container startup log 與 non-zero failure assertion 驗證。

## 4. 驗收、更新與故障處理

- [ ] 4.1 建立以可觀測 health gates 取代「服務顯示 Running」的 Health gates and persistence verification：建立 deploy/zeabur/verify.sh 與 post-deploy checklist，分別檢查 migration、pod 1/1、in-container 8080、external HTTPS、/api/version SHA、/data mount、restart marker checksum 與五個核心 cron routes；以成功與各 gate 失敗 fixture 驗證固定 check summary。
- [ ] 4.2 [P] 建立 Safe update and rollback 的 update.md 與 rollback.md，要求新 image 通過全部 gates 前保留舊 deployment、database、volume、domain 與 rollback IDs，domain unavailable 或 build/runtime failure 時不刪除持久資源；以 simulated failed deployment、resumeAction 與 retained-resources review 驗證。
- [ ] 4.3 [P] 建立 troubleshooting.md，收錄 HasK3s=false、project region 錯誤、missing DATABASE_URL、missing runtime module、port mismatch、.git build context、domain ownership、cron 401/403 與 optional provider-not-configured；以每個 failure mode 與 failure modes 都有症狀、根因、命令、停止條件與修復後驗證作內容審查。
- [ ] 4.4 建立 Cron worker lifecycle 的 add-service/install 說明，要求 systemd user service active、env file mode 600、正式 URL、相同 CRON_SECRET、核心 routes 2xx 且 optional Cloudflare route 明確 non-blocking；以 systemd status、route status matrix 與 secret non-disclosure scan 驗證。

## 5. 交接與品質閘門

- [ ] 5.1 更新 AGENTS.md 與 docs/ZEABUR-DEPLOYMENT-RUNBOOK.md 的入口指引，使 sr、install、update、add-service 與 verify 互相連結且不重複矛盾；以 markdown link check、內容 diff review 與新 agent dry-run 驗證。
- [ ] 5.2 建立 docs/deployment/checklists/preflight.md、post-deploy.md 與 add-service checklist，讓使用者可看到只需自己操作的 browser authorization、billing、third-party credential 與 domain/email choices；以逐項 checklist review 驗證所有 user-action stop points 都明確。
- [ ] 5.3 執行完整品質閘門：spectra analyze、spectra validate、shell syntax、JSON parse、secret scan、git diff --check，並確認每個 design decision、behavior、interface / data shape、acceptance criteria、scope boundaries 與每個 spec Requirement 都在 tasks 中有對應；以命令輸出零 Critical/Warning、validate passed、task coverage review 驗證。
