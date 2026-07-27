# 課程評價系統增強 — BDD 規格

## 概述

在已有的課程評價基礎上（星等 + 文字評價），新增五項進階功能：按讚（有用/沒用）、老師回覆評價、舉報不當評價、排序演算法（最有用/最新/最高分/最低分）、評價列表分頁。同時全面更新 `create-landing-page` Skill 文檔，讓 AI Agent 理解如何正確使用評價元件和其他共用元件的真實資料串接方式。

## 行為規格

### 場景 1：用戶對評價按讚（有用）

**Given** 任何登入用戶瀏覽銷售頁的評價區塊
**When** 用戶點擊某則評價的「有用」按鈕
**Then** 該評價的有用計數 +1，按鈕變為已按讚狀態；再次點擊可取消

### 場景 2：未登入用戶無法按讚

**Given** 未登入用戶瀏覽銷售頁的評價區塊
**When** 用戶嘗試點擊「有用」按鈕
**Then** 不顯示按讚按鈕（或顯示但點擊後提示登入）

### 場景 3：老師在後台回覆評價

**Given** 老師在後台課程評價管理頁看到一則評價
**When** 老師在該評價下方輸入文字並點擊「回覆」
**Then** 回覆被儲存，前台銷售頁的該評價下方顯示「講師回覆」

### 場景 4：老師編輯已有回覆

**Given** 老師已對某則評價回覆過
**When** 老師在後台編輯回覆內容
**Then** 前台更新為新回覆內容

### 場景 5：用戶舉報不當評價

**Given** 登入用戶在銷售頁看到不當評價
**When** 用戶點擊該評價的舉報按鈕，選擇原因並送出
**Then** 系統記錄舉報，後台可看到被舉報的評價與舉報原因

### 場景 6：舉報不影響評價顯示

**Given** 某評價被舉報
**When** 用戶瀏覽銷售頁
**Then** 評價仍然顯示（除非老師手動隱藏）

### 場景 7：評價排序

**Given** 用戶在銷售頁瀏覽評價區塊
**When** 用戶選擇排序方式（最有用 / 最新 / 最高分 / 最低分）
**Then** 評價列表按選擇的方式重新排序

### 場景 8：預設排序為最有用

**Given** 用戶首次進入銷售頁評價區塊
**When** 評價列表載入
**Then** 預設按「最有用」排序（有用數最多的在前，相同時按最新排序）

### 場景 9：評價分頁

**Given** 課程有超過 10 則評價
**When** 用戶瀏覽銷售頁評價區塊
**Then** 首次載入顯示前 10 則，底部顯示「載入更多」按鈕

### 場景 10：載入更多評價

**Given** 評價區塊底部有「載入更多」按鈕
**When** 用戶點擊按鈕
**Then** 額外載入 10 則評價，追加到列表下方

### 場景 11：後台看到舉報提示

**Given** 某評價被 1 個以上用戶舉報
**When** 老師在後台評價管理頁查看
**Then** 該評價旁顯示舉報標記和舉報次數，可展開查看舉報原因

### 場景 12：Skill 文檔完整更新

**Given** AI Agent 讀取 `create-landing-page` Skill
**When** Agent 需要建立包含評價的銷售頁
**Then** Skill 文檔提供完整指引，包含：ReviewSection 元件使用方式、LandingPageProps 中評價相關欄位說明、模板範例

## Acceptance Criteria

### 資料層
- [ ] AC-01：Prisma schema 新增 `ReviewHelpful` model（userId + reviewId 複合唯一鍵），記錄用戶對評價的「有用」投票
- [ ] AC-02：`CourseReview` model 新增 `helpfulCount` Int 欄位（預設 0，冗餘計數以提升查詢效能）
- [ ] AC-03：`CourseReview` model 新增 `replyContent` String? 和 `replyAt` DateTime? 欄位（老師回覆）
- [ ] AC-04：Prisma schema 新增 `ReviewReport` model（userId + reviewId + reason + createdAt），記錄舉報

### 前台 Server Actions
- [ ] AC-05：新增 `toggleHelpful(reviewId)` — 切換有用/取消有用，更新 `helpfulCount` 冗餘欄位
- [ ] AC-06：新增 `reportReview(reviewId, reason)` — 建立舉報記錄，每人對同一評價只能舉報一次
- [ ] AC-07：更新 `getReviews(courseId, options)` — 支援排序（`helpful` / `newest` / `highest` / `lowest`）和分頁（`cursor` 或 `page` + `limit`）

### 後台 Server Actions
- [ ] AC-08：新增 `replyToReview(reviewId, content)` — 老師回覆評價
- [ ] AC-09：新增 `updateReplyToReview(reviewId, content)` — 編輯回覆
- [ ] AC-10：新增 `deleteReplyToReview(reviewId)` — 刪除回覆
- [ ] AC-11：更新 `getReviewsForAdmin` — 返回資料包含舉報數量

### 前台 UI
- [ ] AC-12：ReviewSection 評價卡片新增「有用」按鈕（ThumbsUp），顯示有用次數；已按讚用戶按鈕高亮
- [ ] AC-13：ReviewSection 評價卡片新增「舉報」按鈕（Flag），點擊彈出原因選擇（不當內容 / 垃圾訊息 / 與課程無關 / 其他），送出後按鈕變灰且不可再點
- [ ] AC-14：ReviewSection 新增排序下拉選單（最有用 / 最新 / 最高分 / 最低分），預設「最有用」
- [ ] AC-15：ReviewSection 分頁：初始載入 10 則，有更多時底部顯示「載入更多」按鈕
- [ ] AC-16：老師回覆在前台評價卡片下方顯示（「講師回覆」標籤 + 回覆內容 + 回覆時間）
- [ ] AC-17：`ReviewData` 型別更新，新增 `helpfulCount`, `isHelpful`（當前用戶是否按過有用）, `replyContent`, `replyAt`, `hasReported`（當前用戶是否已舉報）

### 後台 UI
- [ ] AC-18：後台評價管理頁每則評價新增「回覆」輸入區（Textarea + 送出按鈕），已有回覆可編輯/刪除
- [ ] AC-19：後台評價管理頁被舉報的評價顯示紅色警示標記和舉報次數，hover 或展開可看原因列表

### Zod 驗證
- [ ] AC-20：新增 `reportReviewSchema`（reason 為必填字串，最多 500 字）
- [ ] AC-21：新增 `replyToReviewSchema`（content 為必填字串，最多 2000 字）

### Skill 文檔
- [ ] AC-22：更新 SKILL.md — 共用元件速查表新增 `ReviewSection`、`ReviewModal`，說明 Props 和使用方式
- [ ] AC-23：更新 components.md — 新增 ReviewSection / ReviewModal 的完整 Props、行為、限制說明
- [ ] AC-24：更新 simple-template.md 和 funnel-template.md — 模板中加入 ReviewSection 使用範例，包含 Props 傳遞
- [ ] AC-25：SKILL.md / components.md 中說明如何串接真實資料（LandingPageProps 的評價欄位、價格相關欄位、倒數計時欄位的完整對應關係）

### Build
- [ ] AC-26：`next build` 成功通過，無 TypeScript 錯誤

## 排除範圍（Out of Scope）

- 舉報達到一定數量自動隱藏評價（首期由老師手動處理）
- 按讚的通知（不發通知給評價者）
- 老師回覆的通知（不發 Email 給學員）
- 舉報的 Email 通知管理員
