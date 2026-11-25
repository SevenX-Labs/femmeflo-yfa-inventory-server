-- CreateIndex: Quick search, foreign-key scoping, and list sorting indexes (non-destructive)
CREATE INDEX IF NOT EXISTS "User_managerId_active_idx" ON "User"("managerId", "active");
CREATE INDEX IF NOT EXISTS "User_role_createdAt_idx" ON "User"("role", "createdAt");
CREATE INDEX IF NOT EXISTS "User_name_idx" ON "User"("name");

CREATE INDEX IF NOT EXISTS "Customer_createdById_idx" ON "Customer"("createdById");
CREATE INDEX IF NOT EXISTS "Customer_active_createdAt_idx" ON "Customer"("active", "createdAt");
CREATE INDEX IF NOT EXISTS "Customer_shopName_idx" ON "Customer"("shopName");
CREATE INDEX IF NOT EXISTS "Customer_contactName_idx" ON "Customer"("contactName");

CREATE INDEX IF NOT EXISTS "Product_active_name_idx" ON "Product"("active", "name");

CREATE INDEX IF NOT EXISTS "Sale_sellerId_status_createdAt_idx" ON "Sale"("sellerId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Sale_status_paymentMode_createdAt_idx" ON "Sale"("status", "paymentMode", "createdAt");
CREATE INDEX IF NOT EXISTS "Sale_customerId_createdAt_idx" ON "Sale"("customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "Sale_decidedById_idx" ON "Sale"("decidedById");

CREATE INDEX IF NOT EXISTS "Invoice_createdAt_idx" ON "Invoice"("createdAt");

CREATE INDEX IF NOT EXISTS "Notification_recipientId_readAt_createdAt_idx" ON "Notification"("recipientId", "readAt", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_saleId_idx" ON "Notification"("saleId");

CREATE INDEX IF NOT EXISTS "Shift_sellerId_status_startTime_idx" ON "Shift"("sellerId", "status", "startTime");
CREATE INDEX IF NOT EXISTS "Shift_status_startTime_idx" ON "Shift"("status", "startTime");

CREATE INDEX IF NOT EXISTS "ShiftVisit_shiftId_checkInTime_idx" ON "ShiftVisit"("shiftId", "checkInTime");
CREATE INDEX IF NOT EXISTS "ShiftVisit_shopName_idx" ON "ShiftVisit"("shopName");
