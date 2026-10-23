import "dotenv/config";
import { createDatabase } from "../src/config/database.js";

async function main() {
  const db = createDatabase(process.env.DATABASE_URL!);
  try {
    console.log("Applying performance indexes to PostgreSQL...");
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Customer_sellerId_createdAt_idx" ON "Customer" ("sellerId", "createdAt" DESC);
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Customer_sellerId_active_idx" ON "Customer" ("sellerId", "active");
    `);
    console.log("Performance indexes applied successfully!");
  } catch (err) {
    console.error("Index creation error:", err);
  } finally {
    await db.$disconnect();
  }
}

main();
