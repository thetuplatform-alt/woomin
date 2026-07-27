-- Migration: 新增課程有效期限功能
-- 1. Course: accessType / accessDurationDays / accessExpiresAt / 提醒設定
-- 2. Purchase: source / grantNote
-- 3. 新增 CourseExpirationReminder 表
-- 4. 擴充 EmailDeliveryType enum

-- ========== 1. Course enum & 欄位 ==========
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CourseAccessType') THEN
    CREATE TYPE "CourseAccessType" AS ENUM ('LIFETIME', 'DURATION', 'FIXED_DATE');
  END IF;
END $$;

ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "accessType" "CourseAccessType" NOT NULL DEFAULT 'LIFETIME',
  ADD COLUMN IF NOT EXISTS "accessDurationDays" INTEGER,
  ADD COLUMN IF NOT EXISTS "accessExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expirationReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "expirationReminderDays" INTEGER[] NOT NULL DEFAULT ARRAY[30, 7, 1];

-- ========== 2. Purchase enum & 欄位 ==========
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PurchaseSource') THEN
    CREATE TYPE "PurchaseSource" AS ENUM ('PAID', 'FREE_ENROLL', 'ADMIN_GRANT', 'ADMIN_IMPORT');
  END IF;
END $$;

ALTER TABLE "Purchase"
  ADD COLUMN IF NOT EXISTS "source" "PurchaseSource" NOT NULL DEFAULT 'PAID',
  ADD COLUMN IF NOT EXISTS "grantNote" TEXT;

-- 資料回填：依現有資料推斷 source
-- 有 grantedBy 視為管理員授權；orderId 為 null 且無 grantedBy 視為免費加入；其餘為付費
UPDATE "Purchase" SET "source" = 'ADMIN_GRANT' WHERE "grantedBy" IS NOT NULL;
UPDATE "Purchase" SET "source" = 'FREE_ENROLL' WHERE "grantedBy" IS NULL AND "orderId" IS NULL;

-- 新增 expiresAt index
CREATE INDEX IF NOT EXISTS "Purchase_expiresAt_idx" ON "Purchase"("expiresAt");

-- ========== 3. CourseExpirationReminder 表 ==========
CREATE TABLE IF NOT EXISTS "CourseExpirationReminder" (
  "id" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "daysBefore" INTEGER NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseExpirationReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CourseExpirationReminder_purchaseId_daysBefore_key"
  ON "CourseExpirationReminder"("purchaseId", "daysBefore");

CREATE INDEX IF NOT EXISTS "CourseExpirationReminder_sentAt_idx"
  ON "CourseExpirationReminder"("sentAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CourseExpirationReminder_purchaseId_fkey'
  ) THEN
    ALTER TABLE "CourseExpirationReminder"
      ADD CONSTRAINT "CourseExpirationReminder_purchaseId_fkey"
      FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 注意：ALTER TYPE ADD VALUE 已移至 202604160002_add_enum_values/ migration
-- 該 migration 使用 migration.toml 設定 transaction = false 以相容 PostgreSQL < 12
