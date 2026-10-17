-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "IncentiveAdjustmentType" AS ENUM ('ADD', 'DEDUCT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "incentiveRatePaise" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "IncentiveRateHistory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "previousRatePaise" INTEGER,
    "newRatePaise" INTEGER NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "changedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncentiveRateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IncentiveAdjustment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "type" "IncentiveAdjustmentType" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "adjustmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncentiveAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IncentivePayout" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT NOT NULL DEFAULT 'BANK',
    "referenceId" TEXT,
    "remarks" TEXT,
    "requestKey" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncentivePayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IncentivePayoutAllocation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payoutId" UUID NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncentivePayoutAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IncentivePayout_requestKey_key" ON "IncentivePayout"("requestKey");
CREATE INDEX IF NOT EXISTS "IncentiveRateHistory_userId_createdAt_idx" ON "IncentiveRateHistory"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "IncentiveRateHistory_changedById_idx" ON "IncentiveRateHistory"("changedById");
CREATE INDEX IF NOT EXISTS "IncentiveAdjustment_userId_adjustmentDate_idx" ON "IncentiveAdjustment"("userId", "adjustmentDate");
CREATE INDEX IF NOT EXISTS "IncentiveAdjustment_createdById_idx" ON "IncentiveAdjustment"("createdById");
CREATE INDEX IF NOT EXISTS "IncentivePayout_userId_paymentDate_idx" ON "IncentivePayout"("userId", "paymentDate");
CREATE INDEX IF NOT EXISTS "IncentivePayout_createdById_idx" ON "IncentivePayout"("createdById");
CREATE INDEX IF NOT EXISTS "IncentivePayoutAllocation_payoutId_idx" ON "IncentivePayoutAllocation"("payoutId");
CREATE INDEX IF NOT EXISTS "IncentivePayoutAllocation_periodYear_periodMonth_idx" ON "IncentivePayoutAllocation"("periodYear", "periodMonth");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "IncentiveRateHistory" ADD CONSTRAINT "IncentiveRateHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "IncentiveRateHistory" ADD CONSTRAINT "IncentiveRateHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "IncentiveAdjustment" ADD CONSTRAINT "IncentiveAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "IncentiveAdjustment" ADD CONSTRAINT "IncentiveAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "IncentivePayout" ADD CONSTRAINT "IncentivePayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "IncentivePayout" ADD CONSTRAINT "IncentivePayout_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "IncentivePayoutAllocation" ADD CONSTRAINT "IncentivePayoutAllocation_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "IncentivePayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
