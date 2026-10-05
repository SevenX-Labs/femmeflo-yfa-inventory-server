-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'MANAGER', 'SELLER');

-- CreateEnum
CREATE TYPE "StockLocationType" AS ENUM ('HQ', 'WAREHOUSE', 'SELLER');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'TRANSFER', 'SALE');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'BANK', 'PENDING');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('PENDING_APPROVAL', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "managerId" UUID,
    "state" TEXT,
    "district" TEXT,
    "village" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "shopName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "categoryId" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "village" TEXT NOT NULL,
    "photoPath" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLocation" (
    "id" UUID NOT NULL,
    "type" "StockLocationType" NOT NULL,
    "name" TEXT NOT NULL,
    "sellerId" UUID,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sourceId" UUID,
    "destinationId" UUID,
    "actorId" UUID NOT NULL,
    "saleId" UUID,
    "requestKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "minimumPricePaise" INTEGER NOT NULL DEFAULT 2500,
    "incentiveRatePaise" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPricePaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL,
    "status" "SaleStatus" NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedById" UUID,
    "rejectionReason" TEXT,
    "incentiveRatePaise" INTEGER,
    "incentiveAmountPaise" INTEGER,
    "requestKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "collectorId" UUID NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "pdfPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "saleId" UUID,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" UUID NOT NULL,
    "invoiceId" UUID,
    "notificationId" UUID,
    "channel" "DeliveryChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "providerRef" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_managerId_idx" ON "User"("managerId");

-- CreateIndex
CREATE INDEX "User_role_active_idx" ON "User"("role", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Customer_sellerId_idx" ON "Customer"("sellerId");

-- CreateIndex
CREATE INDEX "Customer_state_district_village_idx" ON "Customer"("state", "district", "village");

-- CreateIndex
CREATE INDEX "Customer_categoryId_idx" ON "Customer"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "StockLocation_sellerId_key" ON "StockLocation"("sellerId");

-- CreateIndex
CREATE INDEX "StockLocation_type_idx" ON "StockLocation"("type");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_saleId_key" ON "StockMovement"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_requestKey_key" ON "StockMovement"("requestKey");

-- CreateIndex
CREATE INDEX "StockMovement_sourceId_createdAt_idx" ON "StockMovement"("sourceId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_destinationId_createdAt_idx" ON "StockMovement"("destinationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_requestKey_key" ON "Sale"("requestKey");

-- CreateIndex
CREATE INDEX "Sale_sellerId_createdAt_idx" ON "Sale"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_status_createdAt_idx" ON "Sale"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");

-- CreateIndex
CREATE INDEX "PaymentRecord_saleId_idx" ON "PaymentRecord"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_saleId_key" ON "Invoice"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "Delivery_status_nextAttemptAt_idx" ON "Delivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordReset_userId_expiresAt_idx" ON "PasswordReset"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Business invariants Prisma cannot express in the schema.
CREATE UNIQUE INDEX "StockLocation_one_hq" ON "StockLocation" ("type") WHERE "type" = 'HQ';
ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_balance_nonnegative" CHECK ("balance" >= 0);
ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_seller_matches_type" CHECK (("type" = 'SELLER' AND "sellerId" IS NOT NULL) OR ("type" <> 'SELLER' AND "sellerId" IS NULL));
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_price_positive" CHECK ("unitPricePaise" > 0 AND "totalPaise" = "quantity" * "unitPricePaise");
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_valid" CHECK ("id" = 1 AND "minimumPricePaise" > 0 AND ("incentiveRatePaise" IS NULL OR "incentiveRatePaise" >= 0));
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_amount_positive" CHECK ("amountPaise" > 0 AND "mode" <> 'PENDING');
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_latitude_valid" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_longitude_valid" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180);
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_one_target" CHECK (("invoiceId" IS NULL) <> ("notificationId" IS NULL));
ALTER TABLE "User" ADD CONSTRAINT "User_login_required" CHECK (NULLIF("email", '') IS NOT NULL OR NULLIF("phone", '') IS NOT NULL);
ALTER TABLE "User" ADD CONSTRAINT "User_email_normalized" CHECK ("email" IS NULL OR "email" = lower(trim("email")));
ALTER TABLE "User" ADD CONSTRAINT "User_manager_assignment" CHECK (("role" = 'SELLER' AND "managerId" IS NOT NULL) OR ("role" <> 'SELLER' AND "managerId" IS NULL));
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_direction" CHECK (
  ("type" = 'RECEIPT' AND "sourceId" IS NULL AND "destinationId" IS NOT NULL AND "saleId" IS NULL) OR
  ("type" = 'TRANSFER' AND "sourceId" IS NOT NULL AND "destinationId" IS NOT NULL AND "sourceId" <> "destinationId" AND "saleId" IS NULL) OR
  ("type" = 'SALE' AND "sourceId" IS NOT NULL AND "destinationId" IS NULL AND "saleId" IS NOT NULL)
);
