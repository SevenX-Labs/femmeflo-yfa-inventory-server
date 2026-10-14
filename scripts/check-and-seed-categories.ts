import "dotenv/config";
import { createDatabase } from "../src/config/database.js";

async function run() {
  const db = createDatabase(process.env.DATABASE_URL!);
  try {
    const standardCategories = [
      "General Store",
      "Medical & Pharmacy",
      "Kirana Store",
      "Supermarket",
      "Cosmetics & Beauty",
      "Rural Retail Store",
      "Wholesale Distributor",
    ];

    console.log("Checking standard categories in DB...");
    for (const name of standardCategories) {
      const existing = await db.category.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });

      if (!existing) {
        const created = await db.category.create({
          data: { name, active: true },
        });
        console.log(`Seeded category: ${created.name} (${created.id})`);
      } else {
        console.log(`Category exists: ${existing.name}`);
      }
    }

    const all = await db.category.findMany({ where: { active: true }, orderBy: { name: "asc" } });
    console.log(`Total active categories available: ${all.length}`);
  } catch (err) {
    console.error("Error seeding categories:", err);
  } finally {
    await db.$disconnect();
  }
}

run();
