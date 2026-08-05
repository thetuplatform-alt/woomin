## Context

目前專案有 Spectra 工作流與 Zeabur skill lock，但部署知識分散在舊版 AGENTS、目前 runbook、Dockerfile 與人工排錯紀錄。這次部署暴露出主機未完成 ZeaburOS 初始化、專屬主機 project region、runtime dependency closure、build context 沒有可用 .git、build/runtime 變數差異、/data volume、domain ownership、cron secret 與 cleanup 等跨系統問題。

這個 change 的利害關係人是維護本專案的 AI agent、需要安裝或更新平台的工程師，以及負責確認網站可用性的產品負責人。部署包必須能在沒有本次對話上下文時交接執行，且不得暴露任何 secret。

## Goals / Non-Goals

**Goals:**

- 建立集中式 docs/deployment 作業包與明確的 AGENT.md。
- 定義 install、update、add-service、verify、rollback、troubleshooting 的固定順序、輸入、輸出與停止條件。
- 將 Zeabur 主機、資料庫、映像、runtime、volume、domain、cron、秘密與 cleanup 的可觀測驗收固化。
- 提供唯讀 preflight 與驗證腳本，讓流程在 destructive action 前先 fail closed。
- 保留可續跑的非秘密狀態欄位與資源識別資訊。

**Non-Goals:**

- 不在本 change 重新部署目前已存在的 Zeabur production resources。
- 不把任何 API key、資料庫密碼、CRON_SECRET 或第三方 token 提交到 repository。
- 不替 Cloudflare Stream、Email、金流、OAuth 或自有網域建立第三方帳號。
- 不修改課程、登入、訂閱或其他產品功能。

## Decisions

### 集中式作業包而非只擴充根目錄 AGENTS

docs/deployment/ 作為唯一完整作業包，根目錄 AGENTS.md 只保留入口與必遵守的摘要。這讓 AI agent 能從固定入口找到完整流程，也避免根目錄規則膨脹。

替代方案是只把內容追加到 AGENTS.md；這會讓安裝、更新、回滾與故障排除互相混雜，且不適合人員直接照表執行，因此不採用。

### 以可觀測 health gates 取代「服務顯示 Running」

每個流程都必須使用可重複的檢查：主機 ZeaburOS/k3s ready、database pod Running、app pod 1/1、runtime migration log、內部 8080、外部 HTTPS、版本 SHA、volume mount、restart persistence 與 cron routes。任一 gate 失敗時流程停止並保留診斷資源。

替代方案是只檢查 dashboard 狀態或 domain 是否存在；本次 502 證明這些訊號不足，因此不採用。

### 以 schema 驅動的部署狀態檔支援續跑

deploy/zeabur/state.schema.json 定義非秘密狀態欄位，包含 account、server、project、service IDs、domain、checks、failedStep、resumeAction 與 retained resources。狀態檔必須被 gitignore，且禁止保存 secret 值。

替代方案是依賴 shell history 或對話上下文；這無法安全交接或續跑，因此不採用。

### 把 runtime dependency closure 當成映像驗收項目

Dockerfile 變更後，作業包必須檢查啟動命令引用的每個 module、script、Prisma asset 都存在於 runner image。build 成功不能單獨視為可部署，runtime log 與 localhost check 必須通過。

替代方案是只執行 next build；這無法捕捉 @prisma/adapter-pg、zod 等啟動期缺件，因此不採用。

### 使用模板建立正式服務，暫時 carrier 只負責建置

正式服務的初始 specification 必須同時包含 image、TCP 8080 與 /data volume；暫時 build carrier 不得承擔正式 domain 或持久資料。健康 gates 通過後才刪除 carrier。

替代方案是直接把 CLI deploy service 當正式服務再補 volume；這會讓初始 spec 缺乏可驗證的持久化契約，因此不採用。

## Implementation Contract

### Behavior

- 執行安裝流程時，作業包 SHALL 先做唯讀 preflight，再依序處理主機、project、database、image、正式 app、volume、domain、cron 與驗收。
- 執行更新流程時，作業包 SHALL 在新 deployment 通過全部 health gates 前保留目前可用服務與 rollback 資訊。
- 執行增加服務流程時，作業包 SHALL 先檢查 region、dependencies、variables、ports、storage、secrets 與 cleanup owner，再建立服務。
- 任一不可恢復錯誤 SHALL 輸出 failedStep、reason、resource IDs、domain、retained resources 與 resumeAction，且 SHALL NOT 自動刪除付費或持久資源。

### Interface / data shape

- deploy/zeabur/state.schema.json SHALL 禁止出現 api_key、DATABASE_URL 實際值、password、token、secret 或 private key 欄位。
- deploy/zeabur/preflight.sh SHALL 只執行唯讀檢查，錯誤時回傳非零狀態。
- deploy/zeabur/verify.sh SHALL 接受非秘密的 project/service/domain 參數，並輸出固定欄位的 check summary；它 SHALL NOT 輸出 variable values。
- docs/deployment/AGENT.md SHALL 定義 agent 何時讀取 install/update/add-service/rollback/troubleshooting 文件，以及何時停止並要求使用者操作。

### Failure modes

- HasK3s=false、Provisioning 未 Ready、database 未 Running、missing runtime module、migration failure、port mismatch、missing DATABASE_URL、missing /data、version unknown 或 external non-2xx SHALL 阻止流程進入下一階段。
- 未設定的 optional provider（例如 Cloudflare Stream） SHALL 被標記為 non-blocking provider-not-configured；核心 homepage、auth、database、cron routes 仍必須通過。
- Domain unavailable、CLI account mismatch 或 browser authorization 未完成 SHALL 保留可用服務，不得刪除 server、database、volume 或 production app。

### Acceptance criteria

- 任何新 agent 只讀 docs/deployment/AGENT.md 即能找到完整安裝順序、更新順序、加服務規則與回滾入口。
- preflight、verify 與 state schema 通過 shell syntax、JSON schema／shape、secret scan 與 git diff --check。
- 文件中的每一個 health gate 都有明確命令、預期輸出與失敗處置。
- runbook 能明確記錄本次 502、k3s、runtime modules、.git、volume、domain、cron 與 account restore 問題。
- Spectra analyze 與 validate 無 Critical 或 Warning；tasks 覆蓋每個 design decision。

### Scope boundaries

本 change 只新增部署規範、狀態 schema、唯讀檢查／驗證腳本與 agent 文件。它不修改產品功能、不建立第三方帳號、不替使用者選擇自有網域／Email／金流，也不在 apply 階段自動租用新的付費主機。

## Risks / Trade-offs

- [文件與 CLI 版本漂移] → 每次安裝前記錄 CLI version，並在 troubleshooting 文件保留命令 fallback。
- [Provider optional failure 被誤判為成功] → 將核心 gates 與 optional provider gates 分開，provider-not-configured 必須顯式列出。
- [volume restart 造成短暫停機] → 文件要求在 maintenance window 執行 volume restart，並先驗證 marker checksum。
- [狀態檔意外保存秘密] → schema、pre-commit scan 與 verify script 都拒絕 secret key/value patterns。
