# 金流與電子發票系統審查報告

> 審查日期:2026-06-22 ｜ 方法:11 維度多代理平行審查 + 對抗性紅隊驗證(81 agents)
> 範圍:Stripe / PayUni / SHOPLINE 三金流 + 台灣電子發票(綠界 ECPay / 藍新 ezPay)
> 場景:(a) 單課付費 (b) 組合包付費 (c) 退費含發票 (d) 優惠券

## 總體結論

不萬無一失。目前金流+發票系統存在 3 個 critical 與多個 high 級缺陷,在「啟用電子發票」「使用 ezPay/PayUni ATM-CVS」「組合包+單課重疊購買後退款」「金流後台帶外退款」等真實營運情境下會直接掉錢、掉權限、漏開/誤沖發票。三條金流(Stripe/PayUni/SHOPLINE)的退款狀態機與金額驗證強度嚴重不一致(Stripe 不驗金額且不處理任何退款 webhook;PayUni ATM/CVS 靠猜測欄位反推狀態;SHOPLINE 退款受理即當完成)。電子發票最致命:預設「會員載具」與 ezPay 路徑因參數/單號格式問題幾乎 100% 開立失敗且靜默累積。退款撤權普遍以 orderId 為唯一鍵,配合 upsertPaidPurchase 覆寫 orderId,在重疊購買下會誤撤或漏撤已付費課程。整體可上線販售「單純單課 + Stripe + 不開發票」的最小情境,但只要啟用發票或組合包或 ATM/CVS,即有真實財稅與客訴風險,必須先修完 critical/high 才能宣稱穩健。

**問題統計(去重後 34 項):** 🔴 Critical 3 ｜ 🟠 High 7 ｜ 🟡 Medium 9 ｜ ⚪ Low 9

原始 69 個發現,經對抗性驗證確認 51 真、過濾 18 誤報,合併重複後彙整為上述 34 項。

## 場景覆蓋評估

| 場景 × 金流/發票 | 狀態 | 說明 |
|---|---|---|
| (a) 單課付費 - Stripe | ⚠️ 有風險 | 核心開通在 transaction 內安全;但 Stripe 不驗金額一致性、開啟 allow_promotion_codes,商家若建 promo code 可少付款且發票按少收金額開立;無 charge.refunded webhook,Dashboard 退款不同步。 |
| (a) 單課付費 - PayUni | ❌ 損壞 | ATM/CVS 取號判別靠猜測欄位,欄位不符時待繳訂單被誤標 FAILED,後續真實付款被冪等吞掉→收錢不開通不開發票(H 級,接近 critical)。信用卡同步路徑相對安全。 |
| (a) 單課付費 - SHOPLINE | ⚠️ 有風險 | testConnection 缺 signKey 仍報成功(已被 settings 儲存阻擋緩解);成功事件缺金額欄位時放行(下游用 order.amount,風險有限)。開通本身可運作。 |
| (a) 單課付費 - 電子發票 | ❌ 損壞 | 預設『個人+會員載具』在 ECPay 一律開立失敗(被當需地址紙本);B2B 統編亦失敗;ezPay 因 orderNo 27>20 字全數失敗。啟用發票後最主流路徑開不出發票,靜默累積稅務違規。 |
| (b) 組合包付費 - 三金流共通 | ❌ 損壞 | 致命跨訂單問題:先單買 A 再買含 A 組合包,upsertPaidPurchase 覆寫 Purchase.orderId→組合包訂單;退組合包誤撤 A、退單課漏撤 A。付款窗內課程被刪會少授權或卡 PENDING。部分擁有仍收整包價。 |
| (c) 退費含發票 - Stripe | ⚠️ 有風險 | in-app 退款路徑可用;但無 refund/dispute webhook,Dashboard 退款或 chargeback 完全不同步(權限保留+發票不沖銷)。退款與撤權/回補非原子,中間失敗留孤兒且 guard 擋重試。 |
| (c) 退費含發票 - PayUni | ⚠️ 有風險 | 無自動退款 API(設計限制),先沖銷發票/撤權再提示人工退款,已有三重告警+AdminLog 緩解;殘留為人為疏失風險。 |
| (c) 退費含發票 - SHOPLINE | ❌ 損壞 | 退款 tradeOrderId 取得脆弱(sessionId 兜底可能打錯交易);受理即當完成且 refund.* 事件被忽略無對帳,受理後失敗會靜默不一致(權限已撤錢沒退)。 |
| (c) 退費含發票 - 折讓/作廢 | ⚠️ 有風險 | ezPay 折讓單號超長含 '-' 全失敗;折讓累計上限無鎖可超折;手動作廢/折讓不連動 Order/Purchase;後台 UI 不知 allowanceTotal 且 ALLOWANCE 後折讓按鈕消失(分次折讓不可達)。 |
| (d) 優惠券 - 全金流 | ⚠️ 有風險 | firstTimeOnly/maxPerUser/maxRedemptions 皆為 validate 端非原子 check,記錄端僅對總量原子守衛→建單到付款窗內可被多筆 PENDING 繞過(折扣外溢,有界損失)。零值交易(免費促銷+券)漏記兌換。訪客換 email 可繞首購。Stripe promo 可疊加平台券。 |

---

## 問題明細(依嚴重度排序)

### #1 🔴 CRITICAL — 電子發票:預設『個人/會員載具』在 ECPay 一律開立失敗(member 載具被丟棄→被當需地址的紙本發票)

- **子系統:** 發票開立
- **場景:** a, b, ecpay, ezpay
- **驗證信心:** high
- **位置:**
  - `lib/invoice/issue.ts:78-86`
  - `lib/invoice/issue.ts:48`
  - `app/(main)/checkout/checkout-client.tsx:95`
  - `node_modules/@paid-tw/einvoice-ecpay/dist/index.js:1001`
  - `node_modules/@paid-tw/einvoice-ecpay/dist/index.js:246-249`
- **問題:** 結帳預設 carrierType='member'(最常見消費者選項),但 buildIssueInput 只對 'mobile' 設 carrier,對 'member' 不做任何映射(SDK 其實支援 CarrierType.MEMBER)。member 送出時既無 carrier 也無 donation,ECPay 判定 print='1'(紙本)→要求 CustomerAddr 必填,而系統從無地址欄位→拋 VALIDATION。ezPay 同理走 PrintFlag='Y' 印製路徑。
- **影響:** 啟用電子發票(台灣課程平台預期上線狀態)後,凡消費者用預設『雲端發票/會員載具』結帳,自動與手動開立一律失敗。只有『手機條碼』與『捐贈』兩種會成功。長期靜默累積大量未開立發票=漏開統一發票稅務違規。
- **建議修法:** buildIssueInput 補 member 分支:PERSONAL 非 mobile 時設 input.carrier = { type: CarrierType.MEMBER }(MEMBER 不需 code,print 走 0 無紙本);ezPay MEMBER 映射為 '2' 需確保 buyerEmail 一定帶入(現已從 user.email 取得)。修正 issue.ts:48 誤導註解。maybeAutoIssueForOrder 失敗應標 FAILED 並後台告警/重試。補四型態(member/mobile/統編/捐贈)整合測試。

### #2 🔴 CRITICAL — 電子發票:ezPay provider 下所有發票開立失敗(orderNo 27 字超過 MerchantOrderNo 20 字上限)

- **子系統:** 發票開立
- **場景:** ezpay, a, b, c
- **驗證信心:** high
- **位置:**
  - `lib/payment/shared.ts:12-20`
  - `lib/invoice/issue.ts:57`
  - `lib/invoice/service.ts:148-149`
  - `node_modules/@paid-tw/einvoice-ezpay/dist/index.js:301`
  - `node_modules/@paid-tw/einvoice-ezpay/dist/index.js:627`
- **問題:** generateOrderNo() 產生 'ORD'+8位日期+16位hex = 27 字。orderNo 原樣當 ezPay MerchantOrderNo(限 max 20),27>20 每筆 ezPay 開立都拋 VALIDATION。後台『測試連線』用 14 字短單號會測試成功,讓管理員誤以為串接正常,上線後一張都開不出來。
- **影響:** 選用 ezPay(藍新)的站台,正式環境每一筆發票自動/手動開立全部失敗;且測試誤導性極高(測過、上線爆)。連帶 ezPay 折讓單號(35 字含 '-')也違規,使退款折讓亦全失敗。
- **建議修法:** 首選:縮短 generateOrderNo() 到 ≤20 字且僅 [A-Za-z0-9_](如 ORD+YYMMDD+9hex=18 字),一併避免 PayUni MerTradeNo 20 字風險;確認無硬解析固定長度處。或在發票層對 ezpay 做 provider 感知的確定性縮碼(同步套用到 allowanceId)。務必用真實 27 字單號跑 ezpay assertValidIssuePayload 測試,勿用 TEST 短單號。

### #3 🔴 CRITICAL — PayUni ATM/CVS 取號通知靠猜測欄位反推狀態,失敗時待繳訂單被誤標 FAILED→真實付款被冪等吞掉(收錢不開通不開發票)

- **子系統:** PayUni 金流
- **場景:** a, payuni-ATM, payuni-CVS
- **驗證信心:** high
- **位置:**
  - `app/api/payment/notify/route.ts:147-169`
  - `app/api/payment/notify/route.ts:137-141`
  - `lib/payment/payment-instructions.ts:200-247`
- **問題:** 區分『ATM/CVS 取號(需保留 PENDING)』與『付款失敗(標 FAILED)』的唯一依據,是 extractPayUniPaymentInstructions 能否以猜測式欄位名(PayNo/CodeNo/BarCode...)解析出待繳資訊。程式自承欄位名未對照實際驗證。欄位不符→instructions=null→newStatus=FAILED。之後第二段真正 SUCCESS 通知進來,line 138 冪等檢查 status!=='PENDING' 直接 return,不建 Purchase、不開發票、不寄信。FAILED 後永久無法回復,全無對帳/補單。
- **影響:** ATM/CVS(台灣金流主力)取號被誤判失敗,學員拿有效虛擬帳號繳費後,平台已實收款項但學員無課程權限、無發票。觸發條件(欄位名不符)由程式自承未驗證,實際存在。
- **建議修法:** 狀態判定改為以狀態語意為準、白名單失敗(SUCCESS→PAID;明確失敗碼→FAILED;其餘含解析失敗一律 PENDING),比照 SHOPLINE handler 的 pending 分支重寫。instructions 解析與狀態判定解耦。啟用前用 sandbox 抓真實欄位名。放寬冪等 guard 允許 FAILED→PAID 合法補救(金額相符)。加 trade-query 對帳排程。補取號/付款兩段 payload 單元測試。

### #4 🟠 HIGH — 組合包/單課重疊時退款以 orderId 撤銷 Purchase + upsertPaidPurchase 覆寫 orderId,導致誤撤已付費課程或退款漏撤(全金流共通)

- **子系統:** 退款/Purchase 狀態機(跨子系統)
- **場景:** b, c
- **驗證信心:** high
- **位置:**
  - `lib/purchase/upsert-paid-purchase.ts:91-118`
  - `lib/payment/post-payment-actions.ts:131-144`
  - `lib/actions/orders.ts:437-445`
  - `app/api/payment/create/route.ts:281-286`
  - `prisma/schema.prisma:778`
- **問題:** Purchase @@unique([userId,courseId]) 使同課只能一筆。upsertPaidPurchase 對既有有效 Purchase 無條件覆寫 orderId/source/bundleId。先單買 A(Order X)→再買含 A 組合包(Order Y,部分擁有被放行)→Purchase.orderId 被改成 Y。markAsRefunded 以 where{orderId} 撤銷:退 Y 連帶撤掉用戶單獨付費的 A;退 X 撈不到 A(漏撤,退錢仍保權限)。三金流+零元路徑共用此邏輯。
- **影響:** 用戶花錢買的課因不相關組合包退款被沒收(客訴/金錢爭議),或退款後仍永久觀看(金錢損失)。原始 orderId 被覆寫遺失,後台對帳/發票沖銷標的錯亂,事後難還原。注意:此為去重後合併 5 個重複 finding(分屬 SHOPLINE/組合包/退款/付款後/優惠券各維度)的同一根因。
- **建議修法:** (A)upsertPaidPurchase 對既有未撤銷 Purchase 不覆寫 orderId/source/bundleId,只更新 expiresAt 取 max(restore 分支可保留覆寫)。(B)markAsRefunded 撤權改為展開訂單課程集合,撤銷前檢查該 user+course 是否另有其他有效 PAID 訂單支撐,僅無其他來源時才 revoke。(C)create 對部分擁有組合包記錄『本訂單實際新授權的 courseId』供精準撤銷。根本解:引入 PurchaseGrant 多對多授權來源表,存取看任一有效 grant,退款只撤本訂單 grant。補單課→組合包雙向購買順序的退款 e2e 測試。

### #5 🟠 HIGH — Stripe 缺 charge.refunded/refund/dispute webhook handler:從 Dashboard 退款或 chargeback 不同步訂單、Purchase 與發票

- **子系統:** Stripe 金流
- **場景:** c
- **驗證信心:** high
- **位置:**
  - `app/api/webhooks/stripe/route.ts:252-291`
  - `lib/actions/orders.ts:375-459`
- **問題:** Stripe webhook 只處理 checkout.session.completed / async_payment_succeeded / async_payment_failed,完全沒有 charge.refunded / refund.* / charge.dispute.* 分支(全部掉到回 200 不做事)。退款副作用(撤 Purchase、回補券、沖銷發票)只集中在後台 markAsRefunded。只要退款不經本系統後台(Dashboard、客服、Stripe 風控、chargeback),系統永遠收不到也不反應。
- **影響:** Dashboard 退款後:用戶已被退錢但 Order 仍 PAID、Purchase 未撤銷(永久觀看)、優惠券未回補、發票未作廢/折讓(稅務不一致)。chargeback 更糟(錢被拿走+權限仍在)。台灣客服習慣直接在金流後台退款,觸發機率高。PayUni/SHOPLINE 同屬平台級缺口。
- **建議修法:** 新增 charge.refunded(+charge.dispute.created)分支,抽出與 markAsRefunded 等價但 webhook 安全的內部函式(不可再呼叫 gateway.processRefund 以免重複退款)。以 charge.payment_intent 反查 Order;以 event.id/refund.id 去重;比對 amount_refunded==amount 才全額撤銷(部分退款僅告警);發票沖銷失敗只告警。同步補 PayUni/SHOPLINE 退款回呼。加低頻對帳排程兜底。

### #6 🟠 HIGH — SHOPLINE 退款 tradeOrderId 鏈路脆弱:缺 tradeOrderId 時以 sessionId 充當,退款 API 帶錯 ID 失敗,管理員卡死無法退款

- **子系統:** SHOPLINE 金流
- **場景:** c
- **驗證信心:** medium
- **位置:**
  - `app/api/webhooks/shopline/route.ts:210`
  - `app/api/webhooks/shopline/route.ts:300-301`
  - `app/api/webhooks/shopline/route.ts:331-332`
  - `lib/payment/shopline-gateway.ts:198-216`
  - `lib/actions/orders.ts:415-419`
- **問題:** 退款用 order.stripePaymentIntentId 當 SHOPLINE tradeOrderId,而其值來自 webhook 的 `data.tradeOrderId || data.sessionId`,成功路徑未要求 tradeOrderId 真的存在;建 session 時也只寫 stripeSessionId。session 類成功事件很可能只帶 sessionId→退款 API 把 session id 當 trade id 送出→SHOPLINE 找不到交易退款失敗→rollback 回 PAID,管理員只見『退款失敗』不知根因,SHOPLINE 無 requiresManualAction 降級路徑可完全卡死。
- **影響:** 已付款 SHOPLINE 客戶可能無法退款,且根因隱蔽。confidence medium 因無法從 repo 確認 SHOPLINE 成功事件 trade id 確切欄位位置(blast radius 取決於實際事件組合),但鏈路與卡死後果真實。
- **建議修法:** 停止用 `tradeOrderId || sessionId` 兜底寫 stripePaymentIntentId;stripeSessionId 寫 sessionId,stripePaymentIntentId 只接受真正 trade order id(比照 40ab285 從官方 model 巢狀路徑取)。取不到時記高優先告警,或以 sessionId 查單 API 補齊。為 SHOPLINE 加類似 PayUni 的 requiresManualAction 人工退款降級路徑。補 session.succeeded(只帶 sessionId)不污染 stripePaymentIntentId 的測試。

### #7 🟠 HIGH — SHOPLINE 退款受理(2xx)即當完成且 refund.* 事件被忽略無對帳,受理後失敗會靜默不一致

- **子系統:** SHOPLINE 金流
- **場景:** c
- **驗證信心:** medium
- **位置:**
  - `lib/payment/shopline-gateway.ts:209-224`
  - `lib/actions/orders.ts:414-459`
  - `app/api/webhooks/shopline/route.ts:83-93`
- **問題:** processRefund 只要 refund/create 回 2xx 就回 success,不檢查 SHOPLINE 退款 status;orders.ts 隨即撤 Purchase、回補券、沖銷發票。但 SHOPLINE 退款常非同步(受理≠完成),且 webhook 把 refund.* 歸為 other 忽略,無任何處理器確認最終結果,無對帳。
- **影響:** 退款受理後若實際被拒(餘額不足/爭議中/卡組織拒絕),系統已撤權+回補券+作廢發票但客戶沒拿到錢,且無事件能對帳回 PAID。權限/金流/發票三方靜默不一致。需管理員手動退款觸發,但發生即嚴重。
- **建議修法:** processRefund 解析 response status:SUCCESS→success;PROCESSING/PENDING→success+requiresManualAction(延後撤權至 webhook 確認);FAILED→success:false。新增 refund.succeeded/refund.failed webhook:succeeded 才確認撤權/沖銷(冪等);failed 對帳回 PAID、恢復 Purchase(revokedAt=null)、恢復券、發票若已作廢告警人工復原。Stripe 同步補 refund webhook 一致化。

### #8 🟠 HIGH — 電子發票:公司/統編(B2B)發票在 ECPay 永遠開立失敗(缺買方地址被當紙本發票)

- **子系統:** 發票開立
- **場景:** a, ecpay
- **驗證信心:** high
- **位置:**
  - `lib/invoice/issue.ts:53-76`
  - `node_modules/@paid-tw/einvoice-ecpay/dist/index.js:1001-1027`
  - `node_modules/@paid-tw/einvoice-ecpay/dist/index.js:246-253`
  - `prisma/schema.prisma:677-682`
- **問題:** COMPANY 發票設 buyer.name/ubn/email 但不設 buyer.address(Order 無地址欄位)。ECPay B2B 無 carrier 時 print='1',要求 CustomerAddr 必填→VALIDATION 失敗。失敗只進 log。
- **影響:** 選 ECPay 的站台,所有需統編三聯式發票的公司客戶(客單價通常最高、最在意發票)完全拿不到發票,管理員不易察覺。
- **建議修法:** 首選:結帳 COMPANY 區塊新增公司地址輸入,Order 新增 invoiceBuyerAddress,buildIssueInput COMPANY 分支設 buyer.address。次選(無紙本):B2B 帶 CarrierType.MEMBER 走 print=0 雲端發票避開地址必填。同時修 PERSONAL 無載具路徑(同根因),並為 maybeAutoIssueForOrder 失敗加後台可見告警。核對 ezPay B2B 欄位。

### #9 🟠 HIGH — 自動開立發票為 fire-and-forget 且失敗後永不重試:訂單轉 PAID 後 webhook 重送也不再觸發

- **子系統:** 發票開立/可靠性
- **場景:** a, b, ecpay, ezpay
- **驗證信心:** high
- **位置:**
  - `app/api/webhooks/stripe/route.ts:223-234`
  - `app/api/payment/notify/route.ts:138-141`
  - `lib/payment/post-payment-actions.ts:234`
  - `lib/invoice/service.ts:199-210`
- **問題:** executePostPaymentActions 以非 await fire-and-forget 呼叫;加值中心逾時/字軌不足時 Invoice 停在 FAILED 或未建立。此時訂單已 PAID,webhook 後續重送在『已處理』早退,不再呼叫 post-payment,無任何自動重試。issueInvoiceForOrder 雖支援 FAILED→重試但無排程/重送觸發,僅 console.error,需人工逐筆補開。
- **影響:** 暫時性失敗後發票永久停在未開立/FAILED,無人監看則靜默漏開,放大『付了款卻沒發票』法定開立期限的合規曝險。授權本身(Purchase)在 transaction 內安全。
- **建議修法:** (B 關鍵)建立 CRON_SECRET 保護的補償 cron endpoint(比照既有 cron route,Zeabur 外部排程觸發),掃描 status=PAID & amount>0 & (無 Invoice 或 FAILED) 的訂單呼叫 issueInvoiceForOrder(冪等可重入),分流永久錯誤不重試。(A)關鍵 side effect 改 await 或用 next/server after()。(C)重試後仍 FAILED 寫後台可見告警。後台訂單列表加發票狀態維度篩選/彙總。

### #10 🟠 HIGH — Stripe webhook 無條件以 amount_total 覆寫 order.amount 且不驗金額一致性 + allow_promotion_codes 開啟,可少付款取得完整授權

- **子系統:** Stripe 金流/金額完整性
- **場景:** a, b, d, stripe
- **驗證信心:** high
- **位置:**
  - `lib/payment/stripe-gateway.ts:37`
  - `app/api/webhooks/stripe/route.ts:148-185`
  - `app/api/webhooks/stripe/route.ts:214`
- **問題:** stripe-gateway 無條件 allow_promotion_codes:true(Checkout 出現優惠碼欄位,可疊加平台券);webhook 以 amount_total 直接覆寫 order.amount 且全程無 `stripeAmountTotal === order.amount` 比對就轉 PAID 並開通。對照 PayUni/SHOPLINE 都有金額不符→400,唯獨 Stripe 缺。發票按覆寫後(較低)金額開立,couponDiscount 仍是原值對不上。Stripe Price 漂移(後台改價未同步)也會靜默接受。
- **影響:** 商家若在 Stripe 建 promo code,買家可少付款仍開通完整課程、發票按少收金額開立,直接少收款。即使無 promo,『不驗金額盲信閘道並覆寫』違反後端金額為準原則,三閘道安全不一致。觸發需商家端建 promo/改價未同步,非匿名買家開箱即用,故 high 非 critical。合併自多個 Stripe 金額相關 finding。
- **建議修法:** allow_promotion_codes 預設 false(或 SiteSetting 開關預設關,有平台券時強制關)。webhook 轉 PAID 前加金額相等檢查,不符回 400(讓 Stripe 重送)+告警+標記稽核。移除對 order.amount 的覆寫,以後端 order.amount 為唯一事實來源。修 syncCourseToStripe 靜默吞錯。

### #11 🟡 MEDIUM — 金流退款與撤權/回補/發票沖銷非原子,中間失敗留『已退款但仍有權限』孤兒且 guard 擋重試

- **子系統:** 退款/狀態機
- **場景:** a, b, c
- **驗證信心:** high
- **位置:**
  - `lib/actions/orders.ts:398-459`
  - `lib/actions/orders.ts:394-396`
- **問題:** markAsRefunded 三段非原子:搶鎖 PAID→REFUNDED → gateway 退款 → 另起 transaction 撤 Purchase/回補券。若第三段因 DB 故障拋例外,落到外層 catch 回錯,但訂單已 REFUNDED、錢已退、Purchase 未撤、券未回補。重試時開頭 guard(status!=='PAID')直接擋,永遠走不到撤權。
- **影響:** 用戶被退錢仍保有課程(白嫖),券名額永久佔用。存取可用 revokeCourseAccess 自助補救(故非『只能改 DB』),但券回補無 UI。觸發需退款成功後第三段恰逢 DB 故障,窄條件。
- **建議修法:** 把第三段改為對 REFUNDED 可重入的冪等補償,提供後台『重新同步退款後果』action(所有操作天然冪等)。第三段失敗時 try/catch 回 {success:true, warning},標記 needsReconcile/寫 AdminLog,而非當整筆失敗讓管理員盲目重試被擋。

### #12 🟡 MEDIUM — ezPay 退款折讓永遠失敗(allowanceId 35 字含 '-' 違反 MerchantOrderNo 格式)

- **子系統:** 發票折讓/退款
- **場景:** c, ezpay
- **驗證信心:** high
- **位置:**
  - `lib/invoice/service.ts:285`
  - `node_modules/@paid-tw/einvoice-ezpay/dist/index.js:735`
  - `node_modules/@paid-tw/einvoice-ezpay/dist/index.js:407`
- **問題:** allowanceId=`${orderNo}-A${...}`=35 字且含 '-',ezPay MerchantOrderNo 限 ≤20 且僅 [A-Za-z0-9_],每筆 ezPay 折讓拋 VALIDATION。實務上因 ezPay 開立(rank 2)已先壞,折讓多半到不了;但屬同根因應一併修。
- **影響:** 選 ezPay 站台退款發票折讓沖銷一律失敗(僅 warning),管理員未察覺則『已退款但發票稅額仍存在』帳務不一致。應與 rank 2 合併為同一張票處理。
- **建議修法:** allowanceId 改 ≤20 且僅 [A-Za-z0-9_]、不含 '-',並對重試/逾時用冪等折讓序號(非時間戳)避免重複折讓。同步修開立 orderId 正規化。保留 provider 單號↔內部 orderId 對照供對帳。ECPay 路徑回歸測試確認未受影響。

### #13 🟡 MEDIUM — 優惠券 firstTimeOnly/maxPerUser/maxRedemptions 三項 validate 端非原子,建單到付款窗內可被繞過(折扣超賣)

- **子系統:** 優惠券驗證/競態
- **場景:** a, d
- **驗證信心:** high
- **位置:**
  - `lib/actions/coupons.ts:401-453`
  - `lib/payment/coupon-redemption.ts:46-58`
  - `app/api/payment/create/route.ts:316-356`
- **問題:** firstTimeOnly 查 Purchase、maxPerUser/maxRedemptions 查/比對計數,皆在事務外、建單前 validate 一次,計數只在付款成功才遞增。記錄端僅對 maxRedemptions 做 timesRedeemed<max 原子守衛,且超賣時只 console.warn 仍放行折扣。帶券訂單不復用 PENDING,可同時存在多筆。用戶在無 Purchase/未滿狀態下併發或連續建多單付款,全部繞過每人/首購/總量限制。
- **影響:** 首購券/每人限用券被同一人多次套用,限量券實際折扣成交可超過 N→折扣外溢金錢損失。損失有界(每次須真實付款換真實課程),非無中生有,故 medium。合併自多個重複的優惠券競態 finding。
- **建議修法:** 在付款成功的同一事務內(recordCouponRedemption)對 firstTimeOnly/maxPerUser 加記錄端原子守衛(tx 內重查 count/Purchase);maxRedemptions 改為建單事務內條件式佔位 increment(count===0 即 rollback 回『已達上限』),PENDING 逾時/取消釋放名額。最穩健:為 (couponId,userId) 引入唯一鍵/配額表用 P2002 當原子閘門。偵測超用時開通但不給該筆折抵並告警。

### #14 🟡 MEDIUM — 手動作廢/折讓不連動 Order.status 與 Purchase,造成『發票已作廢/折讓但用戶仍持課且訂單仍 PAID』

- **子系統:** 發票折讓與作廢/跨系統一致性
- **場景:** a, b, c
- **驗證信心:** high
- **位置:**
  - `lib/invoice/service.ts:212-304`
  - `lib/actions/einvoice.ts:244-291`
  - `lib/actions/orders.ts:434-459`
- **問題:** voidInvoiceForOrder/allowanceInvoiceForOrder(及其 action)只操作 Invoice,不檢查/更新 Order.status、不撤 Purchase、不回補券。UI 折讓 Dialog 文案『退款/退課沖銷』主動誘導管理員把折讓當退款用,但執行後 Order 仍 PAID、Purchase 仍有效、券名額仍佔、營收仍計入。
- **影響:** 稅務已對買受人開全額折讓/作廢,但用戶仍可觀看付費課程、營收仍計入、券未釋放→金額/權限/稅務三方脫鉤。受 requireOnlyAdminAuth 保護(非外部攻擊),屬內部一致性/UI 誘導問題,medium。
- **建議修法:** (a)把退款設為唯一金流/權限沖銷入口,折讓/作廢改標示為『僅更正發票,不退款不撤課』並修文案。(b)若保留獨立全額折讓/作廢作退款替代,全額時連帶呼叫與 markAsRefunded 共用的撤權+回補+Order→REFUNDED 邏輯(抽共用函式)。service 層至少加防呆:全額沖銷前若 Order 仍 PAID 則拒絕或一併處理。組合包沿用 updateMany({orderId})。

### #15 🟡 MEDIUM — 優惠券驗證階段與兌換階段之間券失效(過期/停用/滿量/最低消費)未在付款成功時複驗(TOCTOU 超發折扣)

- **子系統:** 優惠券兌換/狀態機
- **場景:** a, b, d
- **驗證信心:** high
- **位置:**
  - `app/api/payment/create/route.ts:316-334`
  - `app/api/webhooks/stripe/route.ts:203-211`
  - `app/api/payment/notify/route.ts:205-213`
  - `lib/payment/coupon-redemption.ts:39-58`
- **問題:** 券所有業務驗證只在建單時 validateCoupon 一次,couponId/couponDiscount 凍結進 Order。付款成功 webhook 在 recordCouponRedemption 完全不複驗券是否仍有效,只記凍結折抵並遞增計數。ATM/CVS 取號可延遲數天才付款,期間券可能已過期/停用/滿量。
- **影響:** 失效券(過期/停用)的 PENDING 訂單仍可付款並以折扣價成交;限量券在多用戶先建 PENDING 後可全部折扣成交(計數封頂但折扣發 N 份)。屬營收洩漏,無金額竄改/重複開通,medium。
- **建議修法:** 付款成功同一事務內、recordCouponRedemption 之前以最新狀態複讀券(active/起迄/timesRedeemed/最低消費),四處共用點抽到 recordCouponRedemption 統一處理。讓其回傳結果供呼叫端決策;失效/超量改寫結構化告警+AdminLog 供對帳。限量券場景縮短 PENDING 有效期或券失效時主動取消未付款訂單。

### #16 🟡 MEDIUM — Stripe webhook 以回傳金額覆寫 order.amount,發票金額與 couponDiscount/後台折扣顯示跨系統不一致

- **子系統:** Stripe 金流/發票一致性
- **場景:** a, b, d
- **驗證信心:** high
- **位置:**
  - `app/api/webhooks/stripe/route.ts:148-176`
  - `app/api/webhooks/stripe/route.ts:204-210`
  - `lib/invoice/service.ts:104-155`
  - `lib/payment/post-payment-actions.ts:234`
- **問題:** webhook 用覆寫後 order.amount 開發票,同事務又用建單時凍結的 couponDiscount 寫 CouponRedemption,後台折扣顯示用 originalAmount-amount。三者基準不一致;搭配 allow_promotion_codes 使 Stripe 端折扣滲透到發票與帳務但無對應 couponId 紀錄。
- **影響:** CouponRedemption.amount 與實際總折抵不符(財報帳目漂移),後台折扣顯示與券紀錄對不上。發票金額本身=實付(自洽),非錯。一般未套 Stripe promo 時覆寫為 no-op,只在啟用 Stripe 促銷時浮現。與 rank 10 同源,可一併修。
- **建議修法:** 覆寫前比對 stripeAmountTotal 與 order.amount:相等則不覆寫;小於(套 Stripe 促銷)則告警並把 amount_discount 明細回寫、重算 couponDiscount/CouponRedemption.amount(或拆欄位分記平台券與 Stripe 促銷);大於則異常告警。比照 PayUni notify 加金額一致性守衛。若不用 Stripe 原生促銷,直接關 allow_promotion_codes 從源頭消除。

### #17 🟡 MEDIUM — PayUni 人工退款時發票先作廢/折讓但實際退款未完成→跨系統不一致

- **子系統:** 退款/跨系統一致性
- **場景:** c
- **驗證信心:** high
- **位置:**
  - `lib/actions/orders.ts:411-480`
  - `lib/payment/payuni-gateway.ts:68-76`
  - `lib/invoice/service.ts:316-335`
- **問題:** PayUni processRefund 不呼叫任何 API,回 success+requiresManualAction;markAsRefunded 繼續撤權+回補券+作廢/折讓發票(對加值中心真實不可逆呼叫),之後才提示『請至 PayUni 後台手動退款』。錢實際還沒退,訂單已 REFUNDED、發票已沖銷。
- **影響:** 若管理員未完成手動退款→『發票已作廢但顧客款項仍被收取』。已有退款前黃色 banner、12 秒 warning toast、AdminLog 三重緩解,屬 PayUni 無退款 API 的本質限制+人為疏失,medium。
- **建議修法:** 對 requiresManualAction===true 採二段式:第一段標記待退款(暫不撤權/不動發票,記 AdminLog+UI『待人工退款』待辦);管理員於 PayUni 後台退款後點『確認已退款』才撤權/沖銷/轉 REFUNDED。Stripe/SHOPLINE 維持單段原子。最低限度:requiresManualAction 時跳過自動發票沖銷,改雙待辦徽章+手動觸發按鈕。refund-dialog 加強制勾選 checkbox。

### #18 🟡 MEDIUM — 折讓累計上限為無鎖 read-modify-write,並發折讓可對加值中心超折超過發票金額

- **子系統:** 發票折讓/競態
- **場景:** c
- **驗證信心:** high
- **位置:**
  - `lib/invoice/service.ts:263-299`
- **問題:** allowanceInvoiceForOrder 先讀 allowanceTotal 算 remaining 檢查,最後 update 覆寫(非 increment),全程無事務/鎖/CAS;且 provider.allowance() 在 DB update 之前。兩個並發(退款自動折讓 + 管理員手動折讓,或雙擊)讀到相同 alreadyAllowed、各自通過檢查、各自對加值中心開折讓單,累計超過發票金額。
- **影響:** 對財政部開出超發票金額的折讓(違反累計折讓上限稅務不變式),需人工作廢善後;allowanceTotal 少記。admin-only 低頻,前端 disabled 擋單 session 雙擊,真正可重現是退款自動折讓與手動折讓並發,medium。
- **建議修法:** 採『先佔位、後打 API、失敗退位』:API 前以 updateMany(where allowanceTotal=alreadyAllowed,data increment)原子搶名額,count===0 即中止不打 API;搶到才呼叫 provider.allowance(),失敗則條件式 decrement 退回;成功後寫 allowanceNumber/status。remaining 檢查併入 where 條件。markAsRefunded 與手動折讓對同發票加互斥(或手動折讓 order.status===REFUNDED 時拒絕)。

### #19 🟡 MEDIUM — ezPay 折讓 ItemTaxAmt 以含稅金額×5% 計算,與宣告稅額(splitTaxInclusive)不一致,明細加總≠TotalAmt

- **子系統:** 發票稅額計算/折讓
- **場景:** c, ezpay
- **驗證信心:** high
- **位置:**
  - `lib/invoice/issue.ts:99-115`
  - `node_modules/@paid-tw/einvoice-ezpay/dist/index.js:746-748`
- **問題:** buildAllowanceInput 把 item.amount/unitPrice 設為含稅毛額,ezPay allowance() 用 ItemTaxAmt=round(amount×0.05)、ItemAmt=含稅毛額,造成 ItemAmt+ItemTaxAmt≠TotalAmt(1000 例:1000+50≠1000;稅額 50≠正確 48),藍新折讓 API 會退件。ECPay 自洽不受影響。目前被 ezPay 折讓單號(rank 12)阻擋,修好前置才會真正打到藍新。
- **影響:** ezPay 折讓單明細稅額與總額對不上被退件/對帳爭議。被前置 bug 遮蔽尚未在 production 觸發,medium。
- **建議修法:** buildAllowanceInput(及 buildIssueInput)讓傳給 ezPay 的 item 金額用未稅 salesAmount、ItemTaxAmt 直接用 splitTaxInclusive 的 taxAmount(非重算毛額×5%),確保 Σ(ItemAmt 未稅)+Σ(ItemTaxAmt)===TotalAmt。需 provider 分流(ECPay 含稅、ezPay 未稅+稅額語意相反),改 ECPay 時同步檢查 vat 對映。補 invariant 測試(105/525/999/1050/1234)。並行修 rank 12 否則打不到藍新。

### #20 🟡 MEDIUM — 組合包部分擁有不折價也不阻擋,且 upsertPaidPurchase 覆寫既有單課/免費/手動授權來源

- **子系統:** 組合包購買/金額計算
- **場景:** b
- **驗證信心:** high
- **位置:**
  - `app/api/payment/create/route.ts:281-300`
  - `app/(main)/checkout/page.tsx:154-175`
  - `lib/purchase/upsert-paid-purchase.ts:91-118`
- **問題:** 組合包重複購買檢查只在『擁有全部課程』時擋,部分擁有照原價買整包不折抵已擁有課程價值,checkout/銷售頁價格框與 CTA 不反映已擁有。upsertPaidPurchase 對既有未撤銷 Purchase 一律把 source 改 BUNDLE、覆寫 orderId(連 FREE_ENROLL/ADMIN_GRANT 都降級)。
- **影響:** 用戶為已擁有課程重複付費(體感重複收費,有 badge 部分揭露);原始授權來源/orderId 被覆寫遺失→與 rank 4 的退款歸屬錯亂同源。原報告稱『放大 critical 退款』經查 source 不參與退款決策(退款只看 orderId),故下修 medium。
- **建議修法:** (A 最低成本)結帳/銷售頁部分擁有時顯示警語『已擁有 M/N 門仍以整包價計費』。(B)部分擁有也擋下並提示改買缺漏單課。(C 比例計費)需替 BundleCourse 加單課定價欄位再動態計算。source/orderId 覆寫修法見 rank 4(既有未撤銷不覆寫)。server 端保持權威重算。

### #21 🟡 MEDIUM — 付款窗內組合包課程被刪除/移出,付整包價拿不到全部課,或整包課全刪使訂單卡 PENDING

- **子系統:** 組合包/狀態機
- **場景:** b
- **驗證信心:** high
- **位置:**
  - `prisma/schema.prisma:314-326`
  - `lib/payment/post-payment-actions.ts:117-129`
  - `app/api/payment/create/route.ts:191-208`
  - `lib/actions/courses.ts:457`
  - `lib/actions/bundles.ts:263`
- **問題:** grantPaidOrderAccess 即時重查 bundle.courses(無下單快照)。建 PENDING 組合包訂單後,管理員 deleteCourse(Cascade 刪 BundleCourse)或 updateBundle(deleteMany 重建,完全無 PENDING 檢查)縮減清單→付款成功時用戶少拿課;若全刪(length===0)程式 throw 使付款交易回滾→訂單永久卡 PENDING、用戶付錢無課、無救援。下單只驗 bundle.status 不驗成員 course.status。
- **影響:** 付款與授權窗內課程被刪/移出造成靜默少授權,甚至付錢卡 PENDING 無自動恢復無告警。需管理員在窗內動作,發生率低但資料完整性後果實在,medium。
- **建議修法:** 下單時把 itemCourseIds 寫入訂單快照,grantPaidOrderAccess 依快照建 Purchase,不符時告警/考慮按比例退差。length===0 不要 throw 回滾,改標記已付款待人工處理+盡力建可建部分+告警,絕不讓金流持續 500 重送。deleteCourse/updateBundle 移除課程前檢查該 bundle 是否有 PENDING(未過期)訂單牽涉,有則拒絕/提示。

### #22 🟡 MEDIUM — 後台折讓 UI 不知 allowanceTotal:分次折讓在 UI 不可達(ALLOWANCE 後按鈕消失)且預設/上限仍用整張金額

- **子系統:** 發票折讓 UI/功能落差
- **場景:** c
- **驗證信心:** high
- **位置:**
  - `components/admin/orders/invoice-actions.tsx:31-37`
  - `components/admin/orders/invoice-actions.tsx:60-65`
  - `components/admin/orders/invoice-actions.tsx:201-205`
  - `app/(admin)/admin/orders/[id]/page.tsx:62-68`
  - `lib/actions/orders.ts:85-96`
- **問題:** InvoiceInfo 不帶 allowanceTotal,折讓 Dialog 預設值與 max 都用整張發票金額;canVoidOrAllow=status==='ISSUED',一旦變 ALLOWANCE 整個作廢/折讓區塊消失→service 層宣稱支援的分次折讓在 UI 根本無法觸發第二次。
- **影響:** 分次折讓 UI 不可達(功能落差),UI 對 allowanceTotal 全盲。但超折已被 action(正整數)+service(remaining 上限)雙重擋住,無法被誘導超折/寫錯金額,故 medium 非 high。
- **建議修法:** INVOICE_SELECT 與型別加 allowanceTotal 並傳入 UI;折讓 Dialog remaining=amount-allowanceTotal,預設與 max 用 remaining,提示改『剩餘可折讓』。拆 canVoid(僅 ISSUED)與 canAllow(ISSUED 或 ALLOWANCE)兩旗標,讓分次折讓可續做。

### #23 🟡 MEDIUM — 折讓 allowanceId 以時間戳生成非冪等,加值中心逾時重試會重複開出折讓單(ECPay)

- **子系統:** 發票折讓/冪等
- **場景:** c
- **驗證信心:** high
- **位置:**
  - `lib/invoice/service.ts:285`
  - `lib/invoice/issue.ts:94-115`
- **問題:** allowanceId 帶 Date.now() 不具冪等性。ECPay allowance 雖不使用 allowanceId(折讓號由 ECPay 產),但 provider.allowance() 逾時實際已成功時,service catch 回失敗不寫 DB,管理員重試會在 ECPay 真的開出第二張折讓→超額退稅。slice(-6) 碰撞論點實務上弱;ezPay 端另受 rank 12 格式問題。
- **影響:** ECPay 折讓逾時重試導致重複折讓單超折。需逾時+重試的邊界,medium。
- **建議修法:** allowanceId 改用該發票的折讓序號(原子遞增/由 allowanceTotal 推導)使同次折讓重試用同一 id;格式 ≤20、僅 [A-Za-z0-9_](解 ezPay)。逾時/不確定結果時先預占 seq 記 pending allowanceId,重試沿用;或重試前以 query 比對是否已存在。

### #24 🟡 MEDIUM — PayUni gatewayPaymentInstructions 被 ATM 取號分支整欄覆寫,清掉 __courseInvite metadata,邀請制課程 ATM 付款邀請用量不遞增(可超 maxUses 重用)

- **子系統:** PayUni 金流/邀請碼
- **場景:** payuni-ATM, payuni-CVS, invite-only
- **驗證信心:** high
- **位置:**
  - `app/api/payment/notify/route.ts:155-163`
  - `lib/payment/post-payment-actions.ts:45-92`
  - `lib/payment/course-invite-order-metadata.ts:43-55`
  - `app/api/payment/create/route.ts:433-435`
- **問題:** create 把 __courseInvite 寫入 gatewayPaymentInstructions JSON,notify 的 ATM/CVS 取號分支用 instructions 整欄覆寫(無 merge)清掉邀請 metadata。付款成功時 consumeInviteForPaidOrder 讀不到 metadata→usedCount 永不遞增。SHOPLINE webhook 有 preserveCourseInviteMetadata 證明此為已知需求,PayUni 漏做。
- **影響:** INVITE_ONLY 課程以 ATM/CVS 付款,邀請連結 usedCount 不增→maxUses 數量限定被繞過可重複使用(買家仍付全額,非金錢損失;email 限定仍受 email 比對把關)。信用卡不受影響,隱蔽,medium。
- **建議修法:** notify select 加 gatewayPaymentInstructions,取號分支用 preserveCourseInviteMetadata(從 shopline 抽共用)合併保留 __courseInvite。長期:把邀請 metadata 與待付款取號資訊拆成 Order 不同欄位。consumeInviteForPaidOrder 改用 consumeCourseInviteToken 的原子條件式(usedCount<maxUses)合一驗證+扣量。補取號→成功 notify 後 usedCount===1 測試。

### #25 ⚪ LOW — 零元(折後=0)訂單因 couponDiscount 為 falsy 漏記 CouponRedemption,限量/每人上限被繞過

- **子系統:** 優惠券/金額計算
- **場景:** d, a
- **驗證信心:** high
- **位置:**
  - `app/api/payment/create/route.ts:468-476`
  - `app/api/webhooks/stripe/route.ts:204`
  - `app/api/payment/notify/route.ts:206`
  - `app/api/webhooks/shopline/route.ts:364`
- **問題:** 四處兌換守衛用 `if (couponId && couponDiscount)`,當商品本身價格=0(免費促銷 salePrice=0)或極小金額 percentOff 進位成 0 時 couponDiscount=0(falsy)→有套券但不記 CouponRedemption、不遞增 timesRedeemed。原報告頭號場景(percentOff=100)經查折抵=price 非零不觸發。
- **影響:** 零值交易上 maxRedemptions/maxPerUser 不計數→對免費/零折抵品項可繞過上限,後台對帳少算。Purchase unique 擋同課重領,無金錢損失,low。
- **建議修法:** 四處守衛改為 `if (couponId != null)`,allow amount=0(recordCouponRedemption 接受 amount:0,冪等/上限邏輯不受影響)。額外:validateCoupon 對 priceBeforeCoupon===0 早退判定不適用,從源頭杜絕零值交易套限量券。

### #26 ⚪ LOW — 退款回補 timesRedeemed 與『上限已滿時未遞增』不對稱,可使計數低於實際(輕微超賣)

- **子系統:** 優惠券/票券計數一致性
- **場景:** c, d
- **驗證信心:** high
- **位置:**
  - `lib/actions/orders.ts:448-458`
  - `lib/payment/coupon-redemption.ts:46-58`
- **問題:** 兌換時超賣分支 create redemption 列成功但 timesRedeemed 未+1(只 warn);退款時只要刪到列就 -1。退掉一筆『當初沒+1』的超額訂單會把計數扣低於真實有效兌換,釋出不該釋出的名額。
- **影響:** 限量券在『超賣後又退該超額單』的窄邊界下計數漂移、輕微超發。{gt:0} 防負不會 crash,low。
- **建議修法:** 根因優先:讓兌換驗證+遞增原子化(先原子+1 再授權,滿則 rollback)使 redemption 列數≡timesRedeemed 恆成立,退款維持現狀即對稱。或 CouponRedemption 加 countedTowardLimit 旗標,退款僅對 counted===true decrement。超賣分支寫 AdminLog 供稽核。

### #27 ⚪ LOW — PayUni Replay 防護依賴通知含 Timestamp,缺欄位時時間窗檢查整段跳過(取號階段可重放重寫)

- **子系統:** PayUni 金流/重放
- **場景:** payuni-ATM, payuni-CVS, replay
- **驗證信心:** high
- **位置:**
  - `app/api/payment/notify/route.ts:72-81`
  - `lib/payment/payuni-crypto.ts:148-176`
- **問題:** 15 分鐘重放窗以 decryptedData.Timestamp 為基礎,`if (notifyTimestamp > 0)` 表示缺 Timestamp/為 0 時整段檢查略過,重放保護退化為僅靠狀態機。SUCCESS 通知被狀態機完全兜底;但取號 updateMany 在 status 仍 PENDING 時可被重放重寫(僅能重放同一簽章內容,GCM 保證無法竄改)。
- **影響:** 成功通知重放無害(冪等良好);取號階段可重複寫入相同值(DB 寫入放大+與 metadata 覆寫疊加),危害極低,屬縱深防禦不足,low。
- **建議修法:** 不採『缺 Timestamp 即拒絕』(可能擋掉正式通知)。對取號 updateMany 加守衛僅在 gatewayPaymentInstructions 未設定/內容不同時才寫;或引入通用 webhook 去重表(EncryptInfo hash 或 TradeNo+Status 組合 @unique,P2002 即重放回 OK),可一併涵蓋 Stripe/SHOPLINE。

### #28 ⚪ LOW — 重新開立(re-issue)會清空 voidedAt/allowanceNumber/allowanceTotal,使已作廢/折讓歷史在同列被覆蓋

- **子系統:** 發票一致性/稽核
- **場景:** c
- **驗證信心:** high
- **位置:**
  - `lib/invoice/service.ts:107-177`
- **問題:** issueInvoiceForOrder 只在 status==='ISSUED' 略過;對 VOIDED/ALLOWANCE 列(orderId @unique 單列模型)會重新開立並清空 voidedAt/allowanceNumber/allowanceTotal、覆寫 invoiceNumber。UI 雖不顯示『開立』按鈕,但 action 對 VOIDED/ALLOWANCE 沒擋,手動作廢後 Order 仍 PAID,直接呼叫 action 可覆蓋作廢痕跡。
- **影響:** 作廢/折讓的發票號與折讓痕跡在重開時同列被抹除,財稅稽核難還原。admin-only+需繞 UI+真實加值中心多半會以重複單號拒絕+有 AdminLog 軌跡,low。
- **建議修法:** service 層 issueInvoiceForOrder 對既有 invoice 狀態白名單:VOIDED/ALLOWANCE 直接回 {success:false,'已作廢/折讓不可在同訂單重開,請改走新訂單'},使 service 成為單一防線(同時保護 action 與付款 hook)。若業務需作廢後重開,改一對多歷史模型(移除 orderId @unique)。

### #29 ⚪ LOW — 退款只支援全額,partial refund 與『組合包退單門課/講義退費』場景無法表達

- **子系統:** 退款/發票/功能缺口
- **場景:** b, c
- **驗證信心:** high
- **位置:**
  - `lib/validations/order.ts:82-88`
  - `lib/payment/stripe-gateway.ts:95-98`
  - `lib/actions/orders.ts:399-445`
  - `lib/invoice/service.ts:316-335`
- **問題:** refundSchema 只有 orderId+reason 無金額;processRefund 不帶 amount 一律全額退;markAsRefunded 整單 PAID→REFUNDED 並 revoke 該訂單全部 Purchase;發票同期作廢/跨期全額折讓。資料模型(Order 單一 amount、bundle 無 per-course 價、Invoice 一單一張)根本無法表達部分退款,且 UI 已正確揭露全單語意。
- **影響:** 業務若需部分退款(退組合包一門課、退講義費)現行只能整單退。屬功能設計缺口,在『僅全額退』模型內所有行為一致正確,low。
- **建議修法:** (1)若僅支援全額退(最可能):維持現狀,refund-dialog 加註『不支援部分退款』即可。(2)若確需部分退款(須先確認需求):跨層開發 — 資料模型補可表達部分的結構(OrderItem/per-course 價/refundedAmount)、refundSchema 加 amount/courseId、processRefund 帶 amount、revoke 僅指定 courseId、OrderStatus 加 PARTIALLY_REFUNDED、發票走既有 allowanceInvoiceForOrder 部分折讓、券回補重新定義。stakeholder 未確認前傾向 (1)。

### #30 ⚪ LOW — post-payment side effects 非交易內 fire-and-forget,serverless 下有漏寄/漏開脆弱性(現行 Zeabur 長駐不觸發)

- **子系統:** 冪等/可靠性
- **場景:** a, b
- **驗證信心:** high
- **位置:**
  - `app/api/webhooks/stripe/route.ts:223-234`
  - `lib/payment/post-payment-actions.ts:155-234`
  - `lib/invoice/service.ts:199-210`
- **問題:** executePostPaymentActions 整體 Promise 未被 handler await,handler 在它完成前 return 200。serverless 回應後可能回收執行環境砍掉 side effect。註解自打嘴巴(內層 await 對外層不 await 無延長效果)。
- **影響:** 授權(Purchase)在交易內安全;發票/寄信不可靠。但本平台部署模型唯一為 Zeabur 長駐 Docker(local volume 與 Vercel serverless 不相容),長駐 process 中未 await Promise 會跑完,所述漏開實質不觸發。屬移植到真 serverless 才會踩雷的潛在脆弱性,low(與 rank 9 的『無重試』為不同面向但相關,rank 9 才是現行真實風險)。
- **建議修法:** 見 rank 9(對帳補償 cron 為最終事實來源)。額外:移除誤導性註解;關鍵 side effect 改 await 或 next/server after()。

### #31 ⚪ LOW — SHOPLINE testConnection 缺 Sign Key 仍報『連線成功』,易誤導上線後 webhook 全被拒

- **子系統:** SHOPLINE 金流/設定一致性
- **場景:** a, b, c, d
- **驗證信心:** high
- **位置:**
  - `lib/payment/shopline-gateway.ts:280-286`
  - `lib/payment/shopline-gateway.ts:355-363`
  - `app/api/webhooks/shopline/route.ts:161-173`
- **問題:** testConnection 缺 signKey 仍回 success:true(綠色『連線成功』),但 verifyWebhookSignature 在 signKey 空時回 false→webhook 回 400 拒收。
- **影響:** 誤導性 UX。但災難後果已被 settings.ts:749-758 阻擋(缺 signKey 無法把 SHOPLINE 設為主用金流),純訊息清晰度問題,low。
- **建議修法:** testConnection 缺 signKey 回 status:'incomplete'(非 success:true),UI 改琥珀色『設定未完成:webhook 尚無法運作』+toast.warning,訊息呼應 settings 儲存阻擋規則。可順帶在 gateway-factory 對 shopline 加 signKey 必填檢查堵預設殘留缺口。

### #32 ⚪ LOW — 訪客以不同 email 重複結帳可繞過 firstTimeOnly/maxPerUser(每 email 一個 guest User)

- **子系統:** 優惠券/安全
- **場景:** d
- **驗證信心:** high
- **位置:**
  - `lib/actions/coupons.ts:430-454`
  - `app/api/payment/create/route.ts:137-152`
- **問題:** maxPerUser/firstTimeOnly 以 userId 為界,guest checkout 對每個未註冊 email 建新 guest User,同一真人換 email 即得新 userId 可重複領首購/每人限用券。程式碼註解(M28)已承認為產品決策。
- **影響:** 限量/首購優惠可被同一人多 email 重複領(行銷預算外溢)。總量 maxRedemptions 仍硬封頂,且每次須真實付款換真實課程,blast radius 有限,low。
- **建議修法:** (a 最小)對 firstTimeOnly/maxPerUser>0 券拒絕 guest(isGuest)套用,要求登入。(b)guest 訂單套此類券改付款後寄 email 驗證,未驗證不認列首購。(c)以付款指紋跨 userId 比對。維持現狀(僅靠總量)在不需嚴格 per-user 管控時亦可接受。

### #33 ⚪ LOW — 退款 AdminLog 記錄在所有 side effect 之後且 logAdminAction 吞例外,部分失敗時遺失『誰退的款』稽核

- **子系統:** 安全/稽核
- **場景:** c
- **驗證信心:** high
- **位置:**
  - `lib/actions/orders.ts:482-495`
  - `lib/actions/orders.ts:126-145`
- **問題:** PROCESS_REFUND 的 AdminLog 寫在撤權/回補/沖銷全部完成之後;若第三段 transaction 在 log 前拋錯則無 AdminLog。且 logAdminAction try/catch 吞所有錯誤,DB 寫 log 失敗時退款仍標成功但無紀錄。
- **影響:** 退款部分失敗或 log 失敗時遺失『誰在何時退款』。但 Order row 仍保留 status/refundedAt/reason/amount/gateway(只缺 who),非完全無軌跡,且需 DB 故障才觸發,low。
- **建議修法:** 金流退款成功且訂單轉 REFUNDED 後立即先寫一筆 AdminLog(誰/何時/哪筆/金額/gateway),後續結果再補記。logAdminAction catch 內把失敗以獨立 error channel 醒目記錄。Order 增 refundedBy 欄位讓 who 直接落在訂單列,消除單點依賴。

### #34 ⚪ LOW — member 會員載具於結帳被接受但開立時靜默丟失,變成無載具雲端發票(與 rank 1 同根因,ECPay 已 critical)

- **子系統:** 發票一致性
- **場景:** a, b
- **驗證信心:** high
- **位置:**
  - `lib/validations/einvoice.ts:101-150`
  - `lib/invoice/issue.ts:78-88`
  - `app/(main)/checkout/checkout-client.tsx:225-229`
- **問題:** schema 允許 member 且不要求 carrierId,但 buildIssueInput 無 member 分支,開立時不帶任何載具走 B2C 一般雲端發票;前端對 member 也只送 carrierId=''。注意:在 ECPay 此根因會升級為 rank 1 的開立失敗;此 finding 描述的是『成功開出但未掛預期載具』的較輕後果面向。
- **影響:** 選會員載具的買家發票未掛具名載具,需自行至加值中心查找(因帶 email 仍可歸戶)。無金額/重複開立風險,low。
- **建議修法:** 見 rank 1(補 member→CarrierType.MEMBER 映射)。若要真正支援具名會員載具則 UI 補載具識別碼輸入+schema 校驗;若暫不支援則 UI 文案移除『會員載具』字眼避免誤導。

---

## 附錄:被判定為誤報的發現(供參考,確認系統在這些面向是正確的)

- **[Stripe 金流]** TWD 金額乘 100：Stripe 視 TWD 為 zero-decimal 貨幣，造成實際扣款為訂單金額的 100 倍
  - 判定:誤報。發現的核心前提「TWD 是 Stripe 的 zero-decimal currency,charge 不可乘 100」與 Stripe 官方文件直接牴觸。
- **[Stripe 金流]** 降級用 price_data 模式下 order.amount 可能被中途資料庫值帶入，與建立 session 時金額脫鉤的時序風險
  - 判定:逐行讀過 create/route.ts、stripe-gateway.ts、webhooks/stripe/route.ts 後,判定此發現為誤報(無可重現的攻擊路徑),最多只是防禦縱深的觀察。
- **[PayUni 金流]** notify 不驗證訂單實際 paymentGateway 是否為 payuni,跨閘道訂單可被 PayUni 通知處理
  - 判定:程式碼觀察本身屬實:app/api/payment/notify/route.ts:98-113 的 select 確實未取 paymentGateway,且全檔無 `if (order.paymentGateway !== 'payuni')` 守衛;gateway-factory.ts:177-183 的 getGatewayByType('payuni') 也確實會直接讀 PayUni 金鑰,不論當前 active gateway 為何。但「跨閘道狀態污染」作為可被利用的安全漏洞被高估,理由如下:
- **[SHOPLINE 金流]** SHOPLINE 成功事件缺金額欄位時放行付款並開通，繞過『回傳金額=訂單金額』不變式
  - 判定:程式碼確實如描述:app/api/webhooks/shopline/route.ts:259-281 在 isSuccess 且三個金額 fallback(data.order.amount.value / data.payment.paidAmount.value / data.amount.value)全缺時,只 console.warn 不 return,接著照常 PENDING→PAID、grantPaidOrderAccess、recordCouponRedemption。但這不是真實可被攻擊者利用的不變式破口,理由如下:
- **[SHOPLINE 金流]** pending webhook 會以新事件無條件覆寫 stripeSessionId / stripePaymentIntentId / stripeResponse，且不檢查事件時序，可能用較舊事件覆寫退款參考
  - 判定:該發現的核心因果鏈不成立,屬誤報,因為它忽略了狀態機守衛。逐行查證如下:
- **[發票折讓與作廢]** 退款自動沖銷的『同期作廢 vs 跨期折讓』判斷未考慮 ECPay 作廢截止日（次月13日前），跨月退款可能選到會被加值中心拒絕的作廢
  - 判定:誤報。逐行讀完 lib/invoice/service.ts:316-350(syncInvoiceForRefund + isSameTaiwanInvoicePeriod)、:213-243(voidInvoiceForOrder)、lib/actions/orders.ts:461-474、以及 ECPay SDK 後,該發現的兩個核心前提都不成立:
- **[發票折讓與作廢]** 退款後若 syncInvoiceForRefund 選擇『折讓』，折讓金額硬編為發票全額，與『部分退款』情境不一致(且退款本身不支援部分,埋下未來地雷)
  - 判定:所有事實陳述都查證屬實,但這不是「會發生的問題」,而是對未來假設功能的潛在維護性觀察。
- **[優惠券驗證]** 券同時掛 courses 與 bundles 範圍未被禁止,組合包折抵歸因混淆,退費部分沖銷無法按課攤提
  - 判定:逐行查證後,發現該發現混合了「一個成立但無害的小事實」與「一連串不成立的衍生影響」。
- **[優惠券驗證]** 組合包 priceBeforeCoupon 未檢查促銷是否過期(salePrice ?? price),連帶污染最低消費判定與百分比折扣基數
  - 判定:誤報。發現的核心前提不成立。
- **[優惠券驗證]** 用券折抵後 0 元訂單走零元直通路徑且不開立發票,需確認與發票留痕政策一致
  - 判定:程式碼路徑與描述相符,但這不是 bug,而是正確且一致的設計。逐行查證:
- **[優惠券驗證]** 帶券 PENDING 訂單反覆建立無清理,放大 maxRedemptions/maxPerUser 在途超賣時間窗
  - 判定:核心主張(殭屍 PENDING 帶券單會「放大 maxRedemptions/maxPerUser 在途超賣時間窗」)在實際程式碼中不成立,屬誤報。逐行查證:
- **[優惠券兌換與競態]** 退款 timesRedeemed 回補對『不同訂單』可能不足以反映共用同一 coupon 的多筆,但 decrement 無 orderId 對應性問題(計數可被其他並發退款搶扣)
  - 判定:逐行查證後,此發現描述的「decrement 固定 -1 與 deleted.count 脫鉤導致計數漂移」在目前程式碼中不會發生,屬未來擴充的假設性 robustness 備註,非真實缺陷。
- **[退款流程(課程/講義)]** 完全不支援部分退款，且未驗證退款金額不可超過實付（全額退款寫死）
  - 判定:所有「事實」陳述屬實,但結論被誤導:把「缺少部分退款功能」(feature gap)包裝成「超額退款金錢損失」(security defect)。逐項查證:
- **[組合包購買]** 零元/被券折到 0 元的組合包繞過 FREE_COURSE 守衛,仍記優惠券兌換並佔用名額
  - 判定:逐行讀過 create/route.ts、coupon-redemption.ts、coupons.ts(validateCoupon)、post-payment-actions.ts(grantPaidOrderAccess)、free-course.ts、bundle.ts(schema/validation)、bundles/[slug]/page.tsx、checkout-client.tsx 後,確認「程式碼機制描述屬實」但「安全/正確性的論點不成立」,屬誤報。
- **[組合包購買]** 曾被購買的組合包硬刪會觸發 onDelete:Restrict DB 例外且無友善攔截(目前僅 archive,屬潛在缺口)
  - 判定:逐行查證後，schema 描述屬實但結論不成立。schema.prisma:698 (Order.bundle) 與 :775 (Purchase.bundle) 確實為 onDelete: Restrict。lib/actions/bundles.ts 只匯出 create/update/get/archiveBundle，archiveBundle 僅 status='ARCHIVED'（行 324-327），全檔無任何 delete。全 repo grep `bundle.delete` / `deleteBundle` / `bundle.deleteMany` / `prisma.bundle.delete` 皆零命中；app/api 下無任何 bundle 刪除路由；唯一呼叫者 components/admin/bundles/bundle-list.tsx:49 呼叫的是 archiveBundle。換言之，現行 shipped code 完全沒有任何會觸發 `prisma.bundle.delete()` 的執行路徑——這個「DB 例外未被友善攔截」的情境在當前程式碼中不可達。發現本身也自承「設計上正確（保護訂單/發票稽核鏈）」。onDelete: Restrict 在這裡正是正確的防禦性護欄，正在做它該做的事；它擋的是一個根本不存在的操作。所謂問題完全建立在「日後若有人新增刪除路徑」或「手動進 Prisma Studio 硬刪」這種假設性前提上，前者是不存在的未來程式碼、後者是 DBA 繞過應用層的手動操作（任何 ORM 都無法把 raw DB 操作包成友善訊息，也不該由應用層負責）。這不是當前系統的可重現缺陷，而是一個推測性/防禦性備註。對照金額計算、冪等、競態、簽章、狀態機等審查重心，本項與金錢/權限/資料一致性皆無關。故 isReal=false，嚴重度由 low 下修為 info。
- **[訂單建立與金額完整性]** 零元課程 + 優惠券路徑繞過免費引導,並消耗優惠券總量/每人名額於 0 元折抵
  - 判定:逐行查證後,此發現的核心危害(「消耗優惠券總量/每人名額於 0 元折抵、timesRedeemed +1」)不成立,屬誤報;僅殘留一個無金錢/名額影響的次要 Purchase source 標記不一致。
- **[付款後動作與跨系統一致性]** 購買確認信 / 管理員通知信 / 訪客啟用信缺冪等鍵，雖被訂單狀態閘門保護但補償/重跑時會重複寄送
  - 判定:事實描述正確:只有課程歡迎信有資料層冪等(course-welcome-email-service.ts:65-90 + EmailDeliveryLog @@unique([type,orderId,courseId]),schema.prisma:842),而 sendPurchaseConfirmation(post:237)、sendAdminPurchaseNotification(post:246/258)、sendGuestActivationEmail(post:269)、PostHog payment_succeeded(post:199) 確實無任何去重鍵;EmailDeliveryType enum(schema.prisma:630-635)也確實只有 COURSE_WELCOME 等四型,沒有上述三型。我也確認 sendGuestActivationEmail(guest-activation.ts:36-60)每次呼叫都會無條件 issueGuestActivationToken 產生新的有效 token。
- **[付款後動作與跨系統一致性]** 退款撤銷權限與發票折讓未同交易，且 invoiceDate 缺失時作廢/折讓判斷可能選錯
  - 判定:逐行查證後,兩段主張分別處理:
