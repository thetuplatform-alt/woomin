-- 台灣電子發票（統一發票）相關 schema。
--
-- ⚠️ 冪等性（買斷產品多客戶部署必備）：所有語句皆可重複執行而不報錯
--    （CREATE TYPE 以 DO/EXCEPTION 包覆、ADD VALUE/ADD COLUMN/CREATE TABLE/INDEX 皆 IF NOT EXISTS、
--    外鍵以 pg_constraint 判斷）。確保在「以 db push 建立、無 migration 歷史」的既有客戶
--    資料庫上，經 baseline 後套用本 migration 亦能安全成功。

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'ISSUED', 'FAILED', 'VOIDED', 'ALLOWANCE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "InvoiceType" AS ENUM ('PERSONAL', 'COMPANY', 'DONATION');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterEnum
ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'UPDATE_EINVOICE_SETTINGS';
ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'ISSUE_INVOICE';
ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'VOID_INVOICE';
ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'ALLOWANCE_INVOICE';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "invoiceCarrierId" TEXT,
ADD COLUMN IF NOT EXISTS "invoiceCarrierType" TEXT,
ADD COLUMN IF NOT EXISTS "invoiceLoveCode" TEXT,
ADD COLUMN IF NOT EXISTS "invoiceTaxId" TEXT,
ADD COLUMN IF NOT EXISTS "invoiceTitle" TEXT,
ADD COLUMN IF NOT EXISTS "invoiceAddress" TEXT,
ADD COLUMN IF NOT EXISTS "invoiceType" "InvoiceType";

-- CreateTable
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "invoiceNumber" TEXT,
    "randomCode" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "amount" INTEGER NOT NULL,
    "allowanceNumber" TEXT,
    "allowanceAmount" INTEGER,
    "voidedAt" TIMESTAMP(3),
    "failReason" TEXT,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_orderId_key" ON "Invoice"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_orderId_fkey'
  ) THEN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
