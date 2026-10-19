import "dotenv/config";
import { createDatabase } from "../src/config/database.js";

async function main() {
  if (process.env.CONFIRM_CLEAN_DATABASE !== "YES_I_AM_SURE") {
    console.warn("\n==================================================================");
    console.warn("⚠️  [SAFETY BLOCK] Database cleanup halted: Permission required.");
    console.warn("To prevent accidental data loss, cleanup is blocked by default.");
    console.warn("Set CONFIRM_CLEAN_DATABASE=YES_I_AM_SURE to permit execution.");
    console.warn("==================================================================\n");
    return;
  }

  const db = createDatabase(process.env.DATABASE_URL!);
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@femmeflo.in").trim().toLowerCase();

    console.log("Cleaning database (CATEGORIES WILL BE PRESERVED)...");

    // 1. Purge all incentive tables
    await db.incentivePayoutAllocation.deleteMany({});
    await db.incentivePayout.deleteMany({});
    await db.incentiveAdjustment.deleteMany({});
    await db.incentiveRateHistory.deleteMany({});

    // 2. Purge orders, transactions & deliveries (CATEGORIES ARE PRESERVED)
    await db.delivery.deleteMany({});
    await db.notification.deleteMany({});
    await db.paymentRecord.deleteMany({});
    await db.invoice.deleteMany({});
    await db.stockMovement.deleteMany({});
    await db.sale.deleteMany({});
    await db.customer.deleteMany({});
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

    console.log("Cleanup completed successfully without touching categories.");
  } catch (err) {
    console.error("Cleanup failed:", err);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main();
