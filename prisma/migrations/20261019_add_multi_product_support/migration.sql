-- DropIndex (remove unique constraint on saleId to allow multiple movements per sale)
DROP INDEX IF EXISTS "StockMovement_saleId_key";

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN "defaultProductId" UUID;

-- AlterTable
ALTER TABLE "Sale" ALTER COLUMN "quantity" SET DEFAULT 0,
ALTER COLUMN "unitPricePaise" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "productId" UUID;

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "basePricePaise" INTEGER NOT NULL,
    "minimumPricePaise" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBalance" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "stockLocationId" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleLineItem" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPricePaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    CONSTRAINT "SaleLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE INDEX "Product_active_idx" ON "Product"("active");

CREATE INDEX "ProductBalance_stockLocationId_idx" ON "ProductBalance"("stockLocationId");
CREATE INDEX "ProductBalance_productId_idx" ON "ProductBalance"("productId");
CREATE UNIQUE INDEX "ProductBalance_productId_stockLocationId_key" ON "ProductBalance"("productId", "stockLocationId");

CREATE INDEX "SaleLineItem_saleId_idx" ON "SaleLineItem"("saleId");
CREATE INDEX "SaleLineItem_productId_idx" ON "SaleLineItem"("productId");

CREATE INDEX "StockMovement_saleId_idx" ON "StockMovement"("saleId");
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- AddForeignKey
ALTER TABLE "ProductBalance" ADD CONSTRAINT "ProductBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductBalance" ADD CONSTRAINT "ProductBalance_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleLineItem" ADD CONSTRAINT "SaleLineItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleLineItem" ADD CONSTRAINT "SaleLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
