/*
  Warnings:

  - You are about to drop the `CrmEmailClick` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CrmEmailDelivery` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CrmEmailOpen` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CrmEnrollment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CrmSequence` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CrmSequenceStep` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CrmEmailClick" DROP CONSTRAINT "CrmEmailClick_deliveryId_fkey";

-- DropForeignKey
ALTER TABLE "CrmEmailClick" DROP CONSTRAINT "CrmEmailClick_userId_fkey";

-- DropForeignKey
ALTER TABLE "CrmEmailDelivery" DROP CONSTRAINT "CrmEmailDelivery_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "CrmEmailDelivery" DROP CONSTRAINT "CrmEmailDelivery_stepId_fkey";

-- DropForeignKey
ALTER TABLE "CrmEmailOpen" DROP CONSTRAINT "CrmEmailOpen_deliveryId_fkey";

-- DropForeignKey
ALTER TABLE "CrmEmailOpen" DROP CONSTRAINT "CrmEmailOpen_userId_fkey";

-- DropForeignKey
ALTER TABLE "CrmEnrollment" DROP CONSTRAINT "CrmEnrollment_orderId_fkey";

-- DropForeignKey
ALTER TABLE "CrmEnrollment" DROP CONSTRAINT "CrmEnrollment_sequenceId_fkey";

-- DropForeignKey
ALTER TABLE "CrmEnrollment" DROP CONSTRAINT "CrmEnrollment_userId_fkey";

-- DropForeignKey
ALTER TABLE "CrmSequence" DROP CONSTRAINT "CrmSequence_courseId_fkey";

-- DropForeignKey
ALTER TABLE "CrmSequenceStep" DROP CONSTRAINT "CrmSequenceStep_sequenceId_fkey";

-- DropTable
DROP TABLE "CrmEmailClick";

-- DropTable
DROP TABLE "CrmEmailDelivery";

-- DropTable
DROP TABLE "CrmEmailOpen";

-- DropTable
DROP TABLE "CrmEnrollment";

-- DropTable
DROP TABLE "CrmSequence";

-- DropTable
DROP TABLE "CrmSequenceStep";

-- DropEnum
DROP TYPE "CrmEmailDeliveryStatus";
