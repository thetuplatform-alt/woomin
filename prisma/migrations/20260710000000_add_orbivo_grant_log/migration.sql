-- Orbivo 技能包白名單授權紀錄：VIP 付款成功後同步 Orbivo PRIVATE pack allowlist
-- （同 GhostGrantLog 哲學：每筆訂單一列、可重試、SKIPPED = 設定未完成時靜默跳過）

CREATE TYPE "OrbivoGrantStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED');

CREATE TABLE "OrbivoGrantLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "planSlug" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "OrbivoGrantStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "grantedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrbivoGrantLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrbivoGrantLog_orderId_key" ON "OrbivoGrantLog"("orderId");
CREATE INDEX "OrbivoGrantLog_status_createdAt_idx" ON "OrbivoGrantLog"("status", "createdAt");
CREATE INDEX "OrbivoGrantLog_email_idx" ON "OrbivoGrantLog"("email");
