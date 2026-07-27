# 單元測驗（Lesson Quiz）— BDD 規格

## 概述
讓老師在每個單元設定自動計分的測驗（單選 / 多選 / 是非 / 填空），學員作答後即時批改並顯示成績。測驗可作為學習驗收工具，亦可設定為通過後才能解鎖後續單元。

---

## 行為規格

### 場景 1：老師在後台為單元建立測驗
**Given** 老師已登入後台，正在編輯某單元的內容頁
**When**  老師點擊「測驗設定」區塊，填寫測驗基本設定（及格分數、時間限制、重考策略等），並新增至少一道題目
**Then**  系統儲存測驗設定與題目，該單元顯示「已設定測驗」標記

### 場景 2：老師新增各種題型
**Given** 老師正在編輯某單元的測驗
**When**  老師新增一道題目，選擇題型（單選 / 多選 / 是非 / 填空）
**Then**  系統根據題型顯示對應的編輯表單：
  - 單選題：題幹 + N 個選項 + 標記正確答案（1 個）
  - 多選題：題幹 + N 個選項 + 標記正確答案（≥1 個）
  - 是非題：題幹 + 正確 / 錯誤
  - 填空題：題幹 + 一或多個可接受答案（精確匹配，不分大小寫）

### 場景 3：老師設定測驗規則
**Given** 老師正在編輯測驗設定
**When**  老師調整以下選項：
  - 及格分數（0-100，預設 60）
  - 時間限制（分鐘，留空表示不限時）
  - 題目順序（固定 / 隨機）
  - 選項順序（固定 / 隨機）
  - 答案顯示策略（送出後立即 / 通過後 / 永不）
  - 是否阻擋後續單元（預設關閉）
**Then**  系統儲存設定並套用至學員端

### 場景 4：老師調整題目順序與分數權重
**Given** 測驗已有多道題目
**When**  老師拖拽題目調整順序，並為每道題目設定分數（預設每題等分）
**Then**  系統更新題目順序與分數配置

### 場景 5：老師刪除測驗
**Given** 某單元已設定測驗
**When**  老師點擊「刪除測驗」並確認
**Then**  系統刪除該測驗及所有題目，但保留學員已有的作答紀錄（歷史資料）

### 場景 6：學員開始作答測驗
**Given** 學員已購買課程並進入某單元播放頁
**When**  該單元設有測驗，學員點擊「開始測驗」
**Then**  系統顯示測驗介面，依設定決定是否隨機排列題目/選項；若有時間限制，顯示倒計時

### 場景 7：學員送出測驗答案
**Given** 學員已完成所有題目
**When**  學員點擊「送出答案」
**Then**  系統即時批改並顯示結果：
  - 總分、是否通過
  - 依「答案顯示策略」決定是否顯示每題的正確答案與解析
  - 建立一筆 QuizAttempt 紀錄

### 場景 8：限時測驗時間到
**Given** 學員正在作答限時測驗
**When**  倒計時歸零
**Then**  系統自動送出當前已作答的內容，未作答的題目計為 0 分

### 場景 9：學員重考測驗
**Given** 學員已有一次作答紀錄
**When**  學員點擊「重新測驗」
**Then**  系統建立新的作答紀錄，學員的最高分會自動更新

### 場景 10：測驗阻擋後續單元
**Given** 某單元的測驗設定為「未通過阻擋後續單元」
**When**  學員尚未通過該測驗，嘗試進入下一個單元
**Then**  系統顯示提示「請先通過前一單元的測驗」，無法觀看下一單元內容

### 場景 11：學員查看測驗歷史
**Given** 學員曾多次作答某測驗
**When**  學員在單元頁面查看測驗區塊
**Then**  系統顯示最高分數、作答次數、最近一次作答時間，以及是否已通過

### 場景 12：老師在後台查看測驗統計
**Given** 老師進入後台的單元測驗管理頁面
**When**  頁面載入
**Then**  系統顯示該測驗的統計資訊：作答人次、通過率、平均分數、每題答對率

---

## Acceptance Criteria

### 資料模型
- [ ] AC-01：Prisma schema 新增 `Quiz` model，關聯 `Lesson`（一對一），包含 `passingScore`、`timeLimitMinutes`、`shuffleQuestions`、`shuffleOptions`、`showAnswers`（enum: IMMEDIATELY / AFTER_PASS / NEVER）、`blockNextLesson` 欄位
- [ ] AC-02：Prisma schema 新增 `QuizQuestion` model，關聯 `Quiz`，包含 `type`（enum: SINGLE_CHOICE / MULTIPLE_CHOICE / TRUE_FALSE / FILL_IN_BLANK）、`content`（題幹 Text）、`options`（JSON，選項陣列）、`correctAnswer`（JSON）、`explanation`（解析 Text，選填）、`points`（分數）、`order`（排序）
- [ ] AC-03：Prisma schema 新增 `QuizAttempt` model，關聯 `Quiz` + `User`，包含 `answers`（JSON）、`score`（整數 0-100）、`passed`（Boolean）、`startedAt`、`submittedAt`、`timeTakenSeconds`
- [ ] AC-04：`Lesson` model 新增 `quiz` 關聯（optional one-to-one）

### 後台管理（老師端）
- [ ] AC-05：後台單元編輯頁面新增「測驗設定」Tab 或區塊，可建立 / 編輯 / 刪除測驗
- [ ] AC-06：測驗編輯介面支援新增 / 編輯 / 刪除 / 拖拽排序題目
- [ ] AC-07：每種題型（單選、多選、是非、填空）有對應的題目編輯表單
- [ ] AC-08：單選題 UI：顯示 N 個選項輸入框 + radio 標記正確答案，至少 2 個選項
- [ ] AC-09：多選題 UI：顯示 N 個選項輸入框 + checkbox 標記正確答案，至少 2 個選項，至少 1 個正確
- [ ] AC-10：是非題 UI：僅顯示「正確 / 錯誤」兩個選項
- [ ] AC-11：填空題 UI：顯示題幹輸入框 + 可接受答案列表（可新增多個）
- [ ] AC-12：測驗設定表單包含：及格分數（0-100 slider/input）、時間限制（分鐘，0=不限）、題目順序隨機、選項順序隨機、答案顯示策略（下拉）、阻擋後續單元（toggle）
- [ ] AC-13：後台課程大綱列表中，有測驗的單元顯示測驗圖標標記
- [ ] AC-14：後台可查看測驗統計：作答人次、通過率、平均分數

### 前台（學員端）
- [ ] AC-15：課程播放頁中，有測驗的單元在內容下方顯示測驗入口區塊
- [ ] AC-16：點擊「開始測驗」後顯示測驗介面，包含所有題目、作答表單
- [ ] AC-17：限時測驗顯示倒計時，時間到自動送出
- [ ] AC-18：送出答案後即時計算分數並顯示結果頁面
- [ ] AC-19：結果頁面依「答案顯示策略」決定是否展示正確答案
- [ ] AC-20：學員可重新測驗（無限次），每次建立新的 QuizAttempt
- [ ] AC-21：測驗區塊顯示學員的最高分、作答次數、是否通過
- [ ] AC-22：若測驗設定「阻擋後續單元」且未通過，學員無法進入下一單元，課程大綱中下一單元顯示鎖定狀態

### Server Actions & API
- [ ] AC-23：Server Action `createQuiz` / `updateQuiz` / `deleteQuiz` 在 `lib/actions/quiz.ts`，需 `requireAdminAuth()`，驗證 Zod schema，記錄 AdminLog
- [ ] AC-24：Server Action `createQuizQuestion` / `updateQuizQuestion` / `deleteQuizQuestion` / `reorderQuizQuestions`，需 `requireAdminAuth()`
- [ ] AC-25：Server Action `submitQuizAttempt`（前台），需登入 + 已購買課程驗證，自動計分並儲存
- [ ] AC-26：Server Action `getQuizForStudent`（前台），回傳題目但不包含正確答案
- [ ] AC-27：Server Action `getQuizAttempts`（前台），回傳學員自己的歷史作答紀錄
- [ ] AC-28：Server Action `getQuizStatistics`（後台），回傳統計資訊

### 安全與防護
- [ ] AC-29：前台取得測驗題目時，Response 不包含 `correctAnswer` 欄位（防止前端偷看答案）
- [ ] AC-30：送出答案時驗證學員有該課程的有效購買權限
- [ ] AC-31：限時測驗的時間驗證在伺服器端執行（`submittedAt - startedAt <= timeLimitMinutes + 容許值`）

### 驗證規則
- [ ] AC-32：`lib/validations/quiz.ts` 包含測驗設定、題目、作答的 Zod schema
- [ ] AC-33：題目至少 1 道才能儲存測驗；單選/多選至少 2 個選項；填空至少 1 個答案

---

## 排除範圍（Out of Scope）
- 簡答題（需老師批改的文字回答）
- 排序題、配對題、圖片選擇題
- AI 自動出題
- 題目中嵌入圖片或多媒體
- 題庫（跨測驗的題目共用池）
