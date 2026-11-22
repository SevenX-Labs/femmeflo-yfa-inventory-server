import type { PrismaClient } from "../src/generated/prisma/client.js";

export async function cleanupTestData(database: PrismaClient) {
  // HARD SAFETY GUARD: Never delete data from Supabase, production, or remote databases!
  const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL || "";
  if (
    dbUrl.includes("supabase.co") ||
    dbUrl.includes("supabase.com") ||
    dbUrl.includes("pooler.supabase") ||
    process.env.ALLOW_TEST_DB_PURGE !== "true"
  ) {
    console.warn("[SAFETY GUARD] Skipping database cleanup: target database is a live remote database. No data deleted.");
    return;
  }

  try {
    const mainAdminEmail = (process.env.ADMIN_EMAIL || "admin@femmeflo.in").trim().toLowerCase();
    await database.delivery.deleteMany({});
    await database.notification.deleteMany({});
    await database.paymentRecord.deleteMany({});
    await database.invoice.deleteMany({});
    await database.stockMovement.deleteMany({});
    await database.sale.deleteMany({});
    await database.customer.deleteMany({});
    await database.stockLocation.deleteMany({ where: { type: { not: "HQ" } } });
    await database.passwordReset.deleteMany({});
    // Remove all users except the main admin
    await database.user.deleteMany({
      where: {
        email: { not: mainAdminEmail },
      },
    });
  } catch {
    // ignore
  }
}
