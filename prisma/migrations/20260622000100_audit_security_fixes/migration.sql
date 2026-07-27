-- 安全 / 金流稽核修正對應的 schema 變更。
-- 對應程式碼修正：歡迎信冪等（H4）、優惠券兌換冪等（M9）、發票分次折讓累計（M12）。
--
-- ⚠️ 冪等性（買斷產品多客戶部署必備）：DROP 一律 IF EXISTS、CREATE 一律 IF NOT EXISTS、
--    ADD COLUMN 亦 IF NOT EXISTS，確保在以 db push 建立、無 migration 歷史的既有客戶資料庫
--    上 baseline 後套用、或重複套用皆安全。

-- H4：歡迎信冪等鍵加入 courseId。
--     原本 (type, orderId) 唯一，導致組合包訂單僅第一門課寄出歡迎信；
--     改為 (type, orderId, courseId) 後每門課各自寄送一次。
--     （新鍵為舊鍵的超集；舊鍵既已唯一，新鍵必唯一，故建立 UNIQUE 不會因既有資料而失敗。）
DROP INDEX IF EXISTS "EmailDeliveryLog_type_orderId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "EmailDeliveryLog_type_orderId_courseId_key" ON "EmailDeliveryLog"("type", "orderId", "courseId");

-- M9：優惠券兌換以「訂單」為唯一，作為 webhook 重送 / 重複處理時的冪等兜底，
--     避免同一訂單重複計入 timesRedeemed。
DROP INDEX IF EXISTS "CouponRedemption_orderId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");

-- M12：發票新增「累計已折讓金額」欄位，支援分次（部分）折讓並正確累計上限。
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "allowanceTotal" INTEGER NOT NULL DEFAULT 0;
