import "dotenv/config";
import { createDatabase } from "../src/config/database.js";

async function main() {
  const db = createDatabase(process.env.DATABASE_URL!);
  try {
    const movements = await db.inventoryMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    console.log("Movements count:", movements.length);
    for (const m of movements) {
      console.log(m);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await db.$disconnect();
  }
}

main();
