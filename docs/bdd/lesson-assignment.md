# 單元作業（Lesson Assignment）— BDD 規格

## 概述
讓老師在每個單元建立作業，學員提交文字（Markdown）、圖片、檔案或混合內容，由老師批改並給予評分與回饋。作業系統支援草稿自動儲存、多次重交、多種評分制度，以及完整的儲存容量防護機制。

---

## 行為規格

### A. 老師端 — 建立與管理作業

#### 場景 A1：老師為單元建立作業
**Given** 老師已登入後台，正在編輯某單元
**When**  老師點擊「作業設定」區塊，填寫作業標題、說明、提交類型、字數限制等設定
**Then**  系統儲存作業設定，該單元顯示「已設定作業」標記

#### 場景 A2：老師設定作業提交類型
**Given** 老師正在建立作業
**When**  老師選擇提交類型（文字 / 圖片 / 檔案 / 混合）
**Then**  系統依提交類型顯示對應的限制設定：
  - 文字：編輯器模式（純文字 / Markdown）、最少字數、最多字數
  - 圖片：最大張數（上限 10）、單張大小上限（10MB）
  - 檔案：最大檔案數（上限 5）、單檔大小上限（20MB）、允許的副檔名（可從白名單選取或自訂）
  - 混合：以上設定皆可調整

#### 場景 A3：老師設定評分制度
**Given** 老師正在建立作業
**When**  老師選擇評分制度
**Then**  系統提供三種選項：
  - 通過制：通過 / 退回重交 / 不通過
  - 百分制：0-100 分 + 可設定及格分數
  - 等第制：A / B / C / D / F

#### 場景 A4：老師自訂允許的副檔名
**Given** 老師正在設定檔案類型作業
**When**  老師在「允許的副檔名」欄位新增自訂副檔名（如 `.psd`、`.fig`）
**Then**  系統將自訂副檔名加入白名單，學員上傳時會驗證

#### 場景 A5：老師設定截止日期與遲交規則
**Given** 老師正在建立作業
**When**  老師設定截止日期、是否允許遲交
**Then**  學員在截止日後將無法提交（若不允許遲交）或顯示遲交標記（若允許）

#### 場景 A6：老師刪除作業
**Given** 某單元已設定作業
**When**  老師點擊「刪除作業」並確認
**Then**  系統刪除作業定義與相關草稿，但保留已送出的提交紀錄（歷史資料），關聯的附件檔案一併刪除

### B. 學員端 — 提交作業

#### 場景 B1：學員查看作業要求
**Given** 學員已購買課程並進入某單元播放頁
**When**  該單元設有作業
**Then**  在內容下方顯示作業區塊，包含：作業標題、說明、提交類型、字數/檔案限制、截止日期、評分制度

#### 場景 B2：學員撰寫文字作業
**Given** 學員點擊「開始寫作業」
**When**  學員使用 Markdown 編輯器撰寫內容
**Then**  系統顯示即時字數統計，並依最少/最多字數限制顯示提示；編輯器底部顯示「自動儲存中」狀態

#### 場景 B3：草稿自動儲存（Client 端）
**Given** 學員正在撰寫文字作業
**When**  學員輸入文字後暫停 1 秒以上
**Then**  系統將當前內容存入 localStorage（key: `assignment-draft-{userId}-{assignmentId}`）

#### 場景 B4：草稿自動儲存（Server 端）
**Given** 學員正在撰寫作業
**When**  學員輸入文字後暫停 10 秒以上
**Then**  系統呼叫 Server 儲存草稿至資料庫，學員可在其他裝置繼續撰寫

#### 場景 B5：還原草稿
**Given** 學員之前有未送出的草稿
**When**  學員重新打開該作業頁面
**Then**  系統偵測到草稿並提示「偵測到未送出的草稿，是否還原？」，確認後載入草稿內容

#### 場景 B6：學員上傳圖片
**Given** 作業允許上傳圖片
**When**  學員選擇圖片檔案
**Then**  系統在客戶端預壓縮（長邊 ≤ 2000px、檔案 ≤ 2MB），上傳至儲存後端（local / S3），顯示預覽縮圖

#### 場景 B7：學員上傳檔案
**Given** 作業允許上傳檔案
**When**  學員選擇檔案
**Then**  系統驗證副檔名白名單與大小限制，通過後上傳至儲存後端，顯示檔名與大小

#### 場景 B8：上傳被拒絕（容量不足）
**Given** 本地儲存剩餘空間 < 1GB，或學員已超過單課程 200MB 配額，或全站已超過儲存配額
**When**  學員嘗試上傳檔案
**Then**  系統拒絕上傳並顯示明確的錯誤訊息（「儲存空間不足」或「您的上傳額度已滿」）

#### 場景 B9：上傳被拒絕（檔案不合規）
**Given** 學員選擇了不在白名單內的檔案類型或超過大小限制的檔案
**When**  學員嘗試上傳
**Then**  系統在客戶端即時攔截並顯示錯誤訊息，不發送請求到伺服器

#### 場景 B10：學員送出作業
**Given** 學員已完成作業（文字達到最少字數 / 檔案已上傳）
**When**  學員點擊「送出作業」
**Then**  系統顯示確認 Modal（預覽內容 + 告知是否可修改），確認後將狀態從 DRAFT 改為 SUBMITTED，清除草稿

#### 場景 B11：學員查看已送出作業的狀態
**Given** 學員已送出作業
**When**  學員回到該單元的作業區塊
**Then**  系統顯示：提交內容（唯讀）、目前狀態（SUBMITTED / UNDER_REVIEW / APPROVED / NEEDS_REVISION / REJECTED）、老師的評語（若有）

#### 場景 B12：學員重新提交（退回修改）
**Given** 作業狀態為 NEEDS_REVISION 且作業設定允許重新提交
**When**  學員修改內容後再次送出
**Then**  系統建立新版本紀錄（revisionNumber +1），狀態回到 SUBMITTED

### C. 老師端 — 批改作業

#### 場景 C1：老師查看待批改作業列表
**Given** 老師進入後台的作業管理頁面
**When**  頁面載入
**Then**  系統顯示所有待批改作業（SUBMITTED 狀態），按送出時間排序，顯示學員名稱、課程/單元名稱、送出時間

#### 場景 C2：老師批改單份作業
**Given** 老師點擊某份作業進入批改頁面
**When**  老師查看學員提交的內容（文字/圖片/檔案）
**Then**  系統顯示完整的提交內容，以及評分與評語表單

#### 場景 C3：老師給予評分與評語
**Given** 老師在批改頁面
**When**  老師填寫評語、選擇評分（依評分制度不同）、選擇結果（通過/退回/不通過）
**Then**  系統更新提交狀態，並發送 Email 通知學員

#### 場景 C4：老師退回作業要求修改
**Given** 老師認為作業需要修改
**When**  老師選擇「退回修改」並填寫修改建議
**Then**  系統將狀態更新為 NEEDS_REVISION，發送 Email 通知學員

#### 場景 C5：老師查看作業統計
**Given** 老師進入某課程的作業管理頁面
**When**  頁面載入
**Then**  系統顯示：總提交數、待批改數、已通過數、退回數、平均分數

### D. 儲存容量管理

#### 場景 D1：後台查看儲存容量
**Given** 管理員進入後台系統設定
**When**  管理員查看儲存設定區塊
**Then**  系統顯示：目前總用量、配額上限、各課程作業附件用量佔比

#### 場景 D2：全站配額告警
**Given** 全站作業附件用量達到配額的 80%
**When**  管理員進入後台
**Then**  系統在儲存設定頁面顯示黃色告警

#### 場景 D3：自動清理機制
**Given** 管理員設定「作業通過 N 天後自動刪除附件」
**When**  某份作業通過後超過 N 天
**Then**  系統自動刪除該份作業的附件檔案，保留文字內容與批改紀錄

### E. Email 通知

#### 場景 E1：作業批改完成通知
**Given** 老師批改完一份作業（通過或不通過）
**When**  批改結果儲存成功
**Then**  系統發送 Email 給學員，包含：課程名稱、單元名稱、評分結果、評語摘要、前往查看的連結

#### 場景 E2：作業退回修改通知
**Given** 老師退回作業要求修改
**When**  退回結果儲存成功
**Then**  系統發送 Email 給學員，包含：修改建議、重新提交的連結

---

## Acceptance Criteria

### 資料模型
- [ ] AC-01：Prisma schema 新增 `Assignment` model，關聯 `Lesson`（一對一），包含 `title`、`description`（Text）、`submissionType`（enum: TEXT / IMAGE / FILE / MIXED）、`editorMode`（enum: PLAIN / MARKDOWN）、`minWords`（Int?）、`maxWords`（Int?）、`maxFiles`（Int?）、`maxFileSize`（Int?，bytes）、`maxImages`（Int?）、`maxImageSize`（Int?，bytes）、`allowedExtensions`（JSON，字串陣列）、`gradingType`（enum: PASS_FAIL / PERCENTAGE / LETTER_GRADE）、`passingScore`（Int?）、`deadline`（DateTime?）、`allowLateSubmission`（Boolean）、`allowResubmission`（Boolean，預設 true）、`autoCleanupDays`（Int?）
- [ ] AC-02：Prisma schema 新增 `AssignmentSubmission` model，關聯 `Assignment` + `User`，包含 `content`（Text?，文字內容）、`contentFormat`（enum: PLAIN / MARKDOWN）、`wordCount`（Int?）、`status`（enum: DRAFT / SUBMITTED / UNDER_REVIEW / APPROVED / NEEDS_REVISION / REJECTED）、`revisionNumber`（Int，預設 1）、`submittedAt`（DateTime?）、`isLate`（Boolean，預設 false）
- [ ] AC-03：Prisma schema 新增 `AssignmentAttachment` model，關聯 `AssignmentSubmission`，包含 `filename`、`mimeType`、`size`（Int，bytes）、`url`、`storageKey`、`storageDriver`（local / s3）、`type`（enum: IMAGE / FILE）
- [ ] AC-04：Prisma schema 新增 `AssignmentReview` model，關聯 `AssignmentSubmission` + 批改者 `User`，包含 `status`（enum: APPROVED / NEEDS_REVISION / REJECTED）、`feedback`（Text?，整體評語）、`score`（Int?，百分制 0-100）、`letterGrade`（String?，等第）、`reviewedAt`（DateTime）
- [ ] AC-05：Prisma schema 新增 `AssignmentDraft` model，關聯 `Assignment` + `User`，包含 `content`（Text?）、`contentFormat`（enum）、`updatedAt`，用於 server 端草稿儲存
- [ ] AC-06：`Lesson` model 新增 `assignment` 關聯（optional one-to-one）

### 後台管理 — 作業建立
- [ ] AC-07：後台單元編輯頁面新增「作業設定」Tab 或區塊，可建立 / 編輯 / 刪除作業
- [ ] AC-08：作業編輯表單包含：標題、說明（Markdown 編輯器）、提交類型選擇
- [ ] AC-09：選擇「文字」提交類型時，顯示：編輯器模式選擇、最少/最多字數輸入
- [ ] AC-10：選擇「圖片」提交類型時，顯示：最大張數（1-10）、單張大小上限
- [ ] AC-11：選擇「檔案」提交類型時，顯示：最大檔案數（1-5）、單檔大小上限、允許的副檔名（多選 + 自訂輸入）
- [ ] AC-12：選擇「混合」提交類型時，同時顯示文字、圖片、檔案的所有設定
- [ ] AC-13：評分制度選擇器：通過制 / 百分制（+ 及格分數）/ 等第制
- [ ] AC-14：截止日期選擇器（日期時間）+ 允許遲交 toggle
- [ ] AC-15：允許重新提交 toggle（預設開啟）
- [ ] AC-16：自動清理天數設定（選填，作業通過後 N 天刪除附件）
- [ ] AC-17：後台課程大綱列表中，有作業的單元顯示作業圖標標記

### 後台管理 — 批改
- [ ] AC-18：後台新增「作業管理」頁面（`/admin/courses/[id]/assignments`），列出該課程所有作業的提交
- [ ] AC-19：作業提交列表可按狀態篩選（全部 / 待批改 / 已通過 / 退回 / 不通過）
- [ ] AC-20：點擊某份提交進入批改頁面，可查看學員的文字內容（Markdown 渲染）、圖片（可放大）、檔案（可下載）
- [ ] AC-21：批改表單包含：評語（Markdown 編輯器）、評分（依評分制度不同）、結果按鈕（通過 / 退回 / 不通過）
- [ ] AC-22：批改結果儲存後自動發送 Email 通知學員
- [ ] AC-23：作業統計區塊：總提交數、待批改數、已通過數、退回數、平均分數（百分制時）

### 前台 — 學員端
- [ ] AC-24：課程播放頁的單元內容下方顯示作業區塊（若有設定作業）
- [ ] AC-25：作業區塊顯示：標題、說明、提交類型、限制條件、截止日期、目前狀態
- [ ] AC-26：學員點擊「開始寫作業」後顯示提交表單
- [ ] AC-27：文字提交：Markdown 編輯器（複用 Milkdown）+ 即時字數統計 + 字數限制驗證
- [ ] AC-28：圖片上傳：客戶端預壓縮（長邊 ≤ 2000px、≤ 2MB）、預覽縮圖、數量限制驗證
- [ ] AC-29：檔案上傳：副檔名白名單驗證（客戶端即時攔截）、大小限制驗證、顯示檔名與大小
- [ ] AC-30：混合模式：同一表單同時支援文字 + 圖片 + 檔案
- [ ] AC-31：自動草稿（Client）：debounce 1 秒後存入 localStorage
- [ ] AC-32：自動草稿（Server）：debounce 10 秒後存入 AssignmentDraft
- [ ] AC-33：還原草稿：打開頁面時偵測 localStorage 或 server 草稿，提示還原
- [ ] AC-34：送出前確認 Modal：預覽內容 + 顯示「送出後可/不可修改」
- [ ] AC-35：送出後顯示唯讀的提交內容與狀態
- [ ] AC-36：狀態為 NEEDS_REVISION 時顯示老師評語 + 「重新提交」按鈕
- [ ] AC-37：作業區塊顯示完整狀態：目前版本、送出時間、批改結果、評語

### Server Actions & API
- [ ] AC-38：`lib/actions/assignment.ts` — `createAssignment` / `updateAssignment` / `deleteAssignment`，需 `requireAdminAuth()`，Zod 驗證，AdminLog
- [ ] AC-39：`lib/actions/assignment.ts` — `getAssignmentSubmissions`（後台），列出某作業的所有提交
- [ ] AC-40：`lib/actions/assignment.ts` — `reviewSubmission`（後台），更新批改結果 + 發送 Email
- [ ] AC-41：`lib/actions/assignment-student.ts` — `getAssignmentForStudent`（前台），回傳作業要求與學員自己的提交
- [ ] AC-42：`lib/actions/assignment-student.ts` — `saveAssignmentDraft`（前台），server 端草稿儲存
- [ ] AC-43：`lib/actions/assignment-student.ts` — `submitAssignment`（前台），送出作業，需登入 + 已購買驗證
- [ ] AC-44：`lib/actions/assignment-student.ts` — `resubmitAssignment`（前台），重新提交（NEEDS_REVISION → SUBMITTED）
- [ ] AC-45：`/api/assignment/upload` — 作業附件上傳 API Route，需登入 + 已購買 + 容量檢查 + 副檔名驗證

### 儲存容量防護
- [ ] AC-46：上傳前預檢本地儲存剩餘空間（local driver 時），< 1GB 拒絕上傳
- [ ] AC-47：`SETTING_KEYS` 新增 `ASSIGNMENT_STORAGE_QUOTA_GB`（預設 10），全站配額檢查
- [ ] AC-48：單用戶單課程作業附件總量上限 200MB，超過拒絕上傳
- [ ] AC-49：後台儲存設定頁面顯示：目前作業附件總用量、配額、用量佔比
- [ ] AC-50：配額達 80% 時在後台顯示黃色告警
- [ ] AC-51：自動清理機制：定期檢查已通過且超過 `autoCleanupDays` 的作業，刪除附件保留文字

### 安全與防護
- [ ] AC-52：上傳的附件副檔名在伺服器端再次驗證（不信任客戶端）
- [ ] AC-53：文字內容渲染時使用 DOMPurify 過濾 XSS
- [ ] AC-54：草稿儲存 API 加上 rate limiting（每分鐘 30 次）
- [ ] AC-55：作業送出 API 加上 rate limiting（每小時 10 次）
- [ ] AC-56：學員只能讀寫自己的作業提交，無法存取他人提交
- [ ] AC-57：禁止上傳可執行檔（.exe/.bat/.sh/.app/.dmg/.msi 等）

### Email 通知
- [ ] AC-58：新增「作業批改完成」Email 模板，包含課程名稱、單元名稱、結果、評語、連結
- [ ] AC-59：新增「作業退回修改」Email 模板，包含修改建議、重新提交連結
- [ ] AC-60：批改結果儲存時自動觸發對應 Email

### 驗證規則
- [ ] AC-61：`lib/validations/assignment.ts` 包含作業設定、提交、批改的 Zod schema
- [ ] AC-62：文字作業送出時驗證字數是否在 minWords ~ maxWords 範圍內
- [ ] AC-63：圖片數量不超過 maxImages，單張不超過 maxImageSize
- [ ] AC-64：檔案數量不超過 maxFiles，單檔不超過 maxFileSize，副檔名在白名單內

---

## 排除範圍（Out of Scope）
- 行內註解（在學員文字段落加評論，Phase 2）
- 提交歷史版本比對 diff（Phase 2）
- 同儕互評（Phase 2）
- 抄襲 / AI 代寫偵測（Phase 2）
- 作業批量匯出（CSV/PDF，Phase 2）
