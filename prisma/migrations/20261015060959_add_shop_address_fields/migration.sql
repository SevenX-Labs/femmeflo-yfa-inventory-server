-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "address" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "shopNumber" TEXT,
ADD COLUMN     "streetName" TEXT;

-- CreateIndex
CREATE INDEX "Customer_pincode_idx" ON "Customer"("pincode");
