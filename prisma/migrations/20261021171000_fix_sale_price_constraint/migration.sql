-- Drop the single-product price constraint that prevents low-price approval and multi-item sales
ALTER TABLE "Sale" DROP CONSTRAINT IF EXISTS "Sale_price_positive";

-- Add check constraints compatible with multi-product architecture
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_total_positive" CHECK ("totalPaise" > 0);
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_price_nonnegative" CHECK ("unitPricePaise" >= 0);
