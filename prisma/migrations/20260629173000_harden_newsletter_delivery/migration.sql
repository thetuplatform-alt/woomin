-- Harden newsletter delivery against concurrent workers and attribution loss.

DO $$ BEGIN
  ALTER TYPE "NewsletterRecipientStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "NewsletterLink" ADD COLUMN IF NOT EXISTS "recipientId" TEXT;

CREATE INDEX IF NOT EXISTS "NewsletterLink_recipientId_idx" ON "NewsletterLink"("recipientId");

DO $$ BEGIN
  ALTER TABLE "NewsletterLink" ADD CONSTRAINT "NewsletterLink_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "NewsletterRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
