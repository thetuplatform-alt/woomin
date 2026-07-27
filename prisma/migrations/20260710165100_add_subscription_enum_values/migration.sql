-- 課程訂閱制 (1/3)：既有 enum 增值
-- 冪等：ADD VALUE IF NOT EXISTS。
-- 硬性限制：新增的 enum 值不得在同一 migration 內被任何 DML / DEFAULT 使用
-- （PostgreSQL 同交易內剛加入的 enum 值不可立即使用）——本包只加值，不使用。

ALTER TYPE "PurchaseSource" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION';
ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'CANCEL_SUBSCRIPTION';
