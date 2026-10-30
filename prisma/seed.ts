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
    console.log("Purging all data across all schemas/tables...");

    await database.$transaction(async (tx) => {
      // 1. Shift Tracking
      await tx.shiftVisit.deleteMany({});
      await tx.shift.deleteMany({});

      // 2. Incentive System
      await tx.incentivePayoutAllocation.deleteMany({});
      await tx.incentivePayout.deleteMany({});
      await tx.incentiveAdjustment.deleteMany({});
      await tx.incentiveRateHistory.deleteMany({});

      // 3. Deliveries, Invoices & Notifications
      await tx.delivery.deleteMany({});
      await tx.notification.deleteMany({});
      await tx.paymentRecord.deleteMany({});
      await tx.invoice.deleteMany({});

      // 4. Sales & Inventory
      await tx.saleLineItem.deleteMany({});
      await tx.sale.deleteMany({});
      await tx.stockMovement.deleteMany({});
      await tx.productBalance.deleteMany({});
      await tx.stockLocation.deleteMany({});

      // 5. Products & Customers
      await tx.customer.deleteMany({});
      await tx.category.deleteMany({});
      await tx.product.deleteMany({});

      // 6. Auth, Users & Settings
      await tx.passwordReset.deleteMany({});
      await tx.user.deleteMany({});
      await tx.businessSettings.deleteMany({});
    });

    console.log("All tables successfully cleared.");

    // Auto-seed Admin ONLY
    const adminName = process.env.ADMIN_NAME || "Super Admin";
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@femmeflo.in").trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || DEFAULT_INITIAL_PASSWORD;

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const admin = await database.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: "SUPER_ADMIN",
        active: true,
      },
    });

    console.log("==========================================");
    console.log("Database reset complete. Super Admin seeded:");
    console.log(`Email:    ${admin.email}`);
    console.log(`Password: ${adminPassword}`);
    console.log(`Role:     ${admin.role}`);
    console.log("==========================================");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  } finally {
    await database.$disconnect();
  }
}

main();
