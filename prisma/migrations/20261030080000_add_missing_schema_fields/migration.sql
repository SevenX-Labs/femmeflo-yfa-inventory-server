-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN "companyAddress" TEXT,
ADD COLUMN "companyEmail" TEXT,
ADD COLUMN "companyGst" TEXT,
ADD COLUMN "companyName" TEXT DEFAULT 'FemmeFlo',
ADD COLUMN "companyPan" TEXT,
ADD COLUMN "companyPhone" TEXT,
ADD COLUMN "invoiceTerms" TEXT;

-- AlterTable
ALTER TABLE "IncentiveAdjustment" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "IncentivePayout" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "IncentivePayoutAllocation" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "IncentiveRateHistory" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Shift" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShiftVisit" ADD COLUMN "checkOutTime" TIMESTAMP(3),
ADD COLUMN "durationMins" DOUBLE PRECISION,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "isSeller" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "User_isSeller_idx" ON "User"("isSeller");
