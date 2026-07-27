-- AlterTable: 加入 Meta CAPI Purchase event idempotency 欄位
-- 原因：2026-04-28 發現 Pixel + CAPI 多計 64-100%，需要 server-side dedup flag
-- 安全：可空欄位，所有現有訂單 metaCAPIFiredAt = NULL（視為尚未 fire）
--      新訂單付款時透過 post-payment-actions.ts check + set 此欄位
ALTER TABLE "Order" ADD COLUMN "metaCAPIFiredAt" TIMESTAMP(3);
