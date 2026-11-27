-- Add COMPLETED state to SaleStatus and company payment remittance tracking fields on Sale
ALTER TYPE "SaleStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "paymentSentAt" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "paymentSentRemark" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "paymentSentById" UUID;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "paymentReceivedAt" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "paymentReceivedRemark" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "paymentReceivedById" UUID;

CREATE INDEX IF NOT EXISTS "Sale_status_paymentSentAt_createdAt_idx" ON "Sale"("status", "paymentSentAt", "createdAt");

DO $$ BEGIN
  ALTER TABLE "Sale" ADD CONSTRAINT "Sale_paymentSentById_fkey" FOREIGN KEY ("paymentSentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Sale" ADD CONSTRAINT "Sale_paymentReceivedById_fkey" FOREIGN KEY ("paymentReceivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
