-- Production hardening for subscription payments.
-- This migration is additive and idempotent so upgrades can safely resume.

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "gatewayInvoiceId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "hostedInvoiceUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundError" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundRequestedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundCompletedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "gatewayRefundId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "gatewayDisputeId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "disputeStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "disputedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Order_gatewayInvoiceId_key"
  ON "Order"("gatewayInvoiceId");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_stripePaymentIntentId_key"
  ON "Order"("stripePaymentIntentId");
CREATE INDEX IF NOT EXISTS "Order_refundStatus_refundRequestedAt_idx"
  ON "Order"("refundStatus", "refundRequestedAt");

ALTER TABLE "CourseSubscription" ADD COLUMN IF NOT EXISTS "checkoutIdempotencyKey" TEXT;
ALTER TABLE "CourseSubscription" ADD COLUMN IF NOT EXISTS "gatewayPriceId" TEXT;
ALTER TABLE "CourseSubscription" ADD COLUMN IF NOT EXISTS "gatewayEnvironment" TEXT;
ALTER TABLE "CourseSubscription" ADD COLUMN IF NOT EXISTS "cancelRequestedAt" TIMESTAMP(3);
ALTER TABLE "CourseSubscription" ADD COLUMN IF NOT EXISTS "lastFailedPeriodNumber" INTEGER;
ALTER TABLE "CourseSubscription" ADD COLUMN IF NOT EXISTS "lastFailedPeriodKey" TEXT;

-- Financial history must not disappear through a cascading User/Course/Subscription delete.
ALTER TABLE "CourseSubscription" DROP CONSTRAINT IF EXISTS "CourseSubscription_userId_fkey";
ALTER TABLE "CourseSubscription" ADD CONSTRAINT "CourseSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseSubscription" DROP CONSTRAINT IF EXISTS "CourseSubscription_courseId_fkey";
ALTER TABLE "CourseSubscription" ADD CONSTRAINT "CourseSubscription_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_subscriptionId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "CourseSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "CourseSubscription_checkoutIdempotencyKey_key"
  ON "CourseSubscription"("checkoutIdempotencyKey");
-- Deliberately fails if historical duplicate provider subscriptions exist: those must be
-- reconciled before the deployment can be considered safe.
CREATE UNIQUE INDEX IF NOT EXISTS "CourseSubscription_gateway_gatewaySubscriptionId_key"
  ON "CourseSubscription"("gateway", "gatewaySubscriptionId");

CREATE TABLE IF NOT EXISTS "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "gateway" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "payload" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "lastError" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentWebhookEvent_gateway_eventId_key"
  ON "PaymentWebhookEvent"("gateway", "eventId");
CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_status_updatedAt_idx"
  ON "PaymentWebhookEvent"("status", "updatedAt");

CREATE TABLE IF NOT EXISTS "SubscriptionOutbox" (
  "id" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "orderId" TEXT,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionOutbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionOutbox_dedupeKey_key"
  ON "SubscriptionOutbox"("dedupeKey");
CREATE INDEX IF NOT EXISTS "SubscriptionOutbox_status_nextAttemptAt_idx"
  ON "SubscriptionOutbox"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "SubscriptionOutbox_subscriptionId_idx"
  ON "SubscriptionOutbox"("subscriptionId");
CREATE INDEX IF NOT EXISTS "SubscriptionOutbox_orderId_idx"
  ON "SubscriptionOutbox"("orderId");

DO $$ BEGIN
  ALTER TABLE "CourseSubscriptionPlan" ADD CONSTRAINT "CourseSubscriptionPlan_price_check"
    CHECK ("price" BETWEEN 2 AND 199999);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CourseSubscriptionPlan" ADD CONSTRAINT "CourseSubscriptionPlan_periods_check"
    CHECK (
      ("type" = 'UNLIMITED' AND "totalPeriods" IS NULL)
      OR ("type" = 'FIXED_TERM' AND "totalPeriods" BETWEEN 2 AND 900)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CourseSubscription" ADD CONSTRAINT "CourseSubscription_gateway_check"
    CHECK ("gateway" IN ('stripe', 'payuni'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CourseSubscription" ADD CONSTRAINT "CourseSubscription_paidPeriods_check"
    CHECK ("paidPeriods" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CourseSubscription" ADD CONSTRAINT "CourseSubscription_snapshot_price_check"
    CHECK ("pricePerPeriod" BETWEEN 2 AND 199999);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CourseSubscription" ADD CONSTRAINT "CourseSubscription_snapshot_periods_check"
    CHECK (
      ("planType" = 'UNLIMITED' AND "totalPeriods" IS NULL)
      OR (
        "planType" = 'FIXED_TERM'
        AND "totalPeriods" BETWEEN 2 AND 900
        AND "paidPeriods" <= "totalPeriods"
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CourseSubscription" ADD CONSTRAINT "CourseSubscription_environment_check"
    CHECK (
      "gatewayEnvironment" IS NULL
      OR "gatewayEnvironment" IN ('stripe:test', 'stripe:live', 'payuni:sandbox', 'payuni:production')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_subscription_period_check"
    CHECK ("subscriptionId" IS NULL OR "periodNumber" IS NULL OR "periodNumber" BETWEEN 1 AND 900);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_refund_status_check"
    CHECK ("refundStatus" IS NULL OR "refundStatus" IN ('PROCESSING', 'PENDING_MANUAL', 'COMPLETED', 'FAILED', 'PARTIAL'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_dispute_status_check"
    CHECK ("disputeStatus" IS NULL OR "disputeStatus" IN ('NEEDS_RESPONSE', 'WON', 'LOST', 'CLOSED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_status_check"
    CHECK ("status" IN ('PROCESSING', 'PROCESSED', 'FAILED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SubscriptionOutbox" ADD CONSTRAINT "SubscriptionOutbox_status_check"
    CHECK ("status" IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
