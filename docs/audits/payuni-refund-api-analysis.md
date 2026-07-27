# PAYUNi 一鍵退款可行性分析報告

日期：2026-07-24
結論一句話：**可以做到一鍵退款。** PAYUNi 官方本來就有退款 API，我們程式裡「PAYUNi 沒有自動退款 API」的註解是錯的（當初沒串，不是 PAYUNi 不提供）。woomp 的一鍵退款就是打同一支 API。

---

## 1. woomp 是怎麼做到一鍵退款的？

**是真的打 PAYUNi API，不是本地改狀態，也不是走別家金流。** woomp 實作了兩條路徑：

### 路徑 A：WooCommerce 原生退款按鈕

`includes/payuni/src/gateways/AbstractGateway.php:463-504` 實作 WooCommerce 的 `process_refund()` hook：

```php
$args = [
    'MerID'     => $this->get_mer_id(),
    'TradeNo'   => $order->get_meta( '_payuni_resp_trade_no' ),
    'TradeAmt'  => $amount,
    'Timestamp' => time(),
    'CloseType' => 2,   // 2 = 退款（已請款後退費）
];
$parameter['EncryptInfo'] = \Payuni\APIs\Payment::encrypt( $args );
$parameter['HashInfo']    = \Payuni\APIs\Payment::hash_info( $parameter['EncryptInfo'] );
wp_remote_request( $this->get_api_url() . 'api/trade/close', $options );
```

只有信用卡（`payuni-credit`）與分期（`payuni-credit-installment`）宣告 `supports = ['products', 'refunds', ...]`，所以這顆按鈕只對信用卡訂單出現。

### 路徑 B：訂單轉「已退款」狀態自動觸發（涵蓋所有 payuni-* 付款方式）

`includes/payuni/src/gateways/Refund.php:226-282`，掛在 `woocommerce_order_status_changed`：

1. 先打 `api/trade/query` 查 `CloseStatus`。
2. `CloseStatus = 1`（請款申請中）→ 打 **`api/trade/cancel`** 取消授權。
3. `CloseStatus = 2 / 7`（已請款 / 請款處理中）→ 打 **`api/trade/close`**（CloseType: 2）退款。
4. `3 / 9` → 不用動作。

失敗時訂單備註會寫「統一金流退款失敗，請至統一金流後台手動退款」——這反證它平常是真的打 API。

### 簽章方式（與我們現有實作完全一致）

`includes/payuni/src/apis/Payment.php:124-153`：AES-256-GCM（key=HashKey, iv=HashIV），`EncryptInfo = hex(密文 + ':::' + base64(tag))`，`HashInfo = strtoupper(sha256(HashKey + EncryptInfo + HashIV))`。**不需要額外金鑰、不需要商家後台申請開通**，跟付款用同一組 HashKey/HashIV。

### 對照：woomp 裡的綠界 / 藍新 / SmilePay 反而沒有退款 API 實作

`includes/ry-woocommerce-tools/` 目錄 grep 不到任何 refund 程式碼——那幾家的「退款」只是 WooCommerce 本地記錄。所以「一鍵退款」這件事，woomp 恰恰是在 PAYUNi 上做得最完整。

---

## 2. PAYUNi 官方是否真的有退款 API？

**有。** 證據：

- **PAYUNi 官方 SDK**（GitHub org `payuni`，統一資訊/PRESCO）：
  - [PHP_SDK README](https://github.com/payuni/PHP_SDK) 明列 `交易請退款 => trade_close`、`交易取消授權 => trade_cancel`。
  - [PHP_SDK 原始碼 src/PayuniApi.php](https://raw.githubusercontent.com/payuni/PHP_SDK/main/src/PayuniApi.php)：`trade_close → 'trade/close'`、`trade_cancel → 'trade/cancel'`，base URL `https://api.payuni.com.tw/api/`（sandbox `https://sandbox-api.payuni.com.tw/api/`）。
- **正式上線的開源外掛**「Pay with PAYUNi」（wpbrewer，wordpress.org 上架）：[src/Api/PaymentRequest.php](https://plugins.svn.wordpress.org/wpbr-payuni-payment/trunk/src/Api/PaymentRequest.php) 的 `refund()` 就是 POST `https://api.payuni.com.tw/api/trade/close`。

### API 規格（官方 SDK + 正式外掛交叉驗證）

| 項目 | 內容 |
|---|---|
| 退款端點 | `POST https://api.payuni.com.tw/api/trade/close`（sandbox 換網域） |
| 取消授權端點 | `POST https://api.payuni.com.tw/api/trade/cancel` |
| 交易查詢端點 | `POST https://api.payuni.com.tw/api/trade/query`（Version 2.0） |
| Form 欄位 | `MerID`、`Version`、`EncryptInfo`、`HashInfo`（同現有 requestApi 格式） |
| 退款 EncryptInfo | `MerID`、`TradeNo`（PAYUNi 交易序號，**不是** MerTradeNo）、`Timestamp`、`CloseType=2`、`TradeAmt`（退款金額） |
| 取消授權 EncryptInfo | `MerID`、`TradeNo`、`Timestamp` |
| 加密/簽章 | AES-256-GCM + SHA256 HashInfo，**與本站 `lib/payment/payuni-crypto.ts` 完全相同** |

### 規則與限制

- **CloseStatus 狀態機**（[CloseStatus.php](https://plugins.svn.wordpress.org/wpbr-payuni-payment/trunk/src/Utils/CloseStatus.php)）：`1` 請款申請中、`2` 請款成功、`3` 請款取消、`7` 請款處理中、`9` 未申請。**已請款（2）才能退款；未請款（1/3/9）走取消授權。** wpbrewer 外掛 v1.7.1 起限定 CloseStatus=2 才允許退款。
- **部分退款**：單次刷卡支援（金額可小於原交易）；**分期必須全額退**。
- **開通**：無證據需要向 PAYUNi 申請——一般商店金鑰即可呼叫（這點與「續期收款」不同，續期才需要開通）。
- 第三方文件稱信用卡退款限請款後 1 年內，未能從官方來源證實，實作時以 API 回傳錯誤為準。
- 注意：第三方文件寫 `/trade_close`（底線）是錯的，官方 SDK 與正式外掛都是 `/api/trade/close`（斜線）。金額欄位以正式外掛使用的 `TradeAmt` 為準（第三方文件寫 `CloseAmt`）。

---

## 3. 我們目前的程式卡在哪？

**不是平台限制，是當初沒串。** 而且基礎設施幾乎全現成：

| 現況 | 位置 |
|---|---|
| `processRefund()` 寫死回傳 `requiresManualAction: true`，不收參數、不發請求 | `lib/payment/payuni-gateway.ts:198-206` |
| 這個 stub 其實是**死代碼**——`markAsRefunded()` 在 `orders.ts:506` 用 `if (!isPayUni)` 明確跳過它，PAYUNi 走自己的 PENDING_MANUAL 人工分支 | `lib/actions/orders.ts:430-502` |
| 退款對話框的「我已在 PAYUNi 後台完成全額退款」勾選框 | `components/admin/orders/refund-dialog.tsx:214-239` |
| **加解密/簽章/伺服器呼叫 helper 全部現成**：`PayUniService.requestApi()`（form POST + EncryptInfo/HashInfo + 驗簽解密 + timeout），任何新 PAYUNi 幕後 API 直接複用 | `lib/payment/payuni-crypto.ts:253-307` |
| **TradeNo 已有存**：單次付款訂單存在 `order.stripePaymentIntentId`（欄位重用，`app/api/payment/notify/route.ts:198`）；訂閱各期訂單存在 `order.gatewayPaymentId`（`app/api/payment/period-notify/route.ts:98,240`） | — |

全倉搜尋 `trade/close`、`trade/cancel`、`CloseTrade`：**零匹配**，確認從未實作過。

---

## 4. 實作方向（讓 markAsRefunded() 一鍵完成）

### 4.1 `lib/payment/payuni-gateway.ts`：實作真正的 processRefund()

1. 新增端點 getter（比照現有 `periodQueryUrl()` 模式，sandbox/正式雙網域）：
   - `tradeQueryUrl()` → `/api/trade/query`
   - `tradeCloseUrl()` → `/api/trade/close`
   - `tradeCancelUrl()` → `/api/trade/cancel`
2. `processRefund({ gatewayPaymentId, orderNo })` 改為：
   - 取 TradeNo（訂閱期款用 `gatewayPaymentId`；單次付款注意目前存在 `stripePaymentIntentId` 欄位——呼叫端傳對即可）。
   - 先打 `trade/query`（Version 2.0）查 CloseStatus。
   - CloseStatus `1/3/9`（未請款）→ `trade/cancel` 取消授權；`2/7`（已請款）→ `trade/close`（CloseType=2、TradeAmt=訂單全額）。
   - 回應 `Status === 'SUCCESS'` → `success: true`；失敗 → 回傳錯誤，**由呼叫端決定是否降級為人工流程**。
3. 全程用 `PayUniService.requestApi()`，不用重寫加密。

### 4.2 `lib/actions/orders.ts`：markAsRefunded() 改流程

- 把 `orders.ts:506` 的 `if (!isPayUni)` 拿掉，PAYUNi 也走 `gateway.processRefund()`。
- **保留人工流程當降級備案**：API 退款失敗（例如商家權限問題、超過期限、網路錯誤）時，不要直接報錯死——回到現在的 PENDING_MANUAL 分支（設待辦 + 提示去後台手動退），舊的勾選確認路徑整個保留。這樣就算 PAYUNi 端有任何意外，流程也不會比以前差。
- 後續的 `finalizeOrderRefund()`（改狀態、撤權、退優惠券、沖銷發票）**完全不用動**，API 成功後直接接上去，就是「退款＋收權限＋退發票一次到位」。

### 4.3 `components/admin/orders/refund-dialog.tsx`：UI 調整

- 主要路徑不再有「先去 PAYUNi 後台」的勾選框，按「確認退款」就直接打 API。
- API 失敗降級時，才顯示現在的人工確認勾選框（可依 `refundStatus === 'PENDING_MANUAL'` 條件渲染，這個邏輯已存在）。

### 4.4 注意事項

- **訂閱期款**同樣適用：每一期都是一筆獨立 PAYUNi 交易（有各自 TradeNo），退哪期就對哪期的 TradeNo 打 `trade/close`；現有「退首期＝取消整筆訂閱」的連動邏輯不變。
- **ATM/CVS（離線繳費）不適用**：PAYUNi 對 ATM/CVS 的退款是商家後台轉帳（手續費 10 元），`trade/close` 只對信用卡類有效。實作時依 `order.paymentMethod` 判斷，ATM/CVS 訂單維持人工流程。
- 建議先用 sandbox（`sandbox-api.payuni.com.tw`）驗證三個端點，特別是退款金額欄位名稱（`TradeAmt`）與 CloseStatus 狀態機。
- 上線後把 `payuni-gateway.ts:199`、`orders.ts:390/428`、`lib/payment/types.ts:95`、`lib/subscription/renewal.ts:830/940`、`lib/email-templates.ts:1850` 這幾處「PAYUNi 無自動退款 API」的過時註解一併更新。

### 工作量評估

小。加密層、HTTP 層、finalize 層全部現成；新程式主要是 3 個端點 getter + `processRefund()` 約 60-80 行 + orders.ts 分支調整 + dialog 條件渲染調整。風險點只有一個：PAYUNi 文件站是 JS 渲染無法直接抓，規格是從官方 SDK 原始碼與正式外掛交叉驗證的，sandbox 實測一次即可確認。

---

## 結論

- **能不能一鍵？能。** PAYUNi 有官方退款 API（`/api/trade/close` + `/api/trade/cancel` + `/api/trade/query`），不需要額外申請開通，用現有商店金鑰即可。
- **woomp 沒有走別的金流**——它對 PAYUNi 信用卡訂單就是打這支 API，跟我們要串的是同一件事，可以直接對照。
- **現在的兩步驟流程不是平台限制，是當初沒串。** 實作後建議保留人工流程作為 API 失敗時的降級備案，以及 ATM/CVS 訂單的既定路徑。
