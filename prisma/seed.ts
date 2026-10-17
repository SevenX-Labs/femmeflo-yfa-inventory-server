import "dotenv/config";
import bcrypt from "bcrypt";
import { createDatabase } from "../src/config/database.js";

const DEFAULT_INITIAL_PASSWORD = "femmeflo@2026";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const database = createDatabase(databaseUrl);
  try {
    const adminName = process.env.ADMIN_NAME || "Super Admin";
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@femmeflo.in").trim().toLowerCase();

    console.info("Purging all data and restoring clean initial admin seed...");

    await database.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(71230421)`;

      // 1. Purge all child & incentive records
      await tx.incentivePayoutAllocation.deleteMany({});
      await tx.incentivePayout.deleteMany({});
      await tx.incentiveAdjustment.deleteMany({});
      await tx.incentiveRateHistory.deleteMany({});

      // 2. Purge orders, transactions & deliveries
      await tx.delivery.deleteMany({});
      await tx.notification.deleteMany({});
      await tx.paymentRecord.deleteMany({});
      await tx.invoice.deleteMany({});
      await tx.stockMovement.deleteMany({});
      await tx.sale.deleteMany({});
      await tx.customer.deleteMany({});
      await tx.category.deleteMany({});
      await tx.passwordReset.deleteMany({});

      // 3. Purge non-HQ stock locations and reset HQ balance
      await tx.stockLocation.deleteMany({ where: { type: { not: "HQ" } } });
      await tx.stockLocation.updateMany({ where: { type: "HQ" }, data: { balance: 0 } });

      // 4. Purge all users except the designated Super Admin email
      await tx.user.deleteMany({
        where: {
          email: { not: adminEmail },
        },
      });

      // 5. Ensure Super Admin account is cleanly configured with default password
      const passwordHash = await bcrypt.hash(DEFAULT_INITIAL_PASSWORD, 12);
      const existingAdmin = await tx.user.findFirst({
        where: { email: adminEmail },
      });

      if (existingAdmin) {
        await tx.user.update({
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
        console.info(`Super Admin verified & reset to clean credentials: ${adminEmail}`);
      } else {
        await tx.user.create({
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
        console.info(`Initial Super Admin created in DB with email: ${adminEmail}`);
      }

      // 6. Ensure default BusinessSettings and HQ warehouse exist
      await tx.businessSettings.upsert({
        where: { id: 1 },
        create: { id: 1, incentiveRatePaise: 100 },
        update: { incentiveRatePaise: 100 },
      });

      const hq = await tx.stockLocation.findFirst({ where: { type: "HQ" } });
      if (!hq) {
        await tx.stockLocation.create({ data: { type: "HQ", name: "HQ Central Warehouse", balance: 0 } });
      }
    });

    console.info("Database reset successful: All data removed. Only Super Admin seeded.");
  } catch (error) {
    console.error("Seed / cleanup failed:", error);
    process.exitCode = 1;
  } finally {
    await database.$disconnect();
  }
}

main();
