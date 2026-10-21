-- CreateIndex
CREATE INDEX IF NOT EXISTS "Customer_createdAt_idx" ON "Customer"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockMovement_type_idx" ON "StockMovement"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");
