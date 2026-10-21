import "dotenv/config";
import { createDatabase } from "../src/config/database.js";

async function main() {
  const db = createDatabase(process.env.DATABASE_URL!);
  try {
    const migrations: any = await db.$queryRawUnsafe(`SELECT migration_name FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 5;`);
    console.log("Recent migrations:", migrations);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await db.$disconnect();
  }
}

main();
