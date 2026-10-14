import "dotenv/config";
import { createDatabase } from "../src/config/database.js";

const STANDARD_CATEGORIES = [
  "General Store",
  "Medical & Pharmacy",
  "Kirana Store",
  "Supermarket",
  "Cosmetics & Beauty",
  "Rural Retail Store",
  "Wholesale Distributor",
];

async function run() {
  const db = createDatabase(process.env.DATABASE_URL!);
  try {
    console.log("=== CLEANING UP CATEGORIES IN DATABASE ===");

    // 1. Ensure all 7 standard categories exist and active
    const standardMap = new Map<string, string>();
    for (const name of STANDARD_CATEGORIES) {
      const cat = await db.category.upsert({
        where: { name },
        update: { active: true },
        create: { name, active: true },
      });
      standardMap.set(name.toLowerCase(), cat.id);
      console.log(`Standard category ready: ${cat.name} (${cat.id})`);
    }

    const defaultCategoryId = standardMap.get("general store")!;

    // 2. Find all categories
    const allCategories = await db.category.findMany({
      include: {
        _count: {
          select: { customers: true },
        },
      },
    });

    const standardNamesLower = new Set(STANDARD_CATEGORIES.map((s) => s.toLowerCase()));
    const unwanted = allCategories.filter((c) => !standardNamesLower.has(c.name.toLowerCase()));

    console.log(`\nFound ${unwanted.length} unwanted categories.`);

    for (const cat of unwanted) {
      if (cat._count.customers > 0) {
        console.log(`Reassigning ${cat._count.customers} customer(s) from "${cat.name}" to "General Store"...`);
        await db.customer.updateMany({
          where: { categoryId: cat.id },
          data: { categoryId: defaultCategoryId },
        });
      }

      // Delete the unwanted category
      await db.category.delete({
        where: { id: cat.id },
      });
      console.log(`Deleted category: "${cat.name}" (${cat.id})`);
    }

    // 3. Verify final list
    const remaining = await db.category.findMany({
      orderBy: { name: "asc" },
    });

    console.log(`\n=== REMAINING CATEGORIES (${remaining.length}) ===`);
    for (const c of remaining) {
      console.log(`- ${c.name} (active: ${c.active})`);
    }
  } catch (err) {
    console.error("Cleanup error:", err);
  } finally {
    await db.$disconnect();
  }
}

run();
