import "dotenv/config";
import { createDatabase } from "../src/config/database.js";

async function main() {
  const db = createDatabase(process.env.DATABASE_URL!);
  try {
    console.log("Dropping old constraint...");
    await db.$executeRawUnsafe(`ALTER TABLE "Sale" DROP CONSTRAINT IF EXISTS "Sale_price_positive";`);
    await db.$executeRawUnsafe(`ALTER TABLE "Sale" DROP CONSTRAINT IF EXISTS "Sale_total_positive";`);
    await db.$executeRawUnsafe(`ALTER TABLE "Sale" DROP CONSTRAINT IF EXISTS "Sale_price_nonnegative";`);

    console.log("Adding multi-product compatible constraints...");
    await db.$executeRawUnsafe(`ALTER TABLE "Sale" ADD CONSTRAINT "Sale_total_positive" CHECK ("totalPaise" >= 0);`);
    await db.$executeRawUnsafe(`ALTER TABLE "Sale" ADD CONSTRAINT "Sale_price_nonnegative" CHECK ("unitPricePaise" >= 0);`);

    console.log("Migration applied successfully!");

    const res: any = await db.$queryRawUnsafe(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE cl.relname = 'Sale';
    `);
    console.log("Updated constraints on Sale table:", res);
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await db.$disconnect();
  }
}

main();
