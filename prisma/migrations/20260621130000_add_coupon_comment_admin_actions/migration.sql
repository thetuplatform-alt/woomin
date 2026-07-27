-- 擴充 AdminAction enum：新增優惠券與課程留言管理操作類型
-- 此 migration 必須在 non-transactional 模式下執行
-- 因為 ALTER TYPE ... ADD VALUE 在 PostgreSQL < 12 不能在 transaction 中使用

ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'CREATE_COUPON';
ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'UPDATE_COUPON';
ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'TOGGLE_COUPON';
ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'DELETE_LESSON_COMMENT';
