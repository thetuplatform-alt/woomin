-- Newsletter / EDM system
-- Idempotent migration for existing db-push based customer databases.

DO $$ BEGIN
  CREATE TYPE "EmailBounceState" AS ENUM ('NONE', 'SOFT_SUSPENDED', 'HARD_BOUNCED', 'COMPLAINED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NewsletterType" AS ENUM ('GENERAL', 'PROMO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NewsletterStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'QUEUED', 'SENDING', 'PAUSED', 'SENT', 'PARTIAL_FAILED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NewsletterRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED', 'BOUNCED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EmailConsentType" AS ENUM ('GENERAL', 'MARKETING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EmailConsentAction" AS ENUM ('GRANTED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NewsletterAlertType" AS ENUM ('INFO', 'WARNING', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingConsentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingConsentSource" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingConsentIp" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "generalEmailConsent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "generalEmailConsentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "unsubscribedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailInvalidAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailBounceState" "EmailBounceState" NOT NULL DEFAULT 'NONE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailBounceCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "locale" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "country" TEXT;

CREATE TABLE IF NOT EXISTS "NewsletterTemplate" (
  "id" TEXT NOT NULL,
  "type" "NewsletterType" NOT NULL,
  "name" TEXT NOT NULL,
  "contentJson" JSONB NOT NULL,
  "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NewsletterTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NewsletterCampaign" (
  "id" TEXT NOT NULL,
  "type" "NewsletterType" NOT NULL DEFAULT 'GENERAL',
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "preheader" TEXT,
  "contentJson" JSONB NOT NULL,
  "bodyHtml" TEXT,
  "bodyText" TEXT,
  "templateId" TEXT,
  "status" "NewsletterStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Taipei',
  "senderName" TEXT,
  "replyTo" TEXT,
  "segmentJson" JSONB,
  "couponId" TEXT,
  "attributionWindowDays" INTEGER NOT NULL DEFAULT 7,
  "ratePerMinute" INTEGER NOT NULL DEFAULT 60,
  "senderSnapshot" JSONB,
  "sentCursor" INTEGER NOT NULL DEFAULT 0,
  "totalRecipients" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "openCount" INTEGER NOT NULL DEFAULT 0,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "unsubCount" INTEGER NOT NULL DEFAULT 0,
  "lastHeartbeatAt" TIMESTAMP(3),
  "snapshotAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NewsletterCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NewsletterRecipient" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "userId" TEXT,
  "toEmail" TEXT NOT NULL,
  "toName" TEXT,
  "status" "NewsletterRecipientStatus" NOT NULL DEFAULT 'PENDING',
  "skipReason" TEXT,
  "bounceType" TEXT,
  "providerMessageId" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "openedAt" TIMESTAMP(3),
  "firstClickedAt" TIMESTAMP(3),
  "unsubscribedAt" TIMESTAMP(3),
  "isTest" BOOLEAN NOT NULL DEFAULT false,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NewsletterRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NewsletterLink" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "targetUrl" TEXT NOT NULL,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "uniqueClickCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewsletterLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailConsentLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "consentType" "EmailConsentType" NOT NULL,
  "action" "EmailConsentAction" NOT NULL,
  "source" TEXT NOT NULL,
  "ip" TEXT,
  "market" TEXT,
  "termsVersion" TEXT,
  "campaignId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailConsentLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NewsletterAlert" (
  "id" TEXT NOT NULL,
  "type" "NewsletterAlertType" NOT NULL DEFAULT 'INFO',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "campaignId" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewsletterAlert_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "newsletterCampaignId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "newsletterLinkId" TEXT;
ALTER TABLE "CouponRedemption" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;

DO $$ BEGIN
  ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'CREATE_NEWSLETTER';
  ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'UPDATE_NEWSLETTER';
  ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'SEND_NEWSLETTER';
  ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'SCHEDULE_NEWSLETTER';
  ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'PAUSE_NEWSLETTER';
  ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'CANCEL_NEWSLETTER';
  ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'DUPLICATE_NEWSLETTER';
  ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'EXPORT_NEWSLETTER';
  ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'ADMIN_OVERRIDE_CONSENT';
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "NewsletterRecipient_campaignId_userId_key" ON "NewsletterRecipient"("campaignId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "NewsletterRecipient_campaignId_toEmail_key" ON "NewsletterRecipient"("campaignId", "toEmail");
CREATE UNIQUE INDEX IF NOT EXISTS "NewsletterLink_token_key" ON "NewsletterLink"("token");

CREATE INDEX IF NOT EXISTS "User_marketingConsent_idx" ON "User"("marketingConsent");
CREATE INDEX IF NOT EXISTS "User_generalEmailConsent_idx" ON "User"("generalEmailConsent");
CREATE INDEX IF NOT EXISTS "User_emailBounceState_idx" ON "User"("emailBounceState");
CREATE INDEX IF NOT EXISTS "User_unsubscribedAt_idx" ON "User"("unsubscribedAt");
CREATE INDEX IF NOT EXISTS "NewsletterCampaign_status_scheduledAt_idx" ON "NewsletterCampaign"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "NewsletterCampaign_createdById_createdAt_idx" ON "NewsletterCampaign"("createdById", "createdAt");
CREATE INDEX IF NOT EXISTS "NewsletterCampaign_type_status_idx" ON "NewsletterCampaign"("type", "status");
CREATE INDEX IF NOT EXISTS "NewsletterCampaign_updatedAt_idx" ON "NewsletterCampaign"("updatedAt");
CREATE INDEX IF NOT EXISTS "NewsletterRecipient_toEmail_createdAt_idx" ON "NewsletterRecipient"("toEmail", "createdAt");
CREATE INDEX IF NOT EXISTS "NewsletterRecipient_status_createdAt_idx" ON "NewsletterRecipient"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "NewsletterRecipient_providerMessageId_idx" ON "NewsletterRecipient"("providerMessageId");
CREATE INDEX IF NOT EXISTS "NewsletterTemplate_type_isBuiltIn_idx" ON "NewsletterTemplate"("type", "isBuiltIn");
CREATE INDEX IF NOT EXISTS "NewsletterLink_campaignId_idx" ON "NewsletterLink"("campaignId");
CREATE INDEX IF NOT EXISTS "EmailConsentLog_userId_createdAt_idx" ON "EmailConsentLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailConsentLog_email_createdAt_idx" ON "EmailConsentLog"("email", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailConsentLog_campaignId_idx" ON "EmailConsentLog"("campaignId");
CREATE INDEX IF NOT EXISTS "NewsletterAlert_readAt_createdAt_idx" ON "NewsletterAlert"("readAt", "createdAt");
CREATE INDEX IF NOT EXISTS "NewsletterAlert_campaignId_idx" ON "NewsletterAlert"("campaignId");
CREATE INDEX IF NOT EXISTS "Order_newsletterCampaignId_idx" ON "Order"("newsletterCampaignId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_campaignId_idx" ON "CouponRedemption"("campaignId");

DO $$ BEGIN
  ALTER TABLE "NewsletterTemplate" ADD CONSTRAINT "NewsletterTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NewsletterCampaign" ADD CONSTRAINT "NewsletterCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NewsletterCampaign" ADD CONSTRAINT "NewsletterCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NewsletterTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NewsletterCampaign" ADD CONSTRAINT "NewsletterCampaign_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NewsletterRecipient" ADD CONSTRAINT "NewsletterRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NewsletterCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NewsletterRecipient" ADD CONSTRAINT "NewsletterRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NewsletterLink" ADD CONSTRAINT "NewsletterLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NewsletterCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EmailConsentLog" ADD CONSTRAINT "EmailConsentLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EmailConsentLog" ADD CONSTRAINT "EmailConsentLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NewsletterCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NewsletterAlert" ADD CONSTRAINT "NewsletterAlert_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NewsletterCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_newsletterCampaignId_fkey" FOREIGN KEY ("newsletterCampaignId") REFERENCES "NewsletterCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_newsletterLinkId_fkey" FOREIGN KEY ("newsletterLinkId") REFERENCES "NewsletterLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NewsletterCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
