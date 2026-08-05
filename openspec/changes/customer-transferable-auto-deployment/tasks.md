## 1. 客戶初始化與交付契約

- [x] 1.1 [P] 實作 Customer-owned deployment bootstrap：`deploy/customer/bootstrap.sh` SHALL 檢查 `git`、`docker`、`npx`／固定 Zeabur CLI、登入 workspace、project ID、service ID 與 domain，缺少欄位時以非零 exit code 顯示安全欄位名稱；以 shell fixture 測試完整與缺漏輸入兩條路徑。
- [x] 1.2 [P] 實作 No vendor-owned credentials in the delivery package：清理文件與範例中的 vendor project、domain、token、database connection string，建立禁止 secret patterns 檢查；以 `git grep`、`git diff --check` 與範例設定內容審查驗證。
- [x] 1.3 [P] 撰寫 Customer-owned runtime resources 與客戶交付包文件：`docs/customer-deployment.md` SHALL 分開列出 GitHub secret、repository variable、Zeabur build-time/runtime variable、PostgreSQL、`/data` volume 與 cron worker；以文件 checklist 審查確認每個欄位都有名稱、來源與驗證方法。

## 2. GitHub Actions 自動部署

- [x] 2.1 實作 GitHub Actions 作為部署入口與初始化與持續部署分離：`.github/workflows/deploy-zeabur.yml` SHALL 在 `main` push 與 `workflow_dispatch` 觸發，驗證必要設定後只部署 `ZEABUR_PROJECT_ID`／`ZEABUR_SERVICE_ID` 指定的 customer target；bootstrap SHALL 只做 preflight，持續部署 SHALL 只更新既有 app；以 YAML parse、actionlint（若可用）與 workflow fixture 審查驗證。
- [x] 2.2 實作 Secrets 與設定分層及 Deployment configuration and secret isolation：workflow SHALL 從 `ZEABUR_TOKEN` secret 與 repository variables 讀取設定，拒絕缺漏設定且不在 log 輸出 token／application secret；以 intentional-missing-config run 與 log pattern scan 驗證。
- [x] 2.3 實作 Push-triggered customer deployment：workflow SHALL 將觸發 commit 的完整 SHA 傳入 Docker build/runtime 的 `GIT_COMMIT_SHA`，並保留 deployment ID 與 target service 輸出；以 mock deployment command 驗證參數與輸出欄位。
- [x] 2.4 更新 Docker commit propagation：`Dockerfile` 與 deployment command SHALL 在無 `.git` 的 Zeabur build context 中仍保存非空 commit SHA，且不把 `fatal:`／diagnostic error 寫入 `/api/version`；以 container build fixture 與 `/api/version` assertion 驗證。

## 3. 健康檢查與復原

- [x] 3.1 實作 健康檢查與回滾 及 Post-deployment health verification：`deploy/customer/verify-deployment.sh` SHALL 檢查首頁與 `/api/version` HTTP 200，並確認 version SHA 等於指定 commit；以 local HTTP fixture 覆蓋成功、非 2xx、空 SHA 與 SHA mismatch。
- [x] 3.2 實作 Deployment result is auditable 與 Actionable failure output：workflow／verification output SHALL 包含 stage、customer target、deployment ID（若有）、expected SHA 與安全下一步，失敗時 exit non-zero；以 mock success/failure transcript 與 secret absence scan 驗證。
- [x] 3.3 實作 Safe retry and rollback：文件與 workflow SHALL 支援重跑修正後 revision、revert production branch 後重新部署，且明確禁止刪除 PostgreSQL／persistent volume；以兩次相異 SHA 的 fixture run 與文件 scope review 驗證。

## 4. 驗證、文件與交付

- [x] 4.1 [P] 補充 README 與 `docs/ZEABUR-DEPLOYMENT-RUNBOOK.md` 的 customer handoff、rotation、失敗診斷與手動 fallback；以文件 review 確認流程不依賴 vendor 本機帳號，並與 `customer-deployment-bootstrap` spec 逐項對照。
- [x] 4.2 [P] 建立自動化檢查覆蓋三個 capability 與端到端 customer fixture：bootstrap、workflow config、health/recovery 的正常與失敗場景，並使用隔離 GitHub／Zeabur target 確認 build、deployment、首頁、`/api/version` SHA、migration、`/data` 與 cron 文件驗證結果；以 `pnpm test`／指定 shell tests、workflow run URL、deployment ID 與 `spectra analyze customer-transferable-auto-deployment --json` 驗證。

## 5. Repository intake 與運維 skill

- [x] 5.1 [P] 實作 Repository URL intake、Legacy no-Git intake 與 Operation routing：`skills/woomin-platform-ops/SKILL.md` SHALL 接受 GitHub URL 加上 `install`／`update`／`upgrade`／`troubleshoot`，辨識 origin、branch、commit、Dockerfile、migration 與 deployment contract；無 Git 時保留 worktree、初始化 repository，remote 非空時在 push 前停止；以 local fixture 覆蓋 Git／無 Git／非空 remote 與 unsupported operation。
- [x] 5.2 實作 Upstream and customer origin separation 與 Upgrade conflict and migration gate：upgrade SHALL 保留 customer `origin`、加入 vendor `upstream`、建立 upgrade branch，並輸出 conflict／migration report；未通過檢查不得 merge 或 deploy；以兩個 fixture repository、conflict case、migration dry-run 與 `git remote -v` assertion 驗證。
- [x] 5.3 實作 Platform upgrade orchestration 與 Reversible platform upgrade：upgrade 失敗時保留 upgrade branch、deployment ID、原 production commit 與 rollback action，確認 rollback 後 `/api/version` 等於舊 commit；以新舊 SHA 的 mock deployment transcript、health failure fixture 與 rollback verification 驗證。

## 6. 集中式部署作業包

- [x] 6.1 建立 Deployment package entrypoint 與集中式作業包與 agent 入口：建立集中式 docs/deployment/AGENT.md，入口 SHALL 連結 install、update、add-service、verification、rollback、troubleshooting，並明確列出 browser authorization、billing、third-party credentials 與 account choice 的 stop points；以 markdown link check 與新 agent dry-run 驗證。
- [x] 6.2 [P] 建立 Preflight and account isolation、Secret and state-file protection 與以 schema 驅動狀態檔支援續跑：新增 deploy/zeabur/preflight.sh、deploy/zeabur/state.schema.json、gitignore 規則與非秘密狀態範例，檢查 CLI、帳號、ZeaburOS/k3s、region、project、database 與禁止 secret fields；以 shell syntax、JSON parse、secret scan、git check-ignore 與錯誤 fixture 驗證。
- [x] 6.3 建立 Production service specification 的 install 與 add-service 文件：固定 verified OCI image、TCP 8080、DATABASE_URL reference、APP_URL/NEXT_PUBLIC_APP_URL、GIT_COMMIT_SHA、LOCAL_STORAGE_ROOT=/data/uploads、/data volume 與 dependency order 在正式服務第一次啟動前存在；以 template validation 與 exported service spec review 驗證。
- [x] 6.4 [P] 建立 runtime dependency closure 與 runtime dependency closure 與正式服務 promotion 驗收：解析 Dockerfile CMD、runtime scripts、Prisma assets 與 standalone runner imports，缺少 @prisma/adapter-pg、zod、dotenv、pg 或 script 時阻止 image promotion；以 fixture image manifest、container startup log 與 non-zero assertion 驗證。
- [x] 6.5 建立以可觀測 health gates 取代服務顯示 Running 的 Health gates and persistence verification：建立 deploy/zeabur/verify.sh 與 post-deploy checklist，分別檢查 migration、pod 1/1、in-container 8080、external HTTPS、/api/version SHA、/data mount、restart marker checksum 與五個核心 cron routes；以成功與各 gate 失敗 fixture 驗證固定 check summary。
- [x] 6.6 [P] 建立 Safe update and rollback 與 troubleshooting 文件：新 image 通過全部 gates 前保留舊 deployment、database、volume、domain 與 rollback IDs，並收錄 HasK3s=false、missing DATABASE_URL、runtime module、port、.git、domain、cron 401/403 與 optional provider-not-configured；以 simulated failure、resumeAction、retained-resources 與內容審查驗證。
- [x] 6.7 [P] 建立 Cron worker lifecycle 文件與安裝檢查：要求 systemd user service active、env file mode 600、正式 URL、相同 CRON_SECRET、五個核心 routes 2xx，並將 optional Cloudflare route 記為 non-blocking；以 systemd status、route status matrix 與 secret non-disclosure scan 驗證。
- [x] 6.8 更新 README.md、AGENTS.md、docs/ZEABUR-DEPLOYMENT-RUNBOOK.md 與 customer handoff 文件，使 GitHub Actions、customer bootstrap、平台 upgrade 與集中式 deployment package 互相連結且不重複矛盾；以 link check、內容 diff review、spectra analyze 與 spectra validate 驗證。
- [x] 6.9 固化客戶交付模式與 repository ownership 的已確認決策：文件與 workflow SHALL 使用客戶自有 Zeabur workspace、每客戶獨立 GitHub repository、main 預設 production branch、固定版本 Zeabur CLI、人工 upgrade confirmation 與非阻塞 optional providers；以 customer handoff checklist、workflow config review 與 spectra analyze 驗證沒有未解 Open Questions。
