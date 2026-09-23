-- BestAppStore series, tools, and two-level entitlement foundation.
-- This migration is additive and does not alter existing course purchases or private SaaS data.

CREATE TYPE "SeriesStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "ToolType" AS ENUM ('WEB_APP', 'SKILL', 'AI_TOOL', 'SAAS');
CREATE TYPE "ToolRuntimeType" AS ENUM ('EXTERNAL_WEB_APP', 'SKILL_RUNTIME', 'BESTAPPSTORE_NATIVE');
CREATE TYPE "ToolStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED', 'ARCHIVED');
CREATE TYPE "ToolPricingType" AS ENUM ('FREE', 'PAID', 'INCLUDED', 'COMING_SOON');
CREATE TYPE "EntitlementKind" AS ENUM ('SERIES', 'TOOL');
CREATE TYPE "UserEntitlementStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "Series" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "SeriesStatus" NOT NULL DEFAULT 'ACTIVE',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "EntitlementKind" NOT NULL,
    "seriesId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Tool" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subCategory" TEXT,
    "eyebrow" TEXT,
    "type" "ToolType" NOT NULL,
    "shortDescription" TEXT,
    "longDescription" TEXT,
    "thumbnail" TEXT,
    "heroImage" TEXT,
    "launchUrl" TEXT,
    "detailUrl" TEXT,
    "runtimeType" "ToolRuntimeType" NOT NULL,
    "status" "ToolStatus" NOT NULL DEFAULT 'DRAFT',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredOrder" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "requiresLogin" BOOLEAN NOT NULL DEFAULT true,
    "requiredEntitlementId" TEXT,
    "pricingType" "ToolPricingType" NOT NULL DEFAULT 'INCLUDED',
    "price" DECIMAL(12,2),
    "ctaLabel" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "tags" JSONB,
    "audience" JSONB,
    "benefits" JSONB,
    "features" JSONB,
    "usageSteps" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tool_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserEntitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "status" "UserEntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Series_code_key" ON "Series"("code");
CREATE UNIQUE INDEX "Series_slug_key" ON "Series"("slug");
CREATE INDEX "Series_status_displayOrder_idx" ON "Series"("status", "displayOrder");
CREATE UNIQUE INDEX "Entitlement_code_key" ON "Entitlement"("code");
CREATE INDEX "Entitlement_seriesId_kind_isActive_idx" ON "Entitlement"("seriesId", "kind", "isActive");
CREATE UNIQUE INDEX "Tool_slug_key" ON "Tool"("slug");
CREATE INDEX "Tool_seriesId_isPublished_status_displayOrder_idx" ON "Tool"("seriesId", "isPublished", "status", "displayOrder");
CREATE INDEX "Tool_seriesId_isFeatured_featuredOrder_idx" ON "Tool"("seriesId", "isFeatured", "featuredOrder");
CREATE INDEX "Tool_requiredEntitlementId_idx" ON "Tool"("requiredEntitlementId");
CREATE UNIQUE INDEX "UserEntitlement_userId_entitlementId_key" ON "UserEntitlement"("userId", "entitlementId");
CREATE INDEX "UserEntitlement_userId_status_expiresAt_idx" ON "UserEntitlement"("userId", "status", "expiresAt");
CREATE INDEX "UserEntitlement_entitlementId_status_idx" ON "UserEntitlement"("entitlementId", "status");

ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tool" ADD CONSTRAINT "Tool_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tool" ADD CONSTRAINT "Tool_requiredEntitlementId_fkey" FOREIGN KEY ("requiredEntitlementId") REFERENCES "Entitlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserEntitlement" ADD CONSTRAINT "UserEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserEntitlement" ADD CONSTRAINT "UserEntitlement_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "Entitlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
