-- 擴充 EmailDeliveryType enum，讓忘記密碼／首次設定密碼信也能寫入 EmailDeliveryLog
-- 此 migration 必須在 non-transactional 模式下執行
-- 因為 ALTER TYPE ... ADD VALUE 在 PostgreSQL < 12 不能在 transaction 中使用

ALTER TYPE "EmailDeliveryType" ADD VALUE IF NOT EXISTS 'PASSWORD_RESET';
ALTER TYPE "EmailDeliveryType" ADD VALUE IF NOT EXISTS 'PASSWORD_SETUP';
