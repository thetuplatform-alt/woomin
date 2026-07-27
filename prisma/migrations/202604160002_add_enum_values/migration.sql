-- 擴充既有 enum type：AdminAction, EmailDeliveryType
-- 此 migration 必須在 non-transactional 模式下執行
-- 因為 ALTER TYPE ... ADD VALUE 在 PostgreSQL < 12 不能在 transaction 中使用

-- AdminAction
ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'EXTEND_ACCESS';

-- EmailDeliveryType
ALTER TYPE "EmailDeliveryType" ADD VALUE IF NOT EXISTS 'COURSE_EXPIRATION_REMINDER';
ALTER TYPE "EmailDeliveryType" ADD VALUE IF NOT EXISTS 'COURSE_EXPIRED_NOTICE';
ALTER TYPE "EmailDeliveryType" ADD VALUE IF NOT EXISTS 'COURSE_ACCESS_EXTENDED';
