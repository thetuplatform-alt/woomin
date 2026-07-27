# 電子報（Newsletter / EDM）功能 — BDD 規格

## 概述

本功能讓後台 ADMIN／EDITOR／INSTRUCTOR 能在平台內完成電子報的撰寫、模板套用、分眾、法遵檢查、測試信、排程／立即發送、退訂管理、送達率監控與成效分析。功能必須以法遵與可靠發送為第一優先，確保促銷信只寄給明確同意行銷的收件人、每封信都可退訂、發送流程可斷點續發且不可重複誤寄，並以現有網站高級質感與 Linear 風格完成後台與信件視覺設計。

## 採用決策

- Zeabur 排程採 PRD 建議方案 A：每分鐘以 cron service 呼叫 `/api/cron/newsletter-dispatch`，搭配心跳健康檢查。
- 資料模型採 PRD §2 仲裁命名：`NewsletterCampaign`、`NewsletterRecipient`、`NewsletterTemplate`、`NewsletterLink`、`EmailConsentLog` 與 `User` 同意欄位。
- 歷史用戶 `marketingConsent` 預設 `NULL`，視為未同意促銷。
- 促銷內容採全平台最嚴格 opt-in 基準，不以 GeoIP 自動降級。
- Email provider 未設定、頁尾實體地址未填、發送健康檢查失敗時，系統允許存草稿但禁止進入可發送狀態。

## 行為規格

### 場景 1：建立與撰寫電子報
**Given** 具備權限的後台使用者進入電子報功能  
**When** 建立 GENERAL 或 PROMO 電子報並編輯內容  
**Then** 系統提供符合類型的區塊、模板、主旨與 preheader 輔助、真實 email iframe 預覽、自動儲存、並發衝突防護、測試信與發送前確認流程。

### 場景 2：套用模板與個人化變數
**Given** 使用者選擇內建或自訂電子報模板  
**When** 插入個人化變數並對收件人渲染  
**Then** 系統以同一渲染路徑套用品牌、fallback、在地化時間格式與 HTML escaping，寄出內容不得留下未替換 token 或可執行注入。

### 場景 3：選擇受眾與促銷內容
**Given** 使用者設定全部發送、手動勾選、動態分眾或促銷區塊  
**When** 系統計算預估收件人並進入發送確認  
**Then** 系統去重、套用退訂與同意排除、促銷模式強制鎖定行銷同意，並對優惠券、課程卡、UTM、歸因與售罄體驗做最終檢查。

### 場景 4：退訂、同意與法遵守門
**Given** 平台處理一般電子報、促銷電子報、交易信或退訂請求  
**When** 發送前、退訂頁、註冊／結帳同意收集、後台覆蓋同意狀態等行為發生  
**Then** 系統以業務層 `assertEmailConsent` 強制守門、HMAC 驗證退訂 token、GET 不寫入、POST 才生效、寫入 append-only 稽核紀錄，且交易信不被行銷退訂誤擋。

### 場景 5：排程與大量發送
**Given** campaign 被排程或立即發送  
**When** cron／worker 分批處理收件人  
**Then** 狀態轉換必須原子、防連點、防回退，發送可從 DB cursor 斷點續發，套用 token bucket 速率限制、即時重新檢查退訂同意、失敗與 provider 配額問題必須可觀測並告警。

### 場景 6：送達率、退信與投訴
**Given** ESP webhook 回報退信、投訴、延遲或發送異常  
**When** 系統接收並驗證事件  
**Then** 系統更新 recipient 與 user 狀態、隔離 hard bounce、處理 soft bounce 閾值、監控退信率與投訴率，必要時自動暫停剩餘批次並通知管理者。

### 場景 7：追蹤與成效報表
**Given** 電子報已寄出且啟用追蹤  
**When** 收件人開信、點擊、退訂或在歸因窗口內購買  
**Then** 系統以自有網域追蹤、避免 Open Redirect、不污染測試信資料，並在報表以 GENERAL／PROMO 類型呈現對應指標與 Apple MPP 免責。

### 場景 8：設計、可用性與安全攔截
**Given** 使用者操作後台、公開退訂頁或收件人閱讀信件  
**When** 頁面載入、互動、錯誤、空狀態或鍵盤操作發生  
**Then** UI 應符合現有高級質感與 Linear 風格、資訊密度清楚、狀態明確、可及性完整，所有外部輸入與不可逆寄信流程都具備後端安全攔截。

## Acceptance Criteria

### WRITE 核心撰寫體驗
- [ ] AC-WRITE-01：GENERAL 含標題／段落／按鈕／分隔／影片卡時，右側 iframe 預覽輸出 table-based、全 inline style、600px container，且不含 `<style>`／flex／grid。
- [ ] AC-WRITE-02：PROMO 編輯時「+」選單出現課程卡／優惠券／倒數，切回 GENERAL 後三者消失。
- [ ] AC-WRITE-03：優惠券區塊自動帶入 code／折扣／到期，券碼唯讀不可手打。
- [ ] AC-WRITE-04：未儲存變更停止滿 5 秒或距上次儲存達 30 秒後自動儲存，顯示「已於 HH:mm 儲存草稿」，且只保留單一最新快照。
- [ ] AC-WRITE-05：主旨超過 50／70 字元時，計數分別轉黃／轉紅，更新延遲小於 300ms。
- [ ] AC-WRITE-06：有未儲存變更時關閉分頁／重整／路由離開會觸發確認，取消停留、確認才離開。
- [ ] AC-WRITE-07：複製含 8 區塊促銷信後，完整保留區塊與 `segmentJson`，`status=DRAFT`，主旨含「副本」，不繼承任何發送記錄。
- [ ] AC-WRITE-08：測試信與正式信由同一 `renderCampaignHtml` 產出，除測試 banner 與 merge 樣本值外位元組層級一致，且測試信頂部有「這是測試信」banner。
- [ ] AC-WRITE-09：測試信收件人若非平台 ADMIN／EDITOR／INSTRUCTOR 帳號，系統拒絕並提示僅能寄給內部帳號。
- [ ] AC-WRITE-10：測試信 recipient `isTest=true`，不計入開信率／點擊率／信譽／配額，且主旨可辨識為測試。
- [ ] AC-WRITE-11：段落或主旨含 `<script>` 或惡意資源時，外發 HTML 與測試信原始碼經 sanitize 後不含 `<script>`、`on*` 事件或外部惡意資源。
- [ ] AC-WRITE-12：信件 HTML 超過 102KB 時，發送前檢查顯示阻擋或明確 Gmail 裁切警告。
- [ ] AC-WRITE-13：HTML 信件發送 payload 同時包含自動產生純文字版，保留段落並將連結轉為「文字 [URL]」，後台可預覽覆蓋。
- [ ] AC-WRITE-14：促銷信包含已達 `maxRedemptions` 或已過 `expiresAt` 的券時，發送被阻擋並維持 DRAFT。
- [ ] AC-WRITE-15：EDITOR 可建立／編輯／複製草稿並觸發發送，每次發送都寫 AdminLog，包含 `adminId` 與 `ipAddress`。
- [ ] AC-WRITE-16：寄件人實體地址未填時，點發送或排程在確認對話框前被阻擋，campaign 不進入發送。
- [ ] AC-WRITE-17：任一信件頁尾都含唯一不可猜測 token 的退訂連結與寄件人實體地址，文案為繁中，GENERAL／PROMO 皆有。
- [ ] AC-WRITE-18：兩個編輯者同編同一草稿時，後者儲存會被樂觀鎖偵測衝突並提示內容已被他人變更，不靜默覆蓋。
- [ ] AC-WRITE-19：含 20 區塊信件變動後，預覽經 debounce 在 500ms 內完成重渲染，連續輸入不每字元重渲染。
- [ ] AC-WRITE-20：本地 volume 模式上傳大圖時顯示進度，完成後使用 `SITE_URL` 起始的絕對公開 URL。
- [ ] AC-WRITE-21：發送確認對話框顯示主旨、類型、寄件人、預估人數與 3–5 個去識別化抽樣收件人；人數為 0 時確認前攔截。
- [ ] AC-WRITE-22：區塊編輯器支援 `⌘Z` 復原與 `⌘⇧Z` 重做最近一次區塊層級操作。

### TMPL 模板系統
- [ ] AC-TMPL-01：輸入「{{」時彈出變數自動補全，每項顯示來源與 fallback 說明，選定後以 token 插入。
- [ ] AC-TMPL-02：含 `{{學員姓名}}`／`{{課程名稱}}` 的信送達 Gmail Web／Apple Mail／iPhone Mail 時，變數皆替換為真實值且不存在 `{{` 或 `}}`。
- [ ] AC-TMPL-03：收件人 `name` 為 null 或空時，`{{學員姓名}}` 輸出 fallback（預設「同學」），發送前預覽標示將使用 fallback。
- [ ] AC-TMPL-04：任一內建版型渲染時，Logo／主色／頁尾皆取自 `SiteSetting`，原始碼中無 `#78573c` legacy 棕色。
- [ ] AC-TMPL-05：`{{優惠到期時間}}` 顯示繁中可讀格式，不出現 ISO／UTC 原始字串。
- [ ] AC-TMPL-06：姓名／課程名等變數值含 HTML／script 時，渲染進信件前經 `escapeHtml` 轉義，不產生可執行標籤。
- [ ] AC-TMPL-07：選擇促銷版型後，介面明示此類型僅寄給已同意行銷者並顯示排除規則。
- [ ] AC-TMPL-08：另存模板後，新建信選用該模板會完整載入其 `contentJson` 與 `type`，且可再編輯。

### SEND 排程與發送引擎
- [ ] AC-SEND-01：同一 campaign 與收件人插入重複 `(campaignId, userId)` recipient 時，第二筆因 unique constraint 被攔，同一收件人僅一筆 SENT。
- [ ] AC-SEND-02：到期 SCHEDULED campaign 在第 59 秒與第 61 秒 cron 觸發時，只轉 QUEUED 一次、只發一次，無重複 SENT。
- [ ] AC-SEND-03：1000 人 campaign 發送到約 300 封後容器重啟時，從第 301 封續發，不重發已完成者，且心跳逾時可被 cron 撿回。
- [ ] AC-SEND-04：後台選 2026-07-01 20:00 Asia/Taipei 時，DB `scheduledAt` 為 2026-07-01 12:00:00 UTC（誤差 ≤1 秒），清單與確認 modal 同時顯示台北時間與 UTC。
- [ ] AC-SEND-05：節流每分鐘 60 封、共 200 人時，sentAt 分佈符合每分鐘上限且不觸發 provider 429。
- [ ] AC-SEND-06：DRAFT campaign 快速連點兩次立即發送時，只有第一個請求原子成功，第二個被拒且無重複發送。
- [ ] AC-SEND-07：SENT campaign 經任何 API 嘗試改回 DRAFT／SCHEDULED 都被拒，並記 AdminLog。
- [ ] AC-SEND-08：Email API Key 失效造成連續失敗時，5 分鐘內透過不依賴失效 Email 服務的後台 Bell 通知至少一位 ADMIN，campaign 轉 FAILED／PARTIAL_FAILED 並顯示原因。
- [ ] AC-SEND-09：SENDING campaign 暫停後停止派發新批並轉 PAUSED，恢復後從 cursor 續發，已發者不收第二封。
- [ ] AC-SEND-10：收件人在快照後、輪到寄出前退訂時，發送引擎即時查狀態並標 SKIPPED，不寄出。
- [ ] AC-SEND-11：ESP 回 429 時，當批暫停、Campaign 轉 PAUSED、記錄原因、顯示橘色警告，重試不超過 3 次後停止。
- [ ] AC-SEND-12：收件人計算為 0 時，排程／發送被阻止並顯示明確原因。
- [ ] AC-SEND-13：50,000 User 條件為全部有效學員時，人數 COUNT 以非同步／快取回傳，首屏 ≤2 秒顯示計算中或結果。
- [ ] AC-SEND-14：Zeabur 無 cron 心跳時，排程設定畫面顯示排程引擎未啟動警告與設定教學連結。
- [ ] AC-SEND-15：管理員以 email 搜尋過去 3 個月發送記錄時，≤2 秒回傳 campaign 清單，含狀態、原因與時間戳。
- [ ] AC-SEND-16：>2000 人名單觸發發送時，HTTP 5 秒內回「已排入佇列」，實際寄送由 cron／worker 分批完成。
- [ ] AC-SEND-17：campaign 進入 SENDING 後管理員改 email provider 設定時，本 campaign 仍使用 `senderSnapshot` 鎖定的原設定。
- [ ] AC-SEND-18：provider 配額不足時，系統提前警告並建議分日發送，超量時自動暫停剩餘批次等待確認。

### PROMO 促銷與推廣
- [ ] AC-PROMO-01：促銷信發送前確認畫面顯示類型、主旨、預計人數、排程時間、所綁券代碼與有效期；未最終確認前不進入 SENDING。
- [ ] AC-PROMO-02：GENERAL 不顯示優惠券綁定區、報告無營收區塊；PROMO 顯示優惠券與 UTM 區，報告含購買轉換數與收益。
- [ ] AC-PROMO-03：促銷信綁定過期、未啟用或次數已滿的券時，Checklist 顯示紅色阻擋警告且發送按鈕不可用。
- [ ] AC-PROMO-04：課程卡從 `Course` 選取後，自動帶入封面／課名／`finalPrice`／絕對連結，價格與連結唯讀不可手打。
- [ ] AC-PROMO-05：促銷信所有連結都帶 `utm_source=newsletter`、`utm_medium=email`、`utm_campaign`、`utm_content`，且經結帳／付款頁後 UTM 完整保留。
- [ ] AC-PROMO-06：INSTRUCTOR 構造含非自己課程學員的發送 Server Action 請求時，後端回 403，分眾 UI 也只能選到持有其課程 `Purchase` 的用戶。
- [ ] AC-PROMO-07：倒數區塊接 `Coupon.expiresAt` 時顯示靜態繁中倒數文字，不含 JS 動態計時或動態 GIF。
- [ ] AC-PROMO-08：課程卡按鈕帶 `coupon=CODE` 時，進入結帳自動套用該券，UTM 與券參數並存不互洗。
- [ ] AC-PROMO-09：`maxRedemptions=100` 的券發給 1 萬人，第 101 人使用時結帳頁明確提示優惠已額滿，歸因仍正常記錄。
- [ ] AC-PROMO-10：促銷信種下歸因標記後 7 天內付款時，`Order.newsletterCampaignId` 正確寫入，歸因 cookie 與既有 UTM cookie 不衝突。

### AUD 發送對象管理與分眾
- [ ] AC-AUD-01：GENERAL 選全部發送時，頂部顯示實際將發送 N 人，並標示已自動排除退訂、未驗證／退信人數，三數相加一致。
- [ ] AC-AUD-02：條件「買過 iOS 課 AND 近 30 天有登入」變更後，debounce 後 1 秒內更新預估，並顯示人話摘要而非 SQL／欄位語言。
- [ ] AC-AUD-03：OR 條件 A=200、B=150、重疊=80 時，實際將發送顯示 270 並標示已去重 80 人。
- [ ] AC-AUD-04：過濾後實際發送人數為 0 時，禁止進入發送確認並顯示具體原因，優先顯示全部已退訂等實際原因。
- [ ] AC-AUD-05：同一用戶同時符合多個課程條件時，該 email 在 campaign 僅 1 筆 SENT，收件匣只收到 1 封。
- [ ] AC-AUD-06：PROMO 嘗試移除「行銷同意=true」篩選時 UI disabled；繞過 UI 呼叫發送 API 時，後端 HTTP 400 拒絕。
- [ ] AC-AUD-07：匯入 UTF-8 BOM 與 Big5 CSV 時 email 欄位正確解析，並回饋總筆數、格式有效、已在平台、已退訂、純外部與錯誤行原文。
- [ ] AC-AUD-08：外部 CSV 含已退訂信箱時，這些信箱被全域退訂排除，排除數明確顯示，不存在外部專用退訂繞過。
- [ ] AC-AUD-09：信件含 `{{name}}` 但外部聯絡人無 name 時，輸出通用稱呼 fallback，不出現原始佔位符。
- [ ] AC-AUD-10：收件池含進度與活躍度聚合條件、規模 300 人時，即時人數預覽 2 秒內回傳且 query plan 走 index，COUNT 有上限保護。
- [ ] AC-AUD-11：`emailVerified` 大量為 null 時，有效收件人定義不得只用 `emailVerified IS NOT NULL` 誤排，且預估與實際發送一致。
- [ ] AC-AUD-12：GENERAL 與 PROMO 建立 campaign 時，PROMO 強制鎖定行銷同意篩選；GENERAL 採告知與可退訂過濾；兩者退訂維度獨立。

### CONSENT 退訂與法遵
- [ ] AC-CONSENT-01：`marketingConsent IS NULL` 的舊匯入學員呼叫 `assertEmailConsent(userId,'marketing')` 時回 `allowed:false`。
- [ ] AC-CONSENT-02：促銷 campaign 名單含 NULL／false／true 時，只有 true 收到並記 SENT，NULL／false 記 SKIPPED 且無 SENT。
- [ ] AC-CONSENT-03：用戶點 `scope=marketing` 退訂後 30 秒內再觸發促銷信時，recipient 記 SKIPPED 且不實際送出。
- [ ] AC-CONSENT-04：GENERAL 的 `scope=general` 退訂只關閉 `generalEmailConsent`，不影響 `marketingConsent`，交易信仍可寄。
- [ ] AC-CONSENT-05：`country=HK` 且一般電子報未明確同意者被 SKIP；同條件 TW 用戶可寄並含退訂連結。
- [ ] AC-CONSENT-06：已退訂行銷信的用戶仍可收到購買確認與密碼重設交易信，但不會收到促銷信。
- [ ] AC-CONSENT-07：偽造退訂 token 請求 `/unsubscribe` 時回通用驗證失敗頁，固定時間比對且不洩漏 secret 錯誤差異。
- [ ] AC-CONSENT-08：將同一退訂 token 的 scope 從 `marketing` 改 `all` 後沿用 HMAC 時驗算失敗。
- [ ] AC-CONSENT-09：退訂 GET 僅驗身分並渲染頁面，不做 DB 寫入；實際退訂只透過 POST + CSRF 完成。
- [ ] AC-CONSENT-10：DB 短暫不可用時，用戶點退訂連結後顯示已收到／處理中，不回 404／500，DB 寫入以重試補上。
- [ ] AC-CONSENT-11：EDITOR 在使用者電子報狀態區只能唯讀；ADMIN 才能覆蓋，且覆蓋前彈法律風險警示並寫 `AdminLog(ADMIN_OVERRIDE_CONSENT)`。
- [ ] AC-CONSENT-12：任何角色都不得把已退訂用戶同意改回 OPTED_IN；同意只能由用戶本人經退訂／設定頁產生。
- [ ] AC-CONSENT-13：結帳同意步驟的學習電子報與促銷 checkbox 預設皆未勾，交易通知不需勾選即必寄；勾選促銷後寫 `EmailConsentLog`。
- [ ] AC-CONSENT-14：行銷信與一般信 header 含 `List-Unsubscribe` 與 `List-Unsubscribe-Post:One-Click`，頁尾含寄件人名稱、實體地址與繁中文案。
- [ ] AC-CONSENT-15：`SiteSetting` 頁尾實體地址未填時，啟動促銷 campaign 按鈕 disabled 並顯示明確錯誤，不進入 SENDING。
- [ ] AC-CONSENT-16：帳號刪除時 PII 清除，但同意與退訂舉證以去識別化保留至少 3 年。
- [ ] AC-CONSENT-17：`marketingConsentSource='admin_import'` 的同意記錄必有 AdminLog 記載 ADMIN、時間與 IP。
- [ ] AC-CONSENT-18：double opt-in 確認信僅含確認連結、無促銷／課程介紹；同一 email 24h 內第 2 封被 rate-limit 阻擋。
- [ ] AC-CONSENT-19：double opt-in 確認連結超過 48h 後點擊時顯示連結已過期，且不得改為 CONFIRMED。
- [ ] AC-CONSENT-20：用戶本人剛完成退訂後，系統不得再寄「你已退訂」確認信，除非是 ADMIN 代為退訂的交易性知會。

### DELIV 送達率與寄信健康
- [ ] AC-DELIV-01：`/api/webhooks/resend` 收到錯誤 svix 簽名時回 401 且不寫 DB；正確 permanent bounce 事件 5 秒內設定 `user.emailInvalidAt`。
- [ ] AC-DELIV-02：user 收到 permanent bounce 後，之後新 campaign 的健康掃描自動排除該 user，學員列表顯示紅色退信 Badge，且不會收到新信。
- [ ] AC-DELIV-03：同一地址連續 3 次軟退後轉 `SOFT_SUSPENDED` 並被 SKIPPED；cron 30 天後解鎖試一次，再失敗升 HARD，不無限輪迴。
- [ ] AC-DELIV-04：進行中 campaign 硬退率超過 2% 時自動切 PAUSED 停止後續寄送，需 ADMIN 手動解鎖；投訴率 >0.1% 黃色、>0.3% 紅色警告。
- [ ] AC-DELIV-05：ESP 拒絕、連線中斷、超量等失敗時，recipient／campaign 留 FAILED 與 `errorMessage`，並觸發後台 Bell 與寄信給 ADMIN。
- [ ] AC-DELIV-06：任一電子報 footer 缺平台名稱、聯絡 email 或退訂連結時，發送確認頁顯示阻擋錯誤；退訂連結 font-size ≥10px 且非極淡色。
- [ ] AC-DELIV-07：健康掃描有效收件人為 0 時，發送被阻擋並顯示可讀原因，campaign 不進入 SENDING。
- [ ] AC-DELIV-08：50,000 人名單打開確認頁時，排除摘要非同步計算不阻塞，確認頁 3 秒內回應且不 Query 逾時。
- [ ] AC-DELIV-09：同一 email 同時存在 Guest 與正式帳號時，campaign 名單以 email 去重只寄一封；退訂狀態對兩帳號同時生效。
- [ ] AC-DELIV-10：GENERAL 內文含優惠券碼或購買連結時，確認頁提示香港 PDPO 下夾帶推廣即屬直接促銷，建議改為促銷類型。
- [ ] AC-DELIV-11：email provider 未設定時，電子報後台顯示尚未設定寄信服務，只能存草稿、不可建立可發送 campaign。
- [ ] AC-DELIV-12：SPF／DKIM 未通過時，Email 設定頁顯示檢測狀態、警告與設定教學連結。

### ANALYTICS 成效分析與追蹤
- [ ] AC-ANALYTICS-01：寄出信件原始碼中的開信像素與點擊改寫 URL 均為客戶自有網域 `SITE_URL`，不含第三方追蹤服務網域。
- [ ] AC-ANALYTICS-02：點擊追蹤 redirect 目標由 token 從 DB 查 `NewsletterLink.targetUrl`，不從 query string 讀取，任意 redirect 參數無法造成 Open Redirect。
- [ ] AC-ANALYTICS-03：客戶未綁自有網域時，campaign 依降級策略使用現有可達網域或關閉追蹤並明確提示，不產生失效追蹤連結。
- [ ] AC-ANALYTICS-04：GENERAL 報表顯示開信／點擊／CTOR／退訂／投訴與各連結點擊分布且無營收區塊；PROMO 額外顯示歸因訂單、營收、RPE 與優惠券使用。
- [ ] AC-ANALYTICS-05：PROMO 信寄出後 30 分鐘內有開信點擊時，報表開信率與點擊率非零，且開信率旁顯示 Apple MPP 免責。
- [ ] AC-ANALYTICS-06：同一用戶在歸因窗口點兩封 PROMO 後購買一筆訂單時，營收只在 last-touch 主歸因那封計一次，另一封標多接觸點。
- [ ] AC-ANALYTICS-07：PROMO 寄出 7 天內點擊並付款時，購買轉換數與收益正確計入，報表文字說明歸因邏輯且可與 PostHog／GA 對帳。
- [ ] AC-ANALYTICS-08：測試信開信與點擊不計入任何統計與歸因。
- [ ] AC-ANALYTICS-09：匯出 campaign 收件人 CSV 預設匿名化不含 email；含個資版本需法遵警告與確認，並記 AdminLog。
- [ ] AC-ANALYTICS-10：2000 人信件大量開信造成高併發追蹤時，追蹤寫入經節流／批次聚合不拖垮 Zeabur 單實例 DB，追蹤失敗不影響信件顯示。
- [ ] AC-ANALYTICS-11：報表頁在發送後 1 小時內已有開信／點擊數據；未啟用追蹤時顯示啟用追蹤佔位，不顯示假數據。

### DESIGN 視覺與體驗
- [ ] AC-DESIGN-01：`/admin/newsletters` 使用 sticky 頁首、4 張 StatCard、密集表格、類型色條、狀態 Badge、篩選 Tabs、排序 Select、Pagination 與空狀態，風格符合現有後台與 Linear 質感。
- [ ] AC-DESIGN-02：電子報列表最左 4px 色條 GENERAL 為靛藍、PROMO 為琥珀，並同時顯示類型文字 Badge，不只依賴顏色。
- [ ] AC-DESIGN-03：`/admin/newsletters/[id]/edit` 採頂部固定 Bar、左欄結構導覽、中欄信紙畫布、右欄設定／收件／法遵 Tabs 的三欄布局。
- [ ] AC-DESIGN-04：一般與促銷模式切換時，模式標、可用區塊與預覽 CTA 色在約 200ms 內完成視覺轉換。
- [ ] AC-DESIGN-05：促銷送出主按鈕使用 cta variant（`bg-cta text-cta-foreground hover:bg-cta-hover`），一般主要操作使用 primary，並禁止新增不必要色票。
- [ ] AC-DESIGN-06：分眾選擇器以 Sheet／Dialog 呈現預設受眾卡、AND／OR 條件列、鎖定行銷同意條件與即時預估人數卡。
- [ ] AC-DESIGN-07：寄出的 GENERAL 信件呈現單欄、閱讀舒適、靛藍 CTA；PROMO 信件呈現課程視覺、價格層級、琥珀 CTA 與靜態優惠資訊，兩者皆保有克制高級質感。
- [ ] AC-DESIGN-08：所有電子報頁面都有 skeleton 載入、空狀態、錯誤狀態與 Sonner toast，且危險操作使用 Dialog 二次確認。
- [ ] AC-DESIGN-09：後台互動元件可鍵盤操作且有 focus-visible ring；信件與退訂頁具備語意 HTML、圖片 alt、明確 CTA、退訂連結對比與手機可讀字級。
- [ ] AC-DESIGN-10：在 `prefers-reduced-motion` 下，持續 pulse 動效停用並改以靜態文字進度表示。

## 排除範圍（Out of Scope）

- SMS、LINE、App Push、站內推播等非 Email 管道。
- 第三方拖拉式 EDM 編輯器（Unlayer／Stripo 等授權型服務）。
- 法律意見或對客戶所在地合規性的保證；系統提供最嚴格基準與明確提示。
- 多租戶共用 Email provider／共用寄信網域模式。
