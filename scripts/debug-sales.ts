import "dotenv/config";
import { createDatabase } from "../src/config/database.js";

async function main() {
  const db = createDatabase(process.env.DATABASE_URL!);
  try {
    const sales = await db.sale.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        customer: true,
        seller: true,
        lineItems: true,
      },
    });
    console.log("Found sales count:", sales.length);
    for (const s of sales) {
      console.log({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        customer: s.customer?.shopName || s.customer?.name,
        seller: s.seller?.name,
        quantity: s.quantity,
        totalPaise: s.totalPaise,
        status: s.status,
        createdAt: s.createdAt,
        lineItems: s.lineItems.map((i: any) => ({
          productId: i.productId,
          qty: i.quantity,
          unitPricePaise: i.unitPricePaise,
          totalPaise: i.totalPaise,
        })),
      });
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await db.$disconnect();
  }
}

main();
