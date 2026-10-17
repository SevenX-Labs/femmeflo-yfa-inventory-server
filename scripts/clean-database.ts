import "dotenv/config";
import bcrypt from "bcrypt";
import { createDatabase } from "../src/config/database.js";

const DEFAULT_INITIAL_PASSWORD = "femmeflo@2026";

async function main() {
  const db = createDatabase(process.env.DATABASE_URL!);
  try {
    const adminName = process.env.ADMIN_NAME || "Super Admin";
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@femmeflo.in").trim().toLowerCase();

    console.log("Cleaning database to remove all data and retain only clean Super Admin seed...");

    // 1. Purge all incentive tables
    await db.incentivePayoutAllocation.deleteMany({});
    await db.incentivePayout.deleteMany({});
    await db.incentiveAdjustment.deleteMany({});
    await db.incentiveRateHistory.deleteMany({});

    // 2. Purge orders, transactions & deliveries
    await db.delivery.deleteMany({});
    await db.notification.deleteMany({});
    await db.paymentRecord.deleteMany({});
    await db.invoice.deleteMany({});
    await db.stockMovement.deleteMany({});
    await db.sale.deleteMany({});
    await db.customer.deleteMany({});
    await db.category.deleteMany({});
    await db.passwordReset.deleteMany({});

    // 3. Purge non-HQ stock locations and reset HQ balance
    await db.stockLocation.deleteMany({ where: { type: { not: "HQ" } } });
    await db.stockLocation.updateMany({ where: { type: "HQ" }, data: { balance: 0 } });

    // 4. Remove all users except the designated Super Admin
    const deletedUsers = await db.user.deleteMany({
      where: {
        email: { not: adminEmail },
      },
    });
    console.log("Deleted other users:", deletedUsers.count);

    // 5. Ensure Super Admin account is cleanly configured with default credentials
    const passwordHash = await bcrypt.hash(DEFAULT_INITIAL_PASSWORD, 12);
    const existingAdmin = await db.user.findFirst({
      where: { email: adminEmail },
    });

    let admin;
    if (existingAdmin) {
      admin = await db.user.update({
        where: { id: existingAdmin.id },
        data: {
          name: adminName,
          email: adminEmail,
          passwordHash,
          role: "SUPER_ADMIN",
          active: true,
          managerId: null,
          incentiveRatePaise: null,
          tokenVersion: { increment: 1 },
        },
      });
      console.log(`Super Admin updated and reset: ${adminEmail} (ID: ${admin.id})`);
    } else {
      admin = await db.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          passwordHash,
          role: "SUPER_ADMIN",
          active: true,
          managerId: null,
          incentiveRatePaise: null,
        },
      });
      console.log(`Super Admin created in DB: ${admin.email} (ID: ${admin.id})`);
    }

    // 6. Ensure default BusinessSettings and HQ warehouse
    await db.businessSettings.upsert({
      where: { id: 1 },
      create: { id: 1, incentiveRatePaise: 100 },
      update: { incentiveRatePaise: 100 },
    });

    const hq = await db.stockLocation.findFirst({ where: { type: "HQ" } });
    if (!hq) {
      await db.stockLocation.create({ data: { type: "HQ", name: "HQ Central Warehouse", balance: 0 } });
    }

    const allUsers = await db.user.findMany({ select: { id: true, email: true, name: true, role: true } });
    console.log("Current Users in DB:", allUsers);
    console.log("==========================================");
    console.log("Database reset complete. Only Super Admin exists:");
    console.log(`Email:    ${admin.email}`);
    console.log(`Password: ${DEFAULT_INITIAL_PASSWORD}`);
    console.log(`Role:     ${admin.role}`);
    console.log("==========================================");
  } catch (err) {
    console.error("Cleanup failed:", err);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main();
