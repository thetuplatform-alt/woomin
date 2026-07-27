# 課程評價系統 — BDD 規格

## 概述

為課程平台新增「課程評價」功能，讓已購買的學員可以對課程給予 1-5 星評分及文字心得。評價資料可在銷售頁展示（由老師控制），幫助潛在學員做購買決策。此功能與現有的「單元留言」（LessonComment）定位不同：留言是單元級的學習討論，評價是課程級的整體回饋。

## 行為規格

### 場景 1：學員在銷售頁撰寫評價

**Given** 學員已登入且已購買該課程，尚未撰寫過評價
**When** 學員在課程銷售頁點擊「撰寫評價」按鈕
**Then** 系統彈出評價 Modal，包含 1-5 星評分元件（必填）和文字輸入框（選填），學員送出後評價被儲存

### 場景 2：學員在「我的課程」頁撰寫評價

**Given** 學員已登入且已購買該課程，尚未撰寫過評價
**When** 學員在「我的課程」頁面的課程卡片上點擊「給予評價」按鈕
**Then** 系統彈出相同的評價 Modal，學員可送出評價

### 場景 3：完課後提示撰寫評價

**Given** 學員完成課程的最後一個單元（進度 100%）
**When** 完課 Modal 顯示時
**Then** Modal 中出現「撰寫評價」按鈕，點擊後開啟評價 Modal

### 場景 4：學員編輯已提交的評價

**Given** 學員已對某課程提交過評價
**When** 學員在「我的課程」頁面點擊「編輯評價」按鈕
**Then** 評價 Modal 帶入現有的評分和文字，學員修改後可重新送出

### 場景 5：學員在銷售頁看到已有評價則顯示編輯

**Given** 學員已對某課程提交過評價，且該課程銷售頁開啟了評價顯示
**When** 學員瀏覽該課程銷售頁
**Then** 評價區塊中自己的評價被標示，CTA 按鈕顯示為「編輯評價」而非「撰寫評價」

### 場景 6：未購買用戶看不到評價入口

**Given** 用戶未購買該課程（或未登入）
**When** 用戶瀏覽課程銷售頁
**Then** 用戶可看到其他學員的評價列表和平均分，但看不到「撰寫評價」按鈕

### 場景 7：銷售頁評價區塊顯示

**Given** 課程已有學員評價，且老師啟用了「顯示評價」設定
**When** 任何用戶瀏覽該課程銷售頁
**Then** 銷售頁顯示評價區塊，包含：平均評分、評價數量、學員評價列表（姓名、星等、文字、日期）

### 場景 8：老師關閉評價顯示

**Given** 老師在後台將某課程的「顯示評價」設定為關閉
**When** 用戶瀏覽該課程銷售頁
**Then** 銷售頁不顯示評價區塊

### 場景 9：老師在後台管理評價

**Given** 老師進入課程編輯頁的「評價」Tab
**When** 頁面載入
**Then** 顯示：(1) 評價統計卡片（平均分、評價數、星等分佈）、(2) 顯示設定開關、(3) 所有評價列表（含篩選和隱藏/顯示操作）

### 場景 10：老師隱藏特定評價

**Given** 老師在評價 Tab 看到某則評價
**When** 老師點擊該評價的「隱藏」按鈕
**Then** 該評價在銷售頁不再顯示，但後台仍可看到（標記為已隱藏）

### 場景 11：每人每課程只能一則評價

**Given** 學員已對某課程提交過評價
**When** 學員嘗試再次提交新評價
**Then** 系統拒絕，學員只能透過「編輯」修改現有評價

### 場景 12：評分為必填，文字為選填

**Given** 學員開啟評價 Modal
**When** 學員未選擇星等就嘗試送出
**Then** 系統顯示錯誤提示，要求選擇評分

**When** 學員選擇星等但不填文字就送出
**Then** 評價成功儲存（文字為空）

### 場景 13：預設銷售頁自動整合評價區塊

**Given** 課程使用預設銷售頁（default.tsx）且 `showReviews` 為 true
**When** 用戶瀏覽銷售頁
**Then** 預設銷售頁自動在適當位置（底部 CTA 前）渲染評價區塊

### 場景 14：Course Schema 中 ratingValue/ratingCount 與真實評價同步

**Given** 課程的 `showReviews` 為 true
**When** 學員提交或編輯評價
**Then** Course 的 `ratingValue` 和 `ratingCount` 欄位自動更新為真實計算值，供 JSON-LD 結構化資料使用

## Acceptance Criteria

- [ ] AC-01：Prisma schema 新增 `CourseReview` model，包含 `id`, `courseId`, `userId`, `rating`(Int, 1-5), `content`(可 null), `isVisible`(預設 true), `createdAt`, `updatedAt`，且有 `@@unique([userId, courseId])` 約束
- [ ] AC-02：Course model 新增 `showReviews` Boolean 欄位（預設 false，需老師手動開啟）和 `reviews` relation
- [ ] AC-03：User model 新增 `reviews` relation
- [ ] AC-04：新增 `ReviewModal` 前台元件（Dialog），包含星等評分元件（1-5 星，必填）和文字輸入框（選填，最多 2000 字）
- [ ] AC-05：新增 Server Actions — `createReview`（需驗證購買）、`updateReview`（需驗證購買）、`getUserReview`（需驗證登入）、`getReviews`（公開讀取）、`getReviewStats`（公開讀取）
- [ ] AC-06：`createReview` 檢查用戶是否已有評價，若有則拒絕並回傳錯誤
- [ ] AC-07：課程銷售頁（`app/(main)/courses/[slug]/page.tsx`）傳遞評價相關資料（`reviewStats`, `userReview`）給銷售頁元件
- [ ] AC-08：新增 `ReviewSection` 銷售頁共用元件，顯示平均評分、評價數量、評價列表；當 `course.showReviews` 為 false 時不渲染
- [ ] AC-09：銷售頁中，已購買且未評價的學員看到「撰寫評價」按鈕；已評價的學員看到「編輯評價」按鈕；未購買用戶看不到評價按鈕
- [ ] AC-10：`LandingPageProps`（types.ts）新增評價相關欄位（`reviewStats`, `userReview`）
- [ ] AC-11：預設銷售頁 `default.tsx` 在底部 CTA 前自動渲染 `ReviewSection`
- [ ] AC-12：「我的課程」的 `MyCourseCard` 新增評價按鈕：未評價顯示「給予評價」，已評價顯示已評分星等 + 「編輯評價」
- [ ] AC-13：`LessonCompleteModal` 在課程進度 100% 時額外顯示「撰寫評價」按鈕（若尚未評價）
- [ ] AC-14：課程編輯頁 `TabHeader` 新增第 6 個「評價」Tab，路由為 `/admin/courses/[id]/reviews`
- [ ] AC-15：後台評價頁面包含：統計卡片（平均分、數量、星等分佈圖）、`showReviews` 開關、評價列表（支援按星等篩選、隱藏/顯示操作）
- [ ] AC-16：後台新增 Server Actions — `getReviewsForAdmin`, `toggleReviewVisibility`, `updateShowReviews`
- [ ] AC-17：隱藏的評價（`isVisible: false`）不出現在前台銷售頁，但後台仍可見並標示為「已隱藏」
- [ ] AC-18：提交或編輯評價後，若 `showReviews` 為 true，自動更新 Course 的 `ratingValue` 和 `ratingCount` 欄位
- [ ] AC-19：Zod 驗證 schema — rating 為 1-5 的整數，content 最多 2000 字元（可為空字串或 null）
- [ ] AC-20：`pnpm build` 成功通過，無 TypeScript 錯誤

## 排除範圍（Out of Scope）

- 評價的「按讚」或「有幫助」功能
- 老師回覆評價的功能
- 評價的舉報/檢舉功能
- 評價的排序演算法（預設按時間倒序）
- 評價的分頁載入（首期全部載入，量大後再加分頁）
- 更新 `create-landing-page` Skill 的文檔（後續獨立處理）
