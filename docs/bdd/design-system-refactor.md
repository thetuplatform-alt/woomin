# Design System 重構 — BDD 規格

## 概述
將專案中 4,177 處硬編碼色碼收攏到 CSS 變數系統，讓買家購買原始碼後，只需修改 `globals.css` 裡的 ~20 個顏色變數即可完成品牌風格轉移，無需逐檔搜尋替換。

## 行為規格

### 場景 1：買家修改品牌主色
**Given** 買家在 `globals.css` 的 `:root` 中將 `--cta: #F5A524` 改為 `--cta: #3B82F6`
**When**  重新載入任何前台頁面（銷售頁、播放頁、結帳頁、登入頁）
**Then**  所有 CTA 按鈕、強調文字、連結色、hover 狀態都自動變為藍色，無需修改任何 .tsx 檔案

### 場景 2：買家修改文字色階
**Given** 買家在 `:root` 中修改 `--heading`、`--body`、`--caption` 三個變數
**When**  重新載入頁面
**Then**  標題、正文、副文本/placeholder 的顏色都跟著變動

### 場景 3：買家修改背景與邊框色
**Given** 買家在 `:root` 中修改 `--surface`、`--divider` 變數
**When**  重新載入頁面
**Then**  卡片背景、區塊背景、分隔線、表單邊框都使用新顏色

### 場景 4：Dark Mode 自動跟隨變數
**Given** 買家在 `.admin-dark` 中修改 `--heading`、`--body`、`--cta` 等變數
**When**  進入後台管理頁面（Dark Mode 環境）
**Then**  所有元件顏色都使用 dark mode 變數值，無需額外的屬性選擇器覆蓋

### 場景 5：Prose/Markdown 內容跟隨品牌色
**Given** 買家修改了 `:root` 中的 `--heading`、`--body`、`--cta` 變數
**When**  查看課程單元的 Markdown 內容（.prose 區塊）
**Then**  標題、正文、連結、引用塊邊框、行內代碼等都使用新的品牌色

### 場景 6：Milkdown 編輯器跟隨品牌色
**Given** 買家修改了品牌色變數
**When**  在後台使用 Milkdown Markdown 編輯器
**Then**  timestamp chip、hover 狀態、編輯器內容都使用新品牌色

### 場景 7：動畫效果跟隨品牌色
**Given** 買家修改了 `--primary` 和 `--accent` 變數
**When**  查看首頁的 vibe-indicator 脈衝動畫
**Then**  動畫的顏色和光暈使用新的 primary/accent 色

### 場景 8：第三方/裝飾色碼不受影響
**Given** 專案中存在 Google OAuth 按鈕的 SVG 色碼、Hero Animation 裡的 App Mockup 主題色
**When**  買家修改品牌色變數
**Then**  這些第三方/裝飾元素保持原有顏色不變（它們不是品牌色）

### 場景 9：玻璃效果跟隨變數
**Given** 買家修改了 `--glass-bg` 和 `--glass-border` 變數
**When**  查看使用 `.glass` 或 `.glass-strong` 的元件
**Then**  玻璃效果使用新的透明度和顏色

### 場景 10：功能完整性不受影響
**Given** 完成所有色碼替換後
**When**  執行 `pnpm build`
**Then**  專案成功建置，零錯誤

## Acceptance Criteria

### CSS 變數系統
- [ ] AC-01：`globals.css` 的 `:root` 中定義以下語意化變數：`--heading`、`--body`、`--caption`、`--surface`、`--surface-hover`、`--divider`、`--cta`、`--cta-hover`、`--cta-foreground`
- [ ] AC-02：`globals.css` 的 `.admin-dark` 中為上述所有新增變數定義深色模式值
- [ ] AC-03：`@theme inline` 區塊中為所有新增變數註冊對應的 Tailwind 色彩（`--color-heading`、`--color-body` 等）

### 硬編碼色碼替換
- [ ] AC-04：所有 .tsx 檔案中的 `text-[#0A0A0A]` 替換為 `text-heading`
- [ ] AC-05：所有 .tsx 檔案中的 `text-[#525252]` 替換為 `text-body`
- [ ] AC-06：所有 .tsx 檔案中的 `text-[#A3A3A3]` 替換為 `text-caption`
- [ ] AC-07：所有 .tsx 檔案中的 `bg-[#FAFAFA]` 替換為 `bg-surface`
- [ ] AC-08：所有 .tsx 檔案中的 `bg-[#F5F5F5]` 替換為 `bg-surface-hover`
- [ ] AC-09：所有 .tsx 檔案中的 `border-[#E5E5E5]` 替換為 `border-divider`
- [ ] AC-10：所有 .tsx 檔案中的 `bg-[#F5A524]` 替換為 `bg-cta`
- [ ] AC-11：所有 .tsx 檔案中的 `text-[#F5A524]` 替換為 `text-cta`
- [ ] AC-12：所有 .tsx 檔案中的 `hover:bg-[#E09000]` 替換為 `hover:bg-cta-hover`
- [ ] AC-13：所有 .tsx 檔案中的 `focus:border-[#F5A524]` 替換為 `focus:border-cta`
- [ ] AC-14：所有 .tsx 檔案中的 `focus-visible:ring-[#F5A524]` 替換為 `focus-visible:ring-cta`
- [ ] AC-15：所有 .tsx 檔案中的 `placeholder:text-[#A3A3A3]` 替換為 `placeholder:text-caption`
- [ ] AC-16：所有 .tsx 檔案中的 `bg-[#F8FAFC]` 替換為 `bg-background`
- [ ] AC-17：所有 .tsx 檔案中的 `hover:bg-[#FAFAFA]` 替換為 `hover:bg-surface`
- [ ] AC-18：所有 .tsx 檔案中的 `hover:bg-[#F5F5F5]` 替換為 `hover:bg-surface-hover`
- [ ] AC-19：所有 .tsx 檔案中的 `hover:bg-[#EAEAEA]` 替換為 `hover:bg-surface-hover`
- [ ] AC-20：所有 .tsx 檔案中的 `fill-[#F5A524]` 替換為 `fill-cta`
- [ ] AC-21：所有 .tsx 檔案中的 `decoration-[#F5A524]` 替換為 `decoration-cta`
- [ ] AC-22：所有 .tsx 檔案中的 `divide-[#E5E5E5]` 替換為 `divide-divider`
- [ ] AC-23：所有 .tsx 檔案中的 `ring-[#F5A524]` 替換為 `ring-cta`
- [ ] AC-24：所有 .tsx 檔案中的 `border-[#F5A524]` 替換為 `border-cta`
- [ ] AC-25：所有 .tsx 檔案中的 `hover:border-[#F5A524]` 替換為 `hover:border-cta`
- [ ] AC-26：所有 .tsx 檔案中的 `text-[#737373]` 替換為 `text-caption`（語意相同）
- [ ] AC-27：所有 .tsx 檔案中的 `bg-[#0A0A0A]` 替換為 `bg-heading`
- [ ] AC-28：所有 .tsx 檔案中的 `text-[#E09000]` 替換為 `text-cta-hover`（若存在）
- [ ] AC-29：所有含 `[#F5A524]` 的 opacity 變體（如 `bg-[#F5A524]/5`、`border-[#F5A524]/30`、`text-[#F5A524]/80`）替換為對應的 `bg-cta/5`、`border-cta/30`、`text-cta/80`

### Dark Mode 清理
- [ ] AC-30：刪除 `globals.css` 中 `.admin-dark [class*="..."]` 屬性選擇器覆蓋規則（原第 156-301 行區域），改由新增的 CSS 變數在 `.admin-dark` 中重新定義值來實現

### Prose 樣式
- [ ] AC-31：`.prose` 樣式中所有硬編碼色碼（`#0A0A0A`、`#525252`、`#F5A524`、`#E5E5E5`、`#FAFAFA`、`#F5F5F5`、`#A3A3A3`）替換為對應的 `var(--heading)`、`var(--body)` 等 CSS 變數

### Milkdown 樣式
- [ ] AC-32：`.milkdown-timestamp-chip` 及其 hover/dark 樣式中的硬編碼色碼替換為 CSS 變數

### 動畫
- [ ] AC-33：`@keyframes vibe-pulse` 中的 `#6366F1` 和 `#10B981` 替換為 `var(--primary)` 和 `var(--accent)`

### 命名清理
- [ ] AC-34：`--vf-highlight` 變數移除或合併到 `--cta`（功能重複）
- [ ] AC-35：`--vf-glass-bg` 重命名為 `--glass-bg`，`--vf-glass-border` 重命名為 `--glass-border`
- [ ] AC-36：移除 `/* VibeFlow Design System */` 等品牌特定註解

### Glass 效果
- [ ] AC-37：`.glass-strong` 中的硬編碼 `rgba(255, 255, 255, 0.85)` 和 `rgba(255, 255, 255, 0.4)` 替換為 CSS 變數

### 建置驗證
- [ ] AC-38：`pnpm build` 成功通過，零錯誤

## 排除範圍（Out of Scope）
- Hero Animation App Mockups 的裝飾色碼（stock-tracker、cafe-map、project-board 等）— 這些是展示用的獨立主題色
- Google OAuth 按鈕的 SVG 色碼（#4285F4、#34A853 等）— 第三方品牌色
- shiny-text.tsx、star-border.tsx 等動畫元件的預設色 — 裝飾效果
- test-course.tsx 銷售頁的深色漸變背景 — 個別課程的客製設計
- Recharts 圖表庫的內建色碼 — 已由 CSS 變數控制
- shadcn/ui 元件（components/ui/）— 已正確使用語意化 class
- Alert 狀態色（amber、red、green、blue 系列）— 功能語意色，非品牌色
