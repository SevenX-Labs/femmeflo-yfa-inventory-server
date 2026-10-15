import "dotenv/config";
import bcrypt from "bcrypt";
import { createDatabase } from "../src/config/database.js";
import { ALL_PERMISSIONS } from "../src/constants/permissions.js";

async function main() {
  const db = createDatabase(process.env.DATABASE_URL!);
  try {
    console.log("Seeding standard roles for testing & frontend demo...");

    const adminEmail = (process.env.ADMIN_EMAIL || "admin@femmeflo.in").trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || "AdminPassword123!";
    const adminName = process.env.ADMIN_NAME || "Super Admin";

    // 1. Ensure admin exists (preserve existing password if already present)
    const existingAdmin = await db.user.findFirst({
      where: {
        OR: [
          { role: "SUPER_ADMIN" },
          { email: adminEmail },
        ],
      },
    });

    let admin;
    if (existingAdmin) {
      admin = await db.user.update({
        where: { id: existingAdmin.id },
        data: {
          email: adminEmail,
          role: "SUPER_ADMIN",
          active: true,
        },
      });
      console.log("Admin ready (preserved existing password):", admin.email);
    } else {
      const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
      admin = await db.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          passwordHash: adminPasswordHash,
          role: "SUPER_ADMIN",
          active: true,
        },
      });
      console.log("Admin created from env:", admin.email);
    }

    // 2. Ensure manager exists (preserve existing password if present)
    const existingManager = await db.user.findFirst({ where: { email: "manager@femmeflo.com" } });
    let manager;
    if (existingManager) {
      manager = await db.user.update({
        where: { id: existingManager.id },
        data: {
          active: true,
          permissions: [...ALL_PERMISSIONS],
          state: "Maharashtra",
          district: "Mumbai",
        },
      });
      console.log("Manager ready (preserved password):", manager.email);
    } else {
      const managerPasswordHash = await bcrypt.hash("ManagerPassword123!", 12);
      manager = await db.user.create({
        data: {
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
      console.log("Manager created:", manager.email);
    }

    // 3. Ensure seller exists and is assigned to manager (preserve existing password if present)
    const existingSeller = await db.user.findFirst({ where: { email: "seller@femmeflo.com" } });
    let seller;
    if (existingSeller) {
      seller = await db.user.update({
        where: { id: existingSeller.id },
        data: {
          active: true,
          managerId: manager.id,
          state: "Maharashtra",
          district: "Mumbai",
        },
      });
      console.log("Seller ready (preserved password):", seller.email);
    } else {
      const sellerPasswordHash = await bcrypt.hash("SellerPassword123!", 12);
      seller = await db.user.create({
        data: {
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
      console.log("Seller created:", seller.email);
    }

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
