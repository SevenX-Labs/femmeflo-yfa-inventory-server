import "dotenv/config";
import bcrypt from "bcrypt";
import { createDatabase } from "../src/config/database.js";
import { ALL_PERMISSIONS } from "../src/constants/permissions.js";

async function main() {
  const db = createDatabase(process.env.DATABASE_URL!);
  try {
    console.log("Seeding standard roles for testing & frontend demo...");

    // 1. Ensure admin exists
    const adminPasswordHash = await bcrypt.hash("AdminPassword123!", 12);
    const admin = await db.user.upsert({
      where: { email: "admin@femmeflo.com" },
      update: {
        active: true,
        passwordHash: adminPasswordHash,
      },
      create: {
        name: "Super Admin",
        email: "admin@femmeflo.com",
        passwordHash: adminPasswordHash,
        role: "SUPER_ADMIN",
        active: true,
      },
    });
    console.log("Admin ready:", admin.email);

    // 2. Ensure manager exists
    const managerPasswordHash = await bcrypt.hash("ManagerPassword123!", 12);
    const manager = await db.user.upsert({
      where: { email: "manager@femmeflo.com" },
      update: {
        active: true,
        passwordHash: managerPasswordHash,
        permissions: [...ALL_PERMISSIONS],
        state: "Maharashtra",
        district: "Mumbai",
      },
      create: {
        name: "Demo Manager",
        email: "manager@femmeflo.com",
        phone: "+919800000001",
        passwordHash: managerPasswordHash,
        role: "MANAGER",
        permissions: [...ALL_PERMISSIONS],
        state: "Maharashtra",
        district: "Mumbai",
        active: true,
      },
    });
    console.log("Manager ready:", manager.email);

    // 3. Ensure seller exists and is assigned to manager
    const sellerPasswordHash = await bcrypt.hash("SellerPassword123!", 12);
    const seller = await db.user.upsert({
      where: { email: "seller@femmeflo.com" },
      update: {
        active: true,
        passwordHash: sellerPasswordHash,
        managerId: manager.id,
        state: "Maharashtra",
        district: "Mumbai",
      },
      create: {
        name: "Demo Seller",
        email: "seller@femmeflo.com",
        phone: "+919800000002",
        passwordHash: sellerPasswordHash,
        role: "SELLER",
        managerId: manager.id,
        state: "Maharashtra",
        district: "Mumbai",
        active: true,
      },
    });
    console.log("Seller ready:", seller.email);

    // Ensure seller has a stock location
    const existingLoc = await db.stockLocation.findFirst({
      where: { sellerId: seller.id },
    });
    if (!existingLoc) {
      await db.stockLocation.create({
        data: {
          type: "SELLER",
          name: "Demo Seller Location",
          sellerId: seller.id,
        },
      });
      console.log("Stock location created for seller");
    }

    // Ensure HQ stock location exists
    const hq = await db.stockLocation.findFirst({ where: { type: "HQ" } });
    if (!hq) {
      await db.stockLocation.create({
        data: {
          type: "HQ",
          name: "HQ Central Warehouse",
        },
      });
      console.log("HQ location created");
    }

    console.log("All standard roles successfully seeded!");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main();
