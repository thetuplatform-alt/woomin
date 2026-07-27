# 後台新手教學(Guided Tour)設計與實作文件

> 後台「新手教學」功能的設計文件與索引。框架已實作上線(`components/tour/` + `lib/tours/`),涵蓋下列 **25** 個頁面,每頁首訪自動播一次、右上角問號可隨時重看。

## 系統架構

先讀 [00-overview.md](00-overview.md) — 整體運作(問號鈕、常駐提示、狀態記錄、可中斷、每頁獨立 tour、技術選型)+ 跨頁總覽 + 待決策清單。

## 課程編輯區教學(/admin/courses/...)

| 頁面 | 路由 | 步驟 | 設計文件 |
|---|---|---|---|
| 課程列表 | `/admin/courses` | 5 | [01-course-list.md](01-course-list.md) |
| 新增課程 | `/admin/courses/new` | 5 | [02-course-new.md](02-course-new.md) |
| 課程資訊 | `/admin/courses/[id]/info` | 7 | [03-course-info.md](03-course-info.md) |
| 定價與促銷 | `/admin/courses/[id]/pricing` | 4 | [04-course-pricing.md](04-course-pricing.md) |
| 邀請 | `/admin/courses/[id]/invites` | 3 | [05-course-invites.md](05-course-invites.md) |
| 課程內容 | `/admin/courses/[id]/content` | 7 | [06-course-content.md](06-course-content.md) |
| 作業/測驗 | `/admin/courses/[id]/assignments` | 4 | [07-course-assignments.md](07-course-assignments.md) |
| 課程留言(課內) | `/admin/courses/[id]/comments` | 6 | [08-course-comments.md](08-course-comments.md) |
| 私訊(課內) | `/admin/courses/[id]/messages` | 5 | [09-course-messages.md](09-course-messages.md) |
| 評價 | `/admin/courses/[id]/reviews` | 6 | [10-course-reviews.md](10-course-reviews.md) |
| 課程分析 | `/admin/courses/[id]/analytics` | 5 | [11-course-analytics.md](11-course-analytics.md) |

## 後台主要頁面教學(側邊欄各分頁)

| 頁面 | 路由 | 步驟 | 設計文件 |
|---|---|---|---|
| 儀表板 | `/admin` | 3 | [dashboard.md](dashboard.md) |
| 課程組合包 | `/admin/bundles` | 4 | [bundles.md](bundles.md) |
| 媒體中心 | `/admin/media` | 5 | [media.md](media.md) |
| 學員管理 | `/admin/users` | 5 | [users.md](users.md) |
| 課程留言(全站) | `/admin/comments` | 4 | [comments.md](comments.md) |
| 老師私訊 | `/admin/messages` | 5 | [messages.md](messages.md) |
| 訂單管理 | `/admin/orders` | 5 | [orders.md](orders.md) |
| 優惠券 | `/admin/coupons` | 5 | [coupons.md](coupons.md) |
| 金流收款 | `/admin/payments` | 4 | [payments.md](payments.md) |
| 銷售分析 | `/admin/analytics` | 4 | [analytics.md](analytics.md) |
| 講師管理 | `/admin/instructors` | 4 | [instructors.md](instructors.md) |
| 一般設定 | `/admin/settings` | 6 | [settings.md](settings.md) |
| 隱私權政策 | `/admin/privacy` | 4 | [legal.md](legal.md) |
| 服務條款 | `/admin/terms` | 4 | [legal.md](legal.md) |

> 步驟數不含開場白(intro);實際播放時開場白為第 1 張置中卡。部分步驟錨定的元素需「選取項目/有資料」才出現,框架會自動略過、優雅降級。

## 維護:新增一頁教學的步驟

1. 在目標元件加 `data-tour="<頁面前綴-名稱>"`(只錨初載就在的常駐元素)。
2. 在 `lib/tours/definitions/<slug>.tour.ts` 寫 `export default` 的 Tour(intro + steps)。
3. 在 `lib/tours/registry.ts` 註冊 slug 與 `resolveTourId()` 路徑對應。
4. 文案:客戶視角、口語、每句 ≤ 25 字。

## 給「對弈」評審的指引

逐份評估:**必要性**(可刪的步驟)、**視角**(是否殘留工程腔)、**完整性**(漏掉的 must 功能)、**一致性**(步驟數/語氣)、**架構決策**(見 00-overview 附錄 C)。
