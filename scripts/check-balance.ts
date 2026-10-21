import "dotenv/config";
import { createDatabase } from "../src/config/database.js";

async function main() {
  const db = createDatabase(process.env.DATABASE_URL!);
  try {
    const locs = await db.stockLocation.findMany({
      include: {
        productBalances: {
          include: { product: true },
        },
        seller: true,
      },
    });
    for (const loc of locs) {
      console.log(`Location: ${loc.type} (${loc.name}) - User: ${loc.seller?.name || "None"} - Balance: ${loc.balance}`);
      for (const pb of loc.productBalances) {
        console.log(`   Product: ${pb.product.name} - Balance: ${pb.balance}`);
      }
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await db.$disconnect();
  }
}

main();
