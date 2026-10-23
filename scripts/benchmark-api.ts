import "dotenv/config";
import { createDatabase } from "../src/config/database.js";

async function benchmark() {
  const db = createDatabase(process.env.DATABASE_URL!);
  try {
    console.log("Starting DB benchmark...");

    // Warm-up
    await db.$queryRaw`SELECT 1`;

    // Test 1: Category lookup
    const t0 = performance.now();
    const cat = await db.category.findFirst();
    console.log(`findFirst Category: ${(performance.now() - t0).toFixed(1)}ms`);

    // Test 2: User lookup
    const t1 = performance.now();
    const user = await db.user.findFirst();
    console.log(`findFirst User: ${(performance.now() - t1).toFixed(1)}ms`);

    // Test 3: Customer count
    const t2 = performance.now();
    const count = await db.customer.count();
    console.log(`Customer count (${count} rows): ${(performance.now() - t2).toFixed(1)}ms`);

    // Test 4: Customer findMany
    const t3 = performance.now();
    const customers = await db.customer.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { id: true, name: true } },
        seller: { select: { id: true, name: true, phone: true } },
      },
    });
    console.log(`Customer findMany (take 20): ${(performance.now() - t3).toFixed(1)}ms`);

    // Test 5: Parallel count + findMany (simulating list endpoint)
    const t4 = performance.now();
    await Promise.all([
      db.customer.count(),
      db.customer.findMany({
        take: 20,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        include: {
          category: { select: { id: true, name: true } },
          seller: { select: { id: true, name: true, phone: true } },
        },
      }),
    ]);
    console.log(`Parallel count + findMany: ${(performance.now() - t4).toFixed(1)}ms`);

    // Test 6: Sales findMany
    const t5 = performance.now();
    await db.sale.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, shopName: true } },
        lineItems: { include: { product: true } },
      },
    });
    console.log(`Sales findMany with lineItems: ${(performance.now() - t5).toFixed(1)}ms`);

  } finally {
    await db.$disconnect();
  }
}

benchmark().catch(console.error);
