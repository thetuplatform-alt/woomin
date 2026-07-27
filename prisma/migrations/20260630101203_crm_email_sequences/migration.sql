-- CreateEnum
CREATE TYPE "CrmEmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "CrmSequence" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmSequenceStep" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL DEFAULT 0,
    "delayHours" INTEGER NOT NULL DEFAULT 0,
    "subjectTemplate" TEXT NOT NULL,
    "markdownContent" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmSequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmEmailDelivery" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "stepId" TEXT,
    "status" "CrmEmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmEmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmEmailOpen" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmEmailOpen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmEmailClick" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmEmailClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmSequence_courseId_key" ON "CrmSequence"("courseId");

-- CreateIndex
CREATE INDEX "CrmSequence_enabled_idx" ON "CrmSequence"("enabled");

-- CreateIndex
CREATE INDEX "CrmSequenceStep_sequenceId_enabled_stepOrder_idx" ON "CrmSequenceStep"("sequenceId", "enabled", "stepOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CrmSequenceStep_sequenceId_stepOrder_key" ON "CrmSequenceStep"("sequenceId", "stepOrder");

-- CreateIndex
CREATE INDEX "CrmEnrollment_sequenceId_enrolledAt_idx" ON "CrmEnrollment"("sequenceId", "enrolledAt");

-- CreateIndex
CREATE INDEX "CrmEnrollment_orderId_idx" ON "CrmEnrollment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmEnrollment_userId_sequenceId_key" ON "CrmEnrollment"("userId", "sequenceId");

-- CreateIndex
CREATE INDEX "CrmEmailDelivery_status_scheduledAt_idx" ON "CrmEmailDelivery"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "CrmEmailDelivery_stepId_idx" ON "CrmEmailDelivery"("stepId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmEmailDelivery_enrollmentId_stepId_key" ON "CrmEmailDelivery"("enrollmentId", "stepId");

-- CreateIndex
CREATE INDEX "CrmEmailOpen_deliveryId_openedAt_idx" ON "CrmEmailOpen"("deliveryId", "openedAt");

-- CreateIndex
CREATE INDEX "CrmEmailOpen_userId_openedAt_idx" ON "CrmEmailOpen"("userId", "openedAt");

-- CreateIndex
CREATE INDEX "CrmEmailClick_deliveryId_clickedAt_idx" ON "CrmEmailClick"("deliveryId", "clickedAt");

-- CreateIndex
CREATE INDEX "CrmEmailClick_userId_clickedAt_idx" ON "CrmEmailClick"("userId", "clickedAt");

-- AddForeignKey
ALTER TABLE "CrmSequence" ADD CONSTRAINT "CrmSequence_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmSequenceStep" ADD CONSTRAINT "CrmSequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "CrmSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEnrollment" ADD CONSTRAINT "CrmEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEnrollment" ADD CONSTRAINT "CrmEnrollment_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "CrmSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEnrollment" ADD CONSTRAINT "CrmEnrollment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEmailDelivery" ADD CONSTRAINT "CrmEmailDelivery_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CrmEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEmailDelivery" ADD CONSTRAINT "CrmEmailDelivery_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "CrmSequenceStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEmailOpen" ADD CONSTRAINT "CrmEmailOpen_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "CrmEmailDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEmailOpen" ADD CONSTRAINT "CrmEmailOpen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEmailClick" ADD CONSTRAINT "CrmEmailClick_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "CrmEmailDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEmailClick" ADD CONSTRAINT "CrmEmailClick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
