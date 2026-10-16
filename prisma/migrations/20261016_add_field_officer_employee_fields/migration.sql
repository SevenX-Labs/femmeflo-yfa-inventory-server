-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "designation" TEXT,
ADD COLUMN IF NOT EXISTS "employeeCode" TEXT,
ADD COLUMN IF NOT EXISTS "alternatePhone" TEXT,
ADD COLUMN IF NOT EXISTS "address" TEXT,
ADD COLUMN IF NOT EXISTS "pincode" TEXT,
ADD COLUMN IF NOT EXISTS "aadharNumber" TEXT,
ADD COLUMN IF NOT EXISTS "drivingLicense" TEXT,
ADD COLUMN IF NOT EXISTS "education" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_employeeCode_key" ON "User"("employeeCode");
CREATE INDEX IF NOT EXISTS "User_employeeCode_idx" ON "User"("employeeCode");
