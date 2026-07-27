-- 電子發票作廢／折讓並發鎖，以及 ECPay 線上折讓確認狀態。
-- 保持冪等，以支援已由 db push 先行建欄位的客戶資料庫。

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "allowancePendingNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "allowancePendingAmount" INTEGER,
  ADD COLUMN IF NOT EXISTS "allowancePendingExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "operationType" TEXT,
  ADD COLUMN IF NOT EXISTS "operationAmount" INTEGER,
  ADD COLUMN IF NOT EXISTS "operationBaseAllowanceTotal" INTEGER,
  ADD COLUMN IF NOT EXISTS "operationStartedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Invoice_allowancePendingExpiresAt_idx"
  ON "Invoice"("allowancePendingExpiresAt");

CREATE INDEX IF NOT EXISTS "Invoice_operationType_operationStartedAt_idx"
  ON "Invoice"("operationType", "operationStartedAt");
