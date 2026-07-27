-- CreateEnum
CREATE TYPE "NewsletterAutomationDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "NewsletterAutomation" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterAutomationStep" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL DEFAULT 0,
    "delayHours" INTEGER NOT NULL DEFAULT 0,
    "subjectTemplate" TEXT NOT NULL,
    "contentJson" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterAutomationStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterAutomationEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterAutomationEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterAutomationDelivery" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "stepId" TEXT,
    "status" "NewsletterAutomationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterAutomationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterAutomationOpen" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterAutomationOpen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterAutomationClick" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterAutomationClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterAutomation_courseId_key" ON "NewsletterAutomation"("courseId");

-- CreateIndex
CREATE INDEX "NewsletterAutomation_enabled_idx" ON "NewsletterAutomation"("enabled");

-- CreateIndex
CREATE INDEX "NewsletterAutomationStep_automationId_enabled_stepOrder_idx" ON "NewsletterAutomationStep"("automationId", "enabled", "stepOrder");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterAutomationStep_automationId_stepOrder_key" ON "NewsletterAutomationStep"("automationId", "stepOrder");

-- CreateIndex
CREATE INDEX "NewsletterAutomationEnrollment_automationId_enrolledAt_idx" ON "NewsletterAutomationEnrollment"("automationId", "enrolledAt");

-- CreateIndex
CREATE INDEX "NewsletterAutomationEnrollment_orderId_idx" ON "NewsletterAutomationEnrollment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterAutomationEnrollment_userId_automationId_key" ON "NewsletterAutomationEnrollment"("userId", "automationId");

-- CreateIndex
CREATE INDEX "NewsletterAutomationDelivery_status_scheduledAt_idx" ON "NewsletterAutomationDelivery"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "NewsletterAutomationDelivery_stepId_idx" ON "NewsletterAutomationDelivery"("stepId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterAutomationDelivery_enrollmentId_stepId_key" ON "NewsletterAutomationDelivery"("enrollmentId", "stepId");

-- CreateIndex
CREATE INDEX "NewsletterAutomationOpen_deliveryId_openedAt_idx" ON "NewsletterAutomationOpen"("deliveryId", "openedAt");

-- CreateIndex
CREATE INDEX "NewsletterAutomationOpen_userId_openedAt_idx" ON "NewsletterAutomationOpen"("userId", "openedAt");

-- CreateIndex
CREATE INDEX "NewsletterAutomationClick_deliveryId_clickedAt_idx" ON "NewsletterAutomationClick"("deliveryId", "clickedAt");

-- CreateIndex
CREATE INDEX "NewsletterAutomationClick_userId_clickedAt_idx" ON "NewsletterAutomationClick"("userId", "clickedAt");

-- AddForeignKey
ALTER TABLE "NewsletterAutomation" ADD CONSTRAINT "NewsletterAutomation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterAutomationStep" ADD CONSTRAINT "NewsletterAutomationStep_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "NewsletterAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterAutomationEnrollment" ADD CONSTRAINT "NewsletterAutomationEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterAutomationEnrollment" ADD CONSTRAINT "NewsletterAutomationEnrollment_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "NewsletterAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterAutomationEnrollment" ADD CONSTRAINT "NewsletterAutomationEnrollment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterAutomationDelivery" ADD CONSTRAINT "NewsletterAutomationDelivery_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "NewsletterAutomationEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterAutomationDelivery" ADD CONSTRAINT "NewsletterAutomationDelivery_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "NewsletterAutomationStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterAutomationOpen" ADD CONSTRAINT "NewsletterAutomationOpen_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "NewsletterAutomationDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterAutomationOpen" ADD CONSTRAINT "NewsletterAutomationOpen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterAutomationClick" ADD CONSTRAINT "NewsletterAutomationClick_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "NewsletterAutomationDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterAutomationClick" ADD CONSTRAINT "NewsletterAutomationClick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
