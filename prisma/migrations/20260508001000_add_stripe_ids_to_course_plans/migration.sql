ALTER TABLE "CoursePlan"
    ADD COLUMN IF NOT EXISTS "stripeProductId" TEXT,
    ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT;
