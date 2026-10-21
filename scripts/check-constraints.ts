import "dotenv/config";
import { createDatabase } from "../src/config/database.js";

async function main() {
  const db = createDatabase(process.env.DATABASE_URL!);
  try {
    const res: any = await db.$queryRawUnsafe(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      JOIN pg_class cl ON cl.oid = c.conrelid
      WHERE cl.relname = 'Sale';
    `);
    console.log("Constraints on Sale table:", res);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await db.$disconnect();
  }
}

main();
