# BestAppStore Phase 2 × Lumi Series 正式交接文件

- 文件日期：2026-09-20（最後更新：2026-09-22）
- 專案分支：`bestappstore-homepage`
- 文件性質：Phase 2 實作、測試與本機驗收狀態交接
- 狀態：本輪產品邏輯、Tool Management、三批品牌收斂、Consent 最低安全修正，以及 `/support`、`/help`、站內 footer route 與 sitemap 已完成；Production Backup Gate 與 Restore Drill 均為 `PASS`，deployment candidate 尚未 commit，production migration、seed 與 deploy 尚未執行
- 證據口徑：本文整合截至 2026-09-22 的程式碼、migration/seed、本機隔離 DB、production 唯讀 preflight、backup restore drill 與既有驗收紀錄。凡未於本輪重新執行者，均以「既有驗收紀錄」描述；2026-09-22 新增狀態以第 35～43 節為最新準據。

## 1. 專案定位

BestAppStore 是共用會員、登入、權限與服務入口的多系列平台，不等同於 Lumi Series。平台可承載 Lumi Series、CIS 與未來其他系列；會員登入後，依有效 entitlement 看到自己已開通的系列與工具。

Lumi Series 是 BestAppStore 內的一個系列。其前台保有獨立品牌語言、視覺與工具分類，但沿用平台共通的 Auth、Session、會員入口、法務與支援基礎。

## 2. 品牌與視覺原則

- BestAppStore 為主品牌與會員入口；各 Series 可有獨立視覺與語言。
- 共用範圍：帳號、登入、Session、權限、法務、Support 與 My Services。
- Website 已核准的正式視覺稿是 UI source of truth。
- 不得自行替換既有 Logo、Hero 圖、文案、卡片版型、CSS、Responsive 或視覺效果。
- 本階段不重新設計 BestAppStore、Login、Register 或 Lumi Series。

## 3. Lumi Series 頁面與資料來源

Lumi Series 既有頁面結構包含 Header、Hero、Featured、Explore／全部 Lumi 工具、Lumi Kids、Why Lumi、How It Works、Support 與 Footer。Hero 保留既有核准人物與 Lucky、Happy 視覺。

Featured 與 Explore 已改由 DB Tool 資料來源產生，不再以靜態 `lumiProducts` 作為主要資料來源：

- Explore 僅讀取 `LUMI_SERIES`、`status=ACTIVE`、`isPublished=true` 的工具。
- Explore 以 `displayOrder` 升冪排序，名稱作為次排序。
- Featured 由 `isFeatured` 與 `featuredOrder` 控制。
- Lumi Kids 維持獨立子區域與現有呈現方式。
- `app/lumi-series/catalog.tsx` 僅改為接收上層 `products`，分類篩選、`ProductCard`、文案、排版與 CSS 均保留。

## 4. 已匯入的 7 個 Web App

| 工具 | Slug | Launch URL | Seed 狀態 |
| --- | --- | --- | --- |
| Lumi～今天去哪玩？ | `today-where-to-go` | `https://lumi-north-travel.yangchingyuan.chatgpt.site/` | Published / Active |
| Lumi～今天煮什麼？ | `what-to-cook` | `https://lumi-kitchen.yangchingyuan.chatgpt.site/` | Published / Active |
| Lumi 今天吃哪間？ | `where-to-eat` | `https://lumi-restaurant.ai.studio/` | Published / Active |
| 肉肉減脂餐點設計師 | `rourou-fit-meal` | `https://rourou-fit-meal.ai.studio/` | Published / Active |
| 幼兒園聯絡本小幫手 | `kindergarten-contact-book` | `https://preschool-contact-helper.yangchingyuan.chatgpt.site/` | Published / Active |
| 幼教期末評語工具 | `kindergarten-term-comments` | `https://preschool-term-comment-helper.yangchingyuan.chatgpt.site/` | Published / Active |
| Q 萌大頭貼製作助手 | `qmeng-avatar` | `https://qmeng-avatar.yangchingyuan.chatgpt.site/` | Draft / Unpublished |

`qmeng-avatar` 刻意維持 `DRAFT`、`isPublished=false`，因此不會出現在 Lumi 前台，Launch Gateway 亦回傳 `404 tool_not_found`。

## 5. 已匯入的 3 個 Skill

| Skill | Slug | Runtime |
| --- | --- | --- |
| LINE 貼圖企劃製作助手 | `line-sticker-planner` | `SKILL_RUNTIME` |
| AI 商品社群銷售工作室 | `ai-product-social-sales-studio` | `SKILL_RUNTIME` |
| AI 商務訊息小助理 | `ai-business-message-assistant` | `SKILL_RUNTIME` |

這 3 筆資料只建立 Tool 基礎資料與概念性入口，未建立新的 Skill Runtime。Launch Gateway 遇到尚無 runtime 的 Skill 時回傳 `409 tool_runtime_unavailable`。其他 Capafy Skill 不在本輪範圍。

## 6. Web App Footer 原則

已核准的後續方向是移除「有什麼小工具想看看」作為主要 CTA。產品 footer 應優先提供：

- 返回 Lumi Series
- 更多工具
- 使用說明
- Support

回饋系統可作為次要入口，但不是主要導覽。本項為產品原則與後續工作，尚未完成各 Web App footer 的正式路由整合。

## 7. Auth、Login 與安全 returnTo

本輪沒有更換 Auth 架構，也沒有修改 bcrypt、Register 資料模型、consent create、Session callback、JWT callback、Credentials／Google／Apple provider 設定或既有 Register 行為。

新增的導向相容規則：

- Login 可讀取新參數 `returnTo` 與舊參數 `callbackUrl`；若兩者皆安全，優先採用 `returnTo`。
- 僅接受明確 internal route allowlist。
- 拒絕完整 external URL、protocol-relative URL、反斜線／控制字元、fragment、`.`／`..` traversal、未核准 route，以及未核准或可攜帶 redirect 的 query。
- allowlist 涵蓋 Lumi、My Services、既有課程／訂閱／checkout／lesson tool 與 admin 內部路由；各 route 僅允許指定 query keys。
- Credentials 登入成功後，安全 `returnTo` 優先；沒有指定目的地時依 entitlement 決定預設落點。
- OAuth 可經 `/post-login` 在登入後依 entitlement 分流，不修改 provider 本身。
- 只有一個有效 Series entitlement 時直接前往該 Series；零個或多個時進入 `/my-services`。

## 8. Entitlement 與 My Services

Phase 2 資料模型包含 `Series`、`Tool`、`Entitlement` 與 `UserEntitlement`，並建立 `LUMI_SERIES` Series entitlement。

有效 entitlement 判斷同時要求：

1. `UserEntitlement.status=ACTIVE`。
2. 對應 `Entitlement.isActive=true`。
3. `startsAt` 為空或已開始。
4. `expiresAt` 為空或尚未到期。
5. 查詢系列清單時，對應 `Series.status=ACTIVE`。

`/my-services` 行為：

- 無有效 Series entitlement：顯示尚未開通服務。
- 一個有效 Series entitlement：只顯示該服務，例如 Lumi Series。
- 多個有效 Series entitlement：依 Series `displayOrder` 顯示所有已開通服務。
- 權限不足由 Lumi 頁面導回時，使用 `/my-services?access=denied&service=lumi-series` 顯示拒絕狀態。

## 9. Lumi Series 與 Detail Guard

- 未登入造訪 `/lumi-series` 或受保護 detail 時，導向 Login 並保留經安全驗證的 `returnTo`。
- 已登入但沒有有效 `LUMI_SERIES` entitlement 時，導向 `/my-services?access=denied&service=lumi-series`。
- 有效會員可進入 Lumi Series 與已發布工具 detail。
- guard 為 server-side entitlement guard，不依賴前端隱藏來保護資源。

## 10. Launch Gateway

路由：`/lumi-series/launch/[slug]`

處理順序：

1. 驗證 slug 格式。
2. 僅從 DB 查詢 `LUMI_SERIES` 中 `ACTIVE` 且 `isPublished=true` 的 Tool。
3. 視 `requiresLogin` 檢查 Session；未登入導向 Login，並帶安全 `returnTo`。
4. 依 Tool 的 `requiredEntitlement` 檢查權限；未設定時 Lumi Tool 預設要求 `LUMI_SERIES`。
5. `EXTERNAL_WEB_APP` 只接受 DB 中受控的 HTTPS `launchUrl`，不接受使用者傳入任意 external URL。
6. `BESTAPPSTORE_NATIVE` 只允許同 origin 的 `detailUrl`。
7. 尚無 runtime 的 Skill 回 `409 tool_runtime_unavailable`。

Draft、Disabled、Archived 或未發布工具均視為不存在，回 `404 tool_not_found`。External Web App 缺少安全 Launch URL 時回 `409 tool_launch_unavailable`。

## 11. Tool Management 管理路由

- 清單：`/admin/tools`
- 新增：`/admin/tools/new`
- 編輯：`/admin/tools/[id]`
- Admin sidebar 已加入 admin-only 入口。
- 清單支援關鍵字、Series、Tool type 與 lifecycle 篩選，並顯示 Series、runtime、狀態、Featured、排序與價格類型等管理資訊。

## 12. Tool Management 欄位

後台已涵蓋：

- 基本：Series、名稱、slug、category、subCategory、eyebrow、Tool type。
- 內容：short/long description、CTA label。
- 圖片：thumbnail、heroImage。
- Runtime：runtimeType、launchUrl、detailUrl。
- 權限：requiresLogin、requiredEntitlement。
- 上架：lifecycle、isFeatured、featuredOrder、displayOrder。
- 價格：pricingType、price。
- 結構化內容：tags、audience、benefits、features、usageSteps。

價格欄位已完成後台驗證與儲存，但沒有新增或修改 Lumi Series 前台價格顯示 UI；幣別規格亦尚待另案確認。

## 13. Lifecycle 對應

| 後台 lifecycle | DB status | isPublished | 前台／Launch |
| --- | --- | --- | --- |
| Draft | `DRAFT` | `false` | 不顯示／404 |
| Published | `ACTIVE` | `true` | 可依排序顯示並啟動 |
| Disabled | `DISABLED` | `false` | 不顯示／404 |
| Archived | `ARCHIVED` | `false` | 不顯示／404 |

Featured 是獨立於 lifecycle 的展示設定；只有 Published 工具才會被前台資料查詢選入。

## 14. 驗證規則

- 所有 Create／Edit Server Action 均先通過 `requireOnlyAdminAuth()` 與 Zod `toolSchema`。
- slug 僅允許小寫英數與單一連字號分段，且 DB 全域唯一。
- External Web App 必須提供無帳密資訊的 HTTPS `launchUrl`。
- 需要 entitlement 的 Tool 必須同時要求登入。
- Required entitlement 必須存在、啟用，且若綁定 Series 必須與 Tool Series 相符。
- Lumi Series 發布時必須指定 required entitlement，category 也必須在核准的 Lumi 分類內。
- Featured Tool 必須指定 `featuredOrder`。
- `displayOrder`、`featuredOrder` 必須是允許範圍內的非負整數。
- `PAID` 必須有大於 0 的 price；非 `PAID` 不可保存 price。
- pricingType 支援 `FREE`、`PAID`、`INCLUDED`、`COMING_SOON`。

## 15. 圖片與 Artwork

Tool form 沿用既有 `ImageUpload` media 能力，支援：

- 既有 artwork token。
- 站內絕對路徑，例如 `/uploads/...`。
- 無帳密資訊的 HTTPS 圖片 URL。

未新增另一套上傳系統，也沒有自行生成缺少的工具圖片。現有 Lumi Series 圖片呈現與核准視覺保持不變。

## 16. Featured 與排序

- Explore：`displayOrder` 升冪，名稱次排序。
- Featured：`isFeatured=true` 才列入 Featured；以 `featuredOrder` 控制順序。
- 後台建立新 Tool 時可依 Series 現有最大 `displayOrder` 提供下一個建議值。
- 狀態或排序更新後，由 Server Action revalidation 讓前台重新取用資料，不需人工清 cache。

## 17. Admin Guard 與 AdminLog

所有 Tool list、options、detail、create、update 都經過 `requireOnlyAdminAuth()`；不提供驗收 bypass API，也不允許一般會員使用管理功能。

AdminLog 沿用既有 `UPDATE_SETTINGS` action，並以 `details.toolAction` 固定值支援稽核：

- `CREATE_TOOL`
- `UPDATE_TOOL`
- `PUBLISH_TOOL`
- `DISABLE_TOOL`
- `ARCHIVE_TOOL`
- `FEATURE_TOOL`

Log 同時保存 Tool target、slug、前後 lifecycle／featured 等操作細節。若 log 寫入本身失敗，目前採記錄 server error、不中斷 Tool 主操作的既有策略。

Known Limitation：Tool create／update／publish／disable／archive 等主要操作成功後，若 AdminLog 單獨寫入失敗，目前不會 rollback Tool 操作。Phase 2 接受 AdminLog 為 best-effort；若未來 AdminLog 被提升為正式、不可抵賴的 audit requirement，需另案改為 transaction／mandatory audit logging。

## 18. Cache Revalidation

Create／Edit 完成後會 revalidate：

- `/admin/tools`
- `/admin/tools/[id]`
- `/lumi-series`
- `/lumi-series/[slug]`
- `/lumi-series/launch/[slug]`

若 slug 變更，也會 revalidate 舊 slug 的 detail 與 launch 路徑。既有 live 驗收記錄顯示狀態變更後，前台不需人工清 cache。

## 19. 本機隔離 DB Runtime

本機驗收專用 runtime：

- Runtime name：`bestappstore-phase2-local`
- PostgreSQL：`127.0.0.1:55432`
- DB：`template1`
- Shadow DB：`127.0.0.1:55433`
- Prisma control/API：`55113`
- Persistence：`persistenceMode: "stateful"`
- Persistent root：`C:\Users\yangc\Documents\Codex\2026-08-28\md-human-router\work\woomin-true-checkout.local-bestappstore-phase2`
- 實際持久化資料：上述目錄內 `.pglite`

這是 `@prisma/dev` 的 Windows 本機隔離 PGLite runtime，不是 production、Zeabur 或其他 remote PostgreSQL。不得把這組連線或資料視為 production；不得讓 production 設定指向此 runtime。

## 20. Migration 與 Seed 狀態

本機隔離 DB 的既有驗收紀錄：

- Repo 共 47 個 migration 目錄。
- 本機 runtime 已套用 47/47 migrations。
- 包含 `20260918090000_add_bestappstore_services_tools_entitlements`。
- `Series`、`Tool`、`Entitlement`、`UserEntitlement` table 已建立。

`seed:bestappstore` 在本機 runtime 的驗收結果：

- Series：1（`LUMI_SERIES`）
- Entitlement：1（`LUMI_SERIES`）
- Tool：10（7 Web App + 3 Skill）
- UserEntitlement：0（seed 不建立會員權限）
- 重跑後仍為 1／1／10／0，確認採 upsert 且具 idempotency。
- Seed 不建立 Skill Runtime，也不修改既有 User、Purchase、Course、Order 或 Consent。

Production migration、production seed 與 deploy 均尚未執行。

## 21. 會員、權限與 Launch Live 驗收

本機隔離 DB 曾建立兩個明確標示的測試會員：一個具 ACTIVE `LUMI_SERIES` UserEntitlement，另一個沒有任何 UserEntitlement；不使用 production 真實會員資料。

既有驗收結果：

- 未登入進 Lumi：導向 Login 並保留安全 `returnTo`。
- 有權限會員：可進 Lumi、My Services 顯示 Lumi、可開已發布 detail 與 External Web App。
- 無權限會員：導向 My Services denied 狀態，且無法進 Lumi/detail/launch。
- `qmeng-avatar`：Draft，前台不可見、Launch 404。
- Skill：沒有 runtime，Launch 409。
- External、protocol-relative、traversal 與未 allowlist route 的 returnTo 均被拒絕。
- 相關會員／權限驗收測試紀錄為 28/28 通過。

此處為既有驗收紀錄；本交接文件建立時未重新啟動 runtime 或重跑 live HTTP。

## 22. Tool Management Live 驗收

本機驗收 Tool：

- Name：`[LOCAL TEST] Tool Management Acceptance`
- Slug：`local-tool-management-acceptance-20260920`
- Series：`LUMI_SERIES`
- Type：`WEB_APP`
- Runtime：`EXTERNAL_WEB_APP`
- 最終狀態：`ARCHIVED`、`isPublished=false`
- 保留位置：僅本機隔離 DB

驗收口徑與結果：

- Create 與 Draft 前台隱藏：實際 Admin UI click-through 驗收。
- Publish、Featured、排序、Disable、Archive：沿用同一個本機站、現有 ADMIN Session／cookies，透過既有 authenticated Server Action HTTP 路徑完成；不是全部 UI click-through。
- 所有狀態轉換都經過既有 `requireOnlyAdminAuth()`、Zod validation、AdminLog 與 `revalidatePath`；沒有直接 INSERT／UPDATE DB，沒有新增 bypass API。
- Published 時為 `ACTIVE`、`isPublished=true`、`isFeatured=true`，Explore 與 Featured 可見且排序符合設定。
- Launch Gateway 從 DB `launchUrl` 產生 307 redirect，驗收時不跟隨外部 redirect。
- Disabled 後為 `DISABLED`、`isPublished=false`，前台消失且 Launch 404。
- Archived 後為 `ARCHIVED`、`isPublished=false`，前台仍不顯示。
- AdminLog 已確認包含六種固定 `toolAction`。
- Revalidation 後不需人工清 cache。

## 23. 自動化測試與靜態驗證紀錄

截至本交接的既有驗收紀錄：

- Tool Management：7 suites／53 tests 通過。
- 會員、entitlement、Lumi 與 Launch 相關驗收：28/28 通過。
- Full Jest：88 suites／503 tests；87 suites／502 tests 通過，1 suite／1 test 失敗。
- 唯一 Jest 失敗位於既有 `zeabur-install-gaps.test.ts`，Windows 環境因缺少 `sh` 而發生 `spawn sh ENOENT`，不是 Phase 2 regression。
- Full repo ESLint：0 errors，42 個既有 warnings。
- TypeScript：本批沒有新增錯誤；僅剩 2 個既有錯誤，位於 `cloudflare-stream-sync-route.test.ts:30` 與 `:56`，為 `Request`／`NextRequest` 型別不相容。

以上為 2026-09-22 Deployment Candidate 最終審查的最新執行結果。Jest 失敗屬 Windows shell 環境限制；TypeScript 兩項錯誤位於既有、未修改的 Cloudflare 測試。

## 24. 本機驗收環境限制

Windows 上的 `@prisma/dev` PGLite live HTTP 曾出現：

- `ECONNRESET`／connection terminated。
- 單次請求約 80–120 秒延遲。
- `localhost` 與 `127.0.0.1` origin／cookie 差異。
- 正常停止後，metadata 偶爾無法即時寫回 `stopped`，即使程序與 ports 已關閉且 `.pglite` 已保留。

這些項目列為本機 runtime／驗收環境限制，不視為產品邏輯缺陷。本輪已明確決定不再重試 PGLite detail live HTTP，也不為配合此環境修改產品邏輯。狀態判斷應以程序、port、持久化資料與已完成的產品測試共同確認，不能只看可能過期的 metadata。

## 25. 尚未完成項目

- Web App Footer 返回 BestAppStore／Lumi、更多工具、說明與 Support 的正式路由整合。
- Skill Runtime。
- Production migration 風險評估與執行。
- Production seed 風險評估與執行。
- Production deploy。
- CIS 系列。
- 豪欣晴 multi-tenant SaaS 與正式資料處理。
- Lumi 前台價格顯示 UI。
- 幣別與價格呈現規格。
- 其他 Capafy Skill。
- Windows PGLite runtime 穩定性問題。
- Production domain 與正式 Launch URL 整合確認。

## 26. 建議後續順序（僅建議，未執行）

1. 完成 Website／BestAppStore 品牌與視覺收尾。
2. 取得並替換正式 BestAppStore square icon 素材。
3. 完成各 Web App footer 路由整合。
4. 進行 production migration／seed 的備份、回復與資料影響風險評估。
5. 經核准後執行 production migration、seed 與 deploy。
6. 規劃 CIS 系列。
7. 另案設計與建立 Skill Runtime。
8. 另案處理豪欣晴 multi-tenant SaaS。

## 27. 明確禁止與交接紅線

- 不得把本機 PGLite runtime 或其 `template1` 視為 production。
- 未經核准不得修改、連線或寫入 production／remote DB。
- 不得重做 Auth、Register、Session、JWT、bcrypt 或 provider 架構。
- 不得重新設計 Lumi Series，或替換已核准 Logo、Hero、文案與卡片版型。
- 不得為目前 3 個 Skill 自行建立 Runtime。
- 不得匯入或處理其他 Capafy Skill。
- 不得修改豪欣晴正式資料或逕行處理 multi-tenant。
- 未完成 production 風險評估與明確核准前不得 deploy。
- 不得為繞過本機 PGLite 問題而加入產品 bypass 或改寫產品權限邏輯。

## 28. 交接結論

BestAppStore Phase 2 的核心會員導向、Series entitlement、My Services、Lumi DB-driven catalog、server-side guard、Launch Gateway，以及 Tool Management 的 Create／Edit／Publish／Featured／Disable／Archive 管理流程已完成並具測試與本機隔離驗收紀錄。

目前最重要的邊界是：產品邏輯完成不等於 production 已上線。Production migration、seed、資料風險評估與 deploy 仍需獨立核准；Web App footer、價格顯示、CIS、Skill Runtime 與豪欣晴 multi-tenant 仍是後續階段。BestAppStore `/support`、`/help`、站內 footer route 與 sitemap 已完成。

## 29. 品牌收斂進度

截至 2026-09-21，已完成三批低風險品牌收斂，且相關測試均通過。

第一批：

- Root metadata。
- Public fallback。
- Auth metadata。
- Main Header／My Services 使用者可見文案。
- Admin branding。
- Support email fallback。
- 正式 BestAppStore Logo 已套用於適合的 Header／Admin 場景。
- Favicon／app icon 因缺少方形正式素材，尚未替換。

第二批：

- Email。
- Email templates。
- Email preview。
- Newsletter。
- Welcome Email。
- PDF watermark。
- Support fallback 已統一為 `service@bestappstore.co.uk`。
- DB 自訂品牌設定仍具優先權。
- 舊品牌 compatibility 邏輯仍保留。

第三批：

- Course Open Graph／JSON-LD 的母品牌語意已收斂為 BestAppStore，不再將母品牌固定描述為課程平台。
- Setup 文案已使用「正式內容平台」等中性語意。
- Checkout／My Courses／My Subscriptions browser title 已完成品牌收斂。
- 其他低風險、使用者可見的課程平台品牌殘留已收斂。

Support／Help 正式頁與站內回接：

- `/support` 已完成，公開可讀且不依賴 DB。
- `/help` 已完成，公開可讀且不依賴 DB。
- BestAppStore 首頁、Lumi Series 與 MainFooter 的站內 `/support`、`/help` route 已完成。
- Sitemap 已包含 `/support` 與 `/help`。
- 7 個外部 Web App footer 尚未實際回接，仍需回各自專案處理。

正式 square icon 素材仍待建立：

- `app/icon.png` 是 Next.js file-based app icon，未來需替換為核准的 BestAppStore 方形素材。
- Root metadata 的 `icons.icon`、`icons.shortcut`、`icons.apple` 目前共同使用 `siteIcon`。
- `siteIcon` 由 `resolveSiteIconPath(siteLogo, appUrl)` 解析；未設定或舊 `/icon.png` 時會回退至 `DEFAULT_SITE_ICON_PATH`。
- `DEFAULT_SITE_ICON_PATH` 目前為 `/icon.svg`，而 `public/icon.svg` 仍是 muni 舊素材，不可作為 production candidate 的正式 icon。
- `public/icon.png`、`public/icon-squre.png`、`public/icon-nobackground.png` 與 `app/icon.png` 均保留，未刪除、rename 或覆蓋。
- 目前沒有 manifest／PWA icon 設定；未來若新增 manifest，仍需核准的 192×192 與 512×512 方形素材。
- 所需正式輸出至少包括 16×16、32×32、視需要 48×48 favicon、180×180 Apple Touch Icon、192×192／512×512 App/PWA icon，以及約 32×32 的 Admin collapsed icon；來源應為 symbol-only master SVG 或至少 1024×1024 的方形 master PNG。
- 橫式 `public/bestappstore-logo.png` 不得強行代替方形 icon。

## 30. Consent 最低安全修正

已完成：

- 新增 `GENERAL_EMAIL_V1_202609`。
- 新增 `MARKETING_EMAIL_V1_202609`。
- 新 General／Marketing consent 使用 versioned `EmailConsentLog`。
- 舊 `termsVersion=null` 不回填、不升級。
- 舊課程 `marketingConsent` 不視為 BestAppStore 全系列行銷同意。
- Register General／Marketing 維持 optional，不影響註冊成功。
- `agreedTerms` 已加入 checkout request。
- Server-side 明確要求 `agreedTerms === true`。
- `agreedTerms=false` 或缺少時回 `400`，且不得進入付款 provider 或建立 Order。
- Subscription checkout 已隱藏目前不會實際寫入的 Email checkbox。
- OAuth／非 Register User 即使 `generalEmailConsent=true`，仍需新版 `GRANTED` log 才能視為有效 opt-in。
- Transactional 通知已與 General／Marketing consent 語意分離。

Consent 相關測試紀錄為 5 suites／44 tests 通過。

仍未處理的 Consent Phase 2：

- Terms／Privacy 完整 versioning。
- `LegalConsentLog`。
- Order legal consent evidence。
- `generalEmailConsent` DB default `true` migration。
- Preference center。
- Double opt-in。
- Admin consent audit UI。
- Revoke／complaint／admin override log 一致性。

## 31. Production Readiness Audit

正式網域：<https://bestappstore.co.uk>

目前 production app：

- Zeabur project：`thetu-platform-production`。
- Project ID：`6a6a062c9949111176cf2768`。
- Environment ID：`6a6a062c5f062718bc7b1fee`。
- App service：`thetu`。
- App service ID：`6a6a1a949949111176cf32d1`。
- PostgreSQL service ID：`6a6a064c9949111176cf2772`。

Production DB 唯讀 preflight：

- `current_database() = zeabur`。
- Schema：`public`。
- Migration total：46。
- Applied：46。
- Failed：0。
- Rolled back：0。
- Latest migration：`20260731140000_add_lesson_tool_fields`。

第 47 個 migration `20260918090000_add_bestappstore_services_tools_entitlements` 尚未套用。

Production 尚不存在：

- `Series`。
- `Tool`。
- `Entitlement`。
- `UserEntitlement`。

Collision check：

- `LUMI_SERIES` code 無碰撞。
- `lumi-series` slug 無碰撞。
- 10 個核准 Tool slug 均無碰撞。

## 32. Production SiteSetting

Production DB 唯讀查詢記錄的原始值：

- `siteName = Bestappstore`。
- `brandDisplayName = ""`。
- `brandSubtitle = ""`。
- `contactEmail = ""`。
- `siteLogo = ""`。
- `siteIcon` key 不存在。
- Share title：`""`。
- Share description：`""`。

正式站目前部分品牌內容仍依賴舊版程式 fallback，新版本品牌收斂尚未 deploy。

## 33. Production Auth／網域

目前 production `/api/auth/providers` 仍回傳舊 Zeabur canonical URL：

`https://thetu.zeabur.app:8080`

正式 deploy 前需統一：

- `APP_URL=https://bestappstore.co.uk`
- `NEXT_PUBLIC_APP_URL=https://bestappstore.co.uk`
- `AUTH_URL=https://bestappstore.co.uk`
- `NEXTAUTH_URL=https://bestappstore.co.uk`（若該變數存在）

Google／Apple 目前未啟用，provider console callback 可延後處理，但 Auth base URL 不可延後。

## 34. DNS／TLS

已驗證：

- Apex DNS 正常。
- `www` DNS 正常。
- HTTP 會導向 HTTPS。
- Apex／`www` HTTPS 回應 `200`。
- TLS 1.3。
- Let’s Encrypt certificate。
- Zeabur 正常提供現行 production。

以上只代表 infrastructure 正常，不代表 Phase 2 已可公開。

## 35. Production Backup Gate

**Backup Gate：`PASS`。**

已完成：

- 已在 production PostgreSQL service 執行 `pg_dump`。
- Database：`zeabur`。
- Format：custom format。
- 參數包含 `--no-owner`、`--no-privileges`。
- 本機安全 backup 副本已取得，保存在非 repo 的受控位置。

Backup metadata：

- ID：`bestappstore-production-20260921`。
- Created UTC：`2026-09-21T03:44:47Z`。
- 原始 dump：`bestappstore-production-20260921.dump`。
- Size：`235,653 bytes`。
- SHA-256：`51C23C2A5A14F945C16F570630674320F6D98A4DDFB8B576BC40D7822409B98D`。

Restore Drill：

- PostgreSQL client／server：`18.6`。
- PostgreSQL 18.6 `pg_restore --list`：`PASS`。
- Target：`127.0.0.1:55442`。
- Database：`bestappstore_restore_drill_20260922`。
- Restore exit code：`0`。
- `migration_total = 46`。
- `migration_applied = 46`。
- `migration_failed = 0`。
- `migration_rolled_back = 0`。
- Latest migration：`20260731140000_add_lesson_tool_fields`。
- `SiteSetting`、`User`、`Order`、`Course` 均存在。
- Restore log 無 error／fatal／warning marker。

安全邊界：

- Restore Drill 全程未連線或修改 production。
- 未使用 production DATABASE_URL 或 credential。
- 未執行 migration、seed 或 deploy。
- Backup 已證明可由 PostgreSQL 18.6 實際還原，Backup Gate 更新為 `PASS`。

Restore Drill 尚未 cleanup，依核准保留：

- 運行中的 PostgreSQL 18.6 隔離 instance。
- `pgdata`。
- Verified dump。
- Logs。
- Secrets。
- 原始 backup ZIP。

## 36. Zeabur Support

本節保留 File Manager Download 問題的歷史紀錄。2026-09-22 已取得本機安全副本並完成隔離 Restore Drill，因此此問題不再阻擋 Backup Gate；Zeabur Download 的既有錯誤不視為已修復。

目前已準備 Support 工單：

- 問題：`PostgreSQL File Manager download fails with ERROR_SESSION_FORBIDDEN`。
- Support：<https://zeabur.com/support>。
- Email：`contact@zeabur.com`。

當時策略（歷史紀錄）：

1. 優先等待 Zeabur Support 修復正常 Download。
2. 不直接使用 API URL 繞過 session verification。
3. 不把 dump 寫入 production data volume。
4. 不新增 production PostgreSQL Volume。
5. 不 restart／redeploy PostgreSQL。

只有 Zeabur Support 無法處理時，才另案評估 temporary export service 搭配獨立 Volume；該備援方案目前未建立、未執行。

## 37. Migration Runner

Production runtime image 目前缺少：

- Prisma CLI。
- `schema.prisma`。
- Migration assets。

因此不適合直接執行 migration。目前建議方案為獨立 immutable migration-only image／service，條件如下：

- 包含 Prisma CLI。
- 包含 schema。
- 包含全部 47 個 migrations。
- 不包含 seed。
- 不包含 startup sync。
- 預設不得自動 migrate。
- 先執行 status／preflight。
- Migration 需另輪明確核准。
- 固定 artifact digest、commit SHA 與 migration checksum。

Backup Gate 已為 `PASS`；migration runner 尚未建立，仍需另輪規劃、審核與明確核准。

## 38. 正式 Migration Blocker

Backup／restore 前置條件 1～7 已完成。Production migration 仍須等待第 8～9 項完成，並取得另輪明確核准：

1. Production dump 已有安全、持久的副本：完成。
2. 本機 SHA-256 與預期值完全相符：完成。
3. 本機 `pg_restore --list` 再次 `PASS`：完成。
4. Restore 到全新隔離 DB 成功：完成。
5. Restore 後 migration history 為 46：完成。
6. 核心 schema 可讀：完成。
7. Backup 已證明可實際還原：完成。
8. Clean deployment candidate commit：尚未建立。
9. Migration runner artifact：尚未建立或固定。

## 39. Working Tree／Deployment Candidate

Production 目前仍運行舊 commit：

`4bceb5e9cf584f7597f379a4850a91d589404a2b`

目前 Phase 2、branding 與 consent 等更新仍在 working tree，尚未形成最終 deployment candidate commit。

Production migration 前仍需：

- Review working tree。
- 收斂修改。
- 建立 clean commit。
- 記錄 deployment candidate SHA。
- 使用 clean checkout 重算 migration checksum／manifest checksum。

## 40. 目前上線進度判定

已完成：

- Phase 2 核心架構。
- Lumi Series。
- Auth `returnTo`。
- Entitlement。
- My Services。
- Launch Gateway。
- Tool Management。
- Tool Management live 驗收。
- 品牌收斂第一～三批。
- Consent 最低安全版。
- Production DB 唯讀 preflight。
- Production collision check。
- DNS／TLS。
- Backup Gate。
- Restore Drill。
- Support／使用說明正式頁。
- 站內 Footer `/support`、`/help` route。
- Sitemap `/support`、`/help` 項目。

Blocked：

- Migration runner。
- Production migration。
- Production seed。
- Production SiteSetting 更新。
- Production Auth URL 更新。
- Production smoke test。
- Deployment candidate commit。
- 正式 favicon／app icon。
- 外部 Web App Footer 正式回接。

## 41. 下一步

目前下一步仍不是直接執行 migration，而是先建立 clean deployment candidate commit，並另輪規劃、審核 migration-only runner。

核准順序：

1. 建立 clean deployment candidate commit。
2. 規劃並核准 migration-only runner。
3. 固定 runner artifact digest、commit SHA 與 migration checksum。
4. Migration preflight。
5. 另輪核准 production migration。
6. Migration post-check。
7. 另輪核准 production seed。
8. Production SiteSetting／env／Auth URL 收斂。
9. Deploy。
10. Production smoke test。
11. 最後才公開宣傳。

## 42. Backup Gate PASS 後仍維持的禁止事項

- 未經另輪明確核准，禁止 production migration。
- 未經另輪明確核准，禁止 seed。
- 未經另輪明確核准，禁止 deploy Phase 2。
- 禁止 production DB write。
- 本輪禁止建立 migration runner。
- 禁止修改 production PostgreSQL Volume。
- 禁止 restart PostgreSQL。
- 禁止把 dump 放入 repo。
- 禁止把 dump 內容貼入對話。

## 43. 2026-09-22 交接結論

截至 2026-09-22，BestAppStore Phase 2 的核心產品邏輯、Tool Management、三批品牌收斂、Consent 最低安全修正，以及 `/support`、`/help`、站內 footer route 與 sitemap 已有實作及測試紀錄；production DB 唯讀 preflight 也已確認目前為 46 個已套用 migrations、零 failed／rolled back，且第 47 個 BestAppStore migration 尚未套用。

Production Backup Gate 與 Restore Drill 均為 `PASS`。本機安全 backup 副本已取得，dump 的 size 與 SHA-256 已核對，PostgreSQL 18.6 `pg_restore --list` 與全新隔離 DB restore 均成功；restore 後 migration history 為 46／46，零 failed／rolled back，核心 schema 可讀。Restore Drill instance、pgdata、verified dump、logs、secrets 與原始 backup ZIP 目前依核准保留，尚未 cleanup。Production 全程未被連線或修改，且 production migration、seed 與 deploy 均未執行。Deployment candidate 亦尚未 add 或 commit；下一步需先完成正式 square icon 素材與 clean deployment candidate，再另輪規劃與核准 migration-only runner。

## 43. Migration Runner Artifact Identity Limitation

Zeabur 目前未提供 `SOURCE_GIT_COMMIT_SHA` pin；temporary migration runner build 會取得部署當下的 branch HEAD。2026-09-25 build 前與 build 後，`origin/bestappstore-phase2-migration-runner` 均為 `0b35d8796aecf223e198d23b5ea62bc4d331425d`，build verifier 驗證 47 個 migrations 與 immutable checksums 通過。此次 artifact identity 正式採用「branch HEAD 前後核對 + image digest + build verifier」證據模型，成功 artifact digest 為 `sha256:2cb0bc4cad9491fd4b7129a1b4860f520ae5c768c9ae68b00c33aa54f93f93d9`。若 Zeabur 未來支援 exact commit pin，runner build 流程應改用該能力。

## 44. 2026-09-23 正式 icon 資產狀態

- 品牌方已核准 `1254 × 1254` RGBA PNG square symbol，作為本次 favicon／app icon 的正式 raster source。
- Repo 內正式 raster master 為 `public/bestappstore-symbol.png`（`1024 × 1024` RGBA）。
- Browser favicon 已提供 `16 × 16`、`32 × 32`、`48 × 48` PNG 與包含三種尺寸的 `favicon.ico`。
- Apple Touch Icon 為 `public/apple-touch-icon.png`（`180 × 180`，不透明白底）。
- Next.js file-based icon 為 `app/icon.png`（`1024 × 1024` RGBA）。
- Runtime fallback 與 Admin collapsed icon 使用 `public/bestappstore-icon.png`（`512 × 512` RGBA）。
- `/icon.png` 與 `/icon.svg` 僅保留 legacy compatibility；primary runtime metadata 不再依賴舊路徑，且相容內容不再包含 muni／舊旗幟視覺。
- 目前沒有真正 vector source；未執行自動 trace 或向量化。正式 symbol-only SVG master 仍列為後續品牌資產。
- 本批未新增 PWA manifest、maskable icon、service worker 或 192／512 PWA 宣告；Open Graph `1200 × 630` 分享圖仍為後續獨立品牌資產。
