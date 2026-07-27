-- 課程訂閱制 (2/3)：既有表 Order / User 加欄位
-- 冪等：ADD COLUMN IF NOT EXISTS / CREATE (UNIQUE) INDEX IF NOT EXISTS。
-- 不含新 enum 型別、不使用 (1/3) 剛加入的 enum 值。

-- Order：每期扣款 = 一張 Order(PAID)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "periodNumber" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "gatewayPeriodKey" TEXT;

-- User：Stripe 顧客識別（find-or-create 後持久化）
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

-- gateway 每期冪等鍵唯一
CREATE UNIQUE INDEX IF NOT EXISTS "Order_gatewayPeriodKey_key" ON "Order"("gatewayPeriodKey");
-- 一個訂閱同一期只能一張 Order
CREATE UNIQUE INDEX IF NOT EXISTS "Order_subscriptionId_periodNumber_key" ON "Order"("subscriptionId", "periodNumber");
-- 期款查詢
CREATE INDEX IF NOT EXISTS "Order_subscriptionId_idx" ON "Order"("subscriptionId");
