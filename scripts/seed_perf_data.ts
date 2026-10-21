import { createDatabase } from "../src/config/database.js";
import { loadAuthEnvironment } from "../src/config/env.js";
import bcrypt from "bcrypt";

const authEnv = loadAuthEnvironment();
if (!authEnv) { console.error("No DATABASE_URL"); process.exit(1); }
const db = createDatabase(authEnv.DATABASE_URL);

async function main() {
  console.log("Seeding performance test data...");
  const passwordHash = await bcrypt.hash("Test@1234", 12);

  // Categories
  const catNames = ["General Store", "Medical Store", "Grocery", "Cosmetics", "Pharmacy", "Supermarket", "Kirana", "Wholesale"];
  const categories = [];
  for (const name of catNames) {
    const cat = await db.category.upsert({
      where: { name },
      update: {},
      create: { name, active: true },
    });
    categories.push(cat);
  }
  console.log(`Categories: ${categories.length}`);

  // Products
  const productNames = ["FemmeFlo Regular", "FemmeFlo XL", "FemmeFlo Night", "FemmeFlo Ultra Thin"];
  const products = [];
  for (const name of productNames) {
    const existing = await db.product.findFirst({ where: { name } });
    if (existing) { products.push(existing); continue; }
    const product = await db.product.create({
      data: { name, sku: name.replace(/\s+/g, "-").toUpperCase(), basePricePaise: 3500, minimumPricePaise: 2500, active: true },
    });
    products.push(product);
  }
  console.log(`Products: ${products.length}`);

  // Business settings
  await db.businessSettings.upsert({
    where: { id: 1 },
    update: { defaultProductId: products[0]!.id, incentiveRatePaise: 200 },
    create: { id: 1, minimumPricePaise: 2500, incentiveRatePaise: 200, defaultProductId: products[0]!.id },
  });

  // HQ stock location
  let hq = await db.stockLocation.findFirst({ where: { type: "HQ" } });
  if (!hq) {
    hq = await db.stockLocation.create({ data: { type: "HQ", name: "Headquarters (HQ)", balance: 50000 } });
  } else {
    await db.stockLocation.update({ where: { id: hq.id }, data: { balance: 50000 } });
  }

  // Managers (5)
  const states = ["Maharashtra", "Karnataka", "Gujarat", "Tamil Nadu", "Rajasthan"];
  const districts = ["Pune", "Bangalore", "Ahmedabad", "Chennai", "Jaipur"];
  const managers = [];
  for (let i = 0; i < 5; i++) {
    const phone = `+91900000000${i}`;
    let mgr = await db.user.findFirst({ where: { phone } });
    if (!mgr) {
      mgr = await db.user.create({
        data: {
          name: `Manager ${i + 1}`,
          phone,
          email: `manager${i + 1}@test.com`,
          passwordHash,
          role: "MANAGER",
          active: true,
          state: states[i],
          district: districts[i],
          employeeCode: `MGR${String(i + 1).padStart(3, "0")}`,
          incentiveRatePaise: 150,
        },
      });
    }
    managers.push(mgr);
  }
  console.log(`Managers: ${managers.length}`);

  // Sellers (50, 10 per manager)
  const sellers = [];
  for (let mi = 0; mi < managers.length; mi++) {
    const mgr = managers[mi]!;
    for (let si = 0; si < 10; si++) {
      const idx = mi * 10 + si;
      const phone = `+919100${String(idx).padStart(5, "0")}`;
      let seller = await db.user.findFirst({ where: { phone } });
      if (!seller) {
        seller = await db.user.create({
          data: {
            name: `Seller ${idx + 1}`,
            phone,
            email: `seller${idx + 1}@test.com`,
            passwordHash,
            role: "SELLER",
            active: true,
            managerId: mgr.id,
            state: mgr.state,
            district: mgr.district,
            village: `Village ${si + 1}`,
            employeeCode: `SLR${String(idx + 1).padStart(3, "0")}`,
            incentiveRatePaise: 200,
          },
        });
        // Create stock location for seller
        await db.stockLocation.create({
          data: { type: "SELLER", name: `${seller.name} Stock`, sellerId: seller.id, balance: 100 + si * 10 },
        });
      }
      sellers.push(seller);
    }
  }
  console.log(`Sellers: ${sellers.length}`);

  // Customers (500, ~10 per seller)
  const villages = ["Baner", "Kothrud", "Hinjewadi", "Wakad", "Hadapsar", "Koregaon", "Pimpri", "Chinchwad", "Shivaji Nagar", "Camp"];
  const customers = [];
  for (let si = 0; si < sellers.length; si++) {
    const seller = sellers[si]!;
    for (let ci = 0; ci < 10; ci++) {
      const idx = si * 10 + ci;
      const phone = `+919200${String(idx).padStart(5, "0")}`;
      let cust = await db.customer.findFirst({ where: { phone } });
      if (!cust) {
        const admin = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
        cust = await db.customer.create({
          data: {
            shopName: `Shop ${idx + 1}`,
            contactName: `Contact ${idx + 1}`,
            phone,
            categoryId: categories[ci % categories.length]!.id,
            sellerId: seller.id,
            createdById: admin!.id,
            state: seller.state || "Maharashtra",
            district: seller.district || "Pune",
            village: villages[ci % villages.length]!,
            active: true,
          },
        });
      }
      customers.push(cust);
    }
  }
  console.log(`Customers: ${customers.length}`);

  // Sales (2000 confirmed + 50 pending)
  let salesCreated = 0;
  const existingSalesCount = await db.sale.count();
  if (existingSalesCount < 100) {
    for (let i = 0; i < 2000; i++) {
      const seller = sellers[i % sellers.length]!;
      const sellerCustomers = customers.filter(c => c.sellerId === seller.id);
      if (sellerCustomers.length === 0) continue;
      const customer = sellerCustomers[i % sellerCustomers.length]!;
      const qty = 5 + (i % 20);
      const unitPrice = 2500 + (i % 10) * 100;
      const totalPaise = qty * unitPrice;
      const daysAgo = Math.floor(i / 20);
      const createdAt = new Date(Date.now() - daysAgo * 86400000);

      await db.sale.create({
        data: {
          sellerId: seller.id,
          customerId: customer.id,
          quantity: qty,
          unitPricePaise: unitPrice,
          totalPaise,
          paymentMode: i % 3 === 0 ? "CASH" : i % 3 === 1 ? "BANK" : "PENDING",
          status: "CONFIRMED",
          confirmedAt: createdAt,
          createdAt,
          incentiveRatePaise: 200,
          incentiveAmountPaise: qty * 200,
        },
      });
      salesCreated++;
    }
    // 50 pending sales
    for (let i = 0; i < 50; i++) {
      const seller = sellers[i % sellers.length]!;
      const sellerCustomers = customers.filter(c => c.sellerId === seller.id);
      if (sellerCustomers.length === 0) continue;
      const customer = sellerCustomers[0]!;
      await db.sale.create({
        data: {
          sellerId: seller.id,
          customerId: customer.id,
          quantity: 3,
          unitPricePaise: 2000,
          totalPaise: 6000,
          paymentMode: "CASH",
          status: "PENDING_APPROVAL",
        },
      });
      salesCreated++;
    }
  }
  console.log(`Sales created: ${salesCreated} (existing: ${existingSalesCount})`);

  // Stock movements (transfers to sellers)
  const existingMovements = await db.stockMovement.count();
  if (existingMovements < 100) {
    const admin = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
    // Receipt into HQ
    await db.stockMovement.create({
      data: { type: "RECEIPT", quantity: 50000, destinationId: hq.id, actorId: admin!.id },
    });
    // Transfers to sellers
    for (const seller of sellers) {
      const loc = await db.stockLocation.findUnique({ where: { sellerId: seller.id } });
      if (!loc) continue;
      await db.stockMovement.create({
        data: { type: "TRANSFER", quantity: loc.balance, sourceId: hq.id, destinationId: loc.id, actorId: admin!.id },
      });
    }
    console.log("Stock movements created");
  }

  // Incentive adjustments and payouts
  const existingAdj = await db.incentiveAdjustment.count();
  if (existingAdj < 10) {
    const admin = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
    for (let i = 0; i < sellers.length; i++) {
      const seller = sellers[i]!;
      if (i % 5 === 0) {
        await db.incentiveAdjustment.create({
          data: { userId: seller.id, type: "ADD", amountPaise: 5000, reason: "Bonus", createdById: admin!.id },
        });
      }
      if (i % 7 === 0) {
        await db.incentivePayout.create({
          data: { userId: seller.id, amountPaise: 10000, paymentMethod: "BANK", createdById: admin!.id },
        });
      }
    }
    console.log("Incentive data created");
  }

  console.log("Done seeding.");
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
