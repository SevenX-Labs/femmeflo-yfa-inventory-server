import type { PrismaClient } from "../src/generated/prisma/client.js";

export async function cleanupTestData(database: PrismaClient) {
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
