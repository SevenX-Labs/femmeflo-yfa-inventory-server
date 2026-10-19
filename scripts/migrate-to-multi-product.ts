import "dotenv/config";
import { createDatabase } from "../src/config/database.js";

async function main() {
  const db = createDatabase(process.env.DATABASE_URL!);

  try {
    console.log("Starting multi-product data migration...");

    const settings = await db.businessSettings.findUnique({ where: { id: 1 } });
    const minPrice = settings?.minimumPricePaise ?? 2500;

    // 1. Create default product
    let defaultProduct = await db.product.findFirst({ where: { name: "FemmeFlo Sanitary Napkins (Pack)" } });
    if (!defaultProduct) {
      defaultProduct = await db.product.create({
        data: {
          name: "FemmeFlo Sanitary Napkins (Pack)",
          sku: "FEMMEFLO-PACK-001",
          basePricePaise: 2500,
          minimumPricePaise: minPrice,
          active: true,
        },
      });
      console.log("Created default product:", defaultProduct.id);
    } else {
      console.log("Default product already exists:", defaultProduct.id);
    }

    // 2. Set defaultProductId in BusinessSettings
    await db.businessSettings.upsert({
      where: { id: 1 },
      update: { defaultProductId: defaultProduct.id },
      create: { id: 1, minimumPricePaise: minPrice, defaultProductId: defaultProduct.id },
    });
    console.log("Set defaultProductId in BusinessSettings");

    // 3. Create ProductBalance for each StockLocation
    const locations = await db.stockLocation.findMany();
    let balancesCreated = 0;
    for (const loc of locations) {
      const existing = await db.productBalance.findUnique({
        where: { productId_stockLocationId: { productId: defaultProduct.id, stockLocationId: loc.id } },
      });
      if (!existing) {
        await db.productBalance.create({
          data: {
            productId: defaultProduct.id,
            stockLocationId: loc.id,
            balance: loc.balance,
          },
        });
        balancesCreated++;
      }
    }
    console.log(`Created ${balancesCreated} ProductBalance records for ${locations.length} locations`);

    // 4. Backfill StockMovement.productId
    const movementsUpdated = await db.stockMovement.updateMany({
      where: { productId: null },
      data: { productId: defaultProduct.id },
    });
    console.log(`Backfilled productId on ${movementsUpdated.count} StockMovement records`);

    // 5. Create SaleLineItem for each existing Sale that has no line items
    const sales = await db.sale.findMany({
      where: { lineItems: { none: {} } },
      select: { id: true, quantity: true, unitPricePaise: true, totalPaise: true },
    });

    if (sales.length > 0) {
      await db.saleLineItem.createMany({
        data: sales.map((sale) => ({
          saleId: sale.id,
          productId: defaultProduct.id,
          quantity: sale.quantity,
          unitPricePaise: sale.unitPricePaise,
          totalPaise: sale.totalPaise,
        })),
      });
      console.log(`Created SaleLineItem records for ${sales.length} existing sales`);
    } else {
      console.log("No sales without line items found");
    }

    console.log("Migration complete!");
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
