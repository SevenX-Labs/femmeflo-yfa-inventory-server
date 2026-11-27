-- Add employee sales targets (packets, period DAILY/MONTHLY, and optional completion bonus)
DO $$
BEGIN
  CREATE TYPE "TargetPeriod" AS ENUM ('DAILY', 'MONTHLY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "salesTargetPackets" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "salesTargetPeriod" "TargetPeriod" NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "targetBonusPaise" INTEGER;
