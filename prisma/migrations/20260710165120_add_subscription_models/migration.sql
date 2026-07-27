-- 課程訂閱制 (3/3)：全新 enum 型別、新表、外鍵、partial unique index
-- 全部冪等（DO $$ duplicate_object / IF NOT EXISTS）。
-- 新型別在本包內建立並使用於欄位型別 / DEFAULT——CREATE TYPE 後立即使用同型別的值合法
--（PG 只限制「ALTER TYPE ADD VALUE 新加值」在同交易內立即使用，見 1/3）。

-- ---------- 新 enum 型別 ----------
DO $$ BEGIN
  CREATE TYPE "SubscriptionPlanType" AS ENUM ('UNLIMITED', 'FIXED_TERM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BillingInterval" AS ENUM ('MONTH', 'YEAR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TermEndBehavior" AS ENUM ('GRANT_LIFETIME', 'END_ACCESS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- 課程訂閱方案 ----------
CREATE TABLE IF NOT EXISTS "CourseSubscriptionPlan" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" "SubscriptionPlanType" NOT NULL,
  "interval" "BillingInterval" NOT NULL,
  "price" INTEGER NOT NULL,
  "totalPeriods" INTEGER,
  "termEndBehavior" "TermEndBehavior" NOT NULL DEFAULT 'GRANT_LIFETIME',
  "renewalReminderDays" INTEGER,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "stripePriceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseSubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- ---------- 課程訂閱實體 ----------
CREATE TABLE IF NOT EXISTS "CourseSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
  "gateway" TEXT NOT NULL,
  "gatewaySubscriptionId" TEXT,
  "gatewayTradeNo" TEXT,
  "planType" "SubscriptionPlanType" NOT NULL,
  "interval" "BillingInterval" NOT NULL,
  "pricePerPeriod" INTEGER NOT NULL,
  "totalPeriods" INTEGER,
  "termEndBehavior" "TermEndBehavior" NOT NULL,
  "paidPeriods" INTEGER NOT NULL DEFAULT 0,
  "currentPeriodEnd" TIMESTAMP(3),
  "lastPaymentAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "completedAt" TIMESTAMP(3),
  "pendingGatewayCancelAt" TIMESTAMP(3),
  "attentionReason" TEXT,
  "consentAt" TIMESTAMP(3),
  "consentTextVersion" TEXT,
  "reminderSentForPeriod" INTEGER,
  "accessEndNoticeSentAt" TIMESTAMP(3),
  "invoiceType" "InvoiceType",
  "invoiceCarrierType" TEXT,
  "invoiceCarrierId" TEXT,
  "invoiceTaxId" TEXT,
  "invoiceTitle" TEXT,
  "invoiceLoveCode" TEXT,
  "invoiceAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseSubscription_pkey" PRIMARY KEY ("id")
);

-- ---------- 索引 ----------
CREATE INDEX IF NOT EXISTS "CourseSubscriptionPlan_courseId_idx" ON "CourseSubscriptionPlan"("courseId");
CREATE INDEX IF NOT EXISTS "CourseSubscriptionPlan_courseId_enabled_sortOrder_idx" ON "CourseSubscriptionPlan"("courseId", "enabled", "sortOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "CourseSubscription_gatewayTradeNo_key" ON "CourseSubscription"("gatewayTradeNo");
CREATE INDEX IF NOT EXISTS "CourseSubscription_userId_idx" ON "CourseSubscription"("userId");
CREATE INDEX IF NOT EXISTS "CourseSubscription_courseId_idx" ON "CourseSubscription"("courseId");
CREATE INDEX IF NOT EXISTS "CourseSubscription_planId_idx" ON "CourseSubscription"("planId");
CREATE INDEX IF NOT EXISTS "CourseSubscription_status_currentPeriodEnd_idx" ON "CourseSubscription"("status", "currentPeriodEnd");

-- ---------- 並發防重：partial unique index（Prisma 不建模，純 DB 約束）----------
-- 同一 user+course 同時只能有一筆「進行中」訂閱（PENDING/ACTIVE/PAST_DUE）。
-- TOCTOU 防線：結帳建單、PENDING 汰換皆依賴此約束保證併發下只有一筆存活。
CREATE UNIQUE INDEX IF NOT EXISTS "CourseSubscription_active_user_course_key"
  ON "CourseSubscription"("userId", "courseId")
  WHERE "status" IN ('PENDING', 'ACTIVE', 'PAST_DUE');

-- ---------- 外鍵 ----------
DO $$ BEGIN
  ALTER TABLE "CourseSubscriptionPlan" ADD CONSTRAINT "CourseSubscriptionPlan_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CourseSubscription" ADD CONSTRAINT "CourseSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CourseSubscription" ADD CONSTRAINT "CourseSubscription_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CourseSubscription" ADD CONSTRAINT "CourseSubscription_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "CourseSubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Order → CourseSubscription（本包內建表後才能加，故置於此）
DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "CourseSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
