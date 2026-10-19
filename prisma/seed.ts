import "dotenv/config";
import bcrypt from "bcrypt";
import { createDatabase } from "../src/config/database.js";

const DEFAULT_INITIAL_PASSWORD = "femmeflo@2026";

async function main() {
  // Permission guard: Prevent any automated or accidental seeding without explicit permission
  if (process.env.ALLOW_DB_SEED !== "true") {
    console.warn("\n==================================================================");
    console.warn("⚠️  [SAFETY BLOCK] Database seed halted: Permission required.");
    console.warn("To prevent accidental data alteration or loss, seed is blocked.");
    console.warn("Set ALLOW_DB_SEED=true in your environment to permit execution.");
    console.warn("==================================================================\n");
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const database = createDatabase(databaseUrl);
  try {
    const adminName = process.env.ADMIN_NAME || "Super Admin";
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@femmeflo.in").trim().toLowerCase();

    // Data removal is strictly guarded and never runs by default
    const allowPurge = process.env.ALLOW_DATA_PURGE === "YES_I_AM_SURE_PURGE_ALL_DATA";

    if (allowPurge) {
      console.warn("⚠️  ALLOW_DATA_PURGE permission verified. Purging transactional tables...");
      await database.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(71230421)`;

        // 1. Purge incentive records
        await tx.incentivePayoutAllocation.deleteMany({});
        await tx.incentivePayout.deleteMany({});
        await tx.incentiveAdjustment.deleteMany({});
        await tx.incentiveRateHistory.deleteMany({});

        // 2. Purge orders, transactions & deliveries (CATEGORIES ARE NEVER DELETED)
        await tx.delivery.deleteMany({});
        await tx.notification.deleteMany({});
        await tx.paymentRecord.deleteMany({});
        await tx.invoice.deleteMany({});
        await tx.stockMovement.deleteMany({});
        await tx.sale.deleteMany({});
        await tx.customer.deleteMany({});
        await tx.passwordReset.deleteMany({});

        // 3. Purge non-HQ stock locations
        await tx.stockLocation.deleteMany({ where: { type: { not: "HQ" } } });
        await tx.stockLocation.updateMany({ where: { type: "HQ" }, data: { balance: 0 } });

        // 4. Purge users except Super Admin
        await tx.user.deleteMany({
          where: {
            email: { not: adminEmail },
          },
        });
      });
      console.info("Transactional data purge completed.");
    } else {
      console.info("Running in SAFE mode (no data will be deleted or purged).");
    }

    // Safe, idempotent initialization
    const passwordHash = await bcrypt.hash(DEFAULT_INITIAL_PASSWORD, 12);
    const existingAdmin = await database.user.findFirst({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      console.info(`Super Admin already exists (${adminEmail}). Leaving existing credentials untouched.`);
    } else {
      await database.user.create({
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

    // Ensure default BusinessSettings and HQ warehouse exist without overwriting custom changes
    const existingSettings = await database.businessSettings.findFirst({ where: { id: 1 } });
    if (!existingSettings) {
      await database.businessSettings.create({
        data: { id: 1, incentiveRatePaise: 100 },
      });
    }

    const hq = await database.stockLocation.findFirst({ where: { type: "HQ" } });
    if (!hq) {
      await database.stockLocation.create({ data: { type: "HQ", name: "HQ Central Warehouse", balance: 0 } });
    }

    console.info("Seed process finished safely.");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  } finally {
    await database.$disconnect();
  }
}

main();
