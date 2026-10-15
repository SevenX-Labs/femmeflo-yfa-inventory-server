import "dotenv/config";
import { createDatabase } from "../src/config/database.js";

async function main() {
  const db = createDatabase(process.env.DATABASE_URL!);
  try {
    console.log("Cleaning database to remove all dummy test data...");
    
    await db.delivery.deleteMany({});
    await db.notification.deleteMany({});
    await db.paymentRecord.deleteMany({});
    await db.invoice.deleteMany({});
    await db.stockMovement.deleteMany({});
    await db.sale.deleteMany({});
    await db.customer.deleteMany({});
    await db.stockLocation.deleteMany({});
    await db.passwordReset.deleteMany({});
    
    // Remove all users except the SUPER_ADMIN
    const deleted = await db.user.deleteMany({
      where: {
        role: { not: "SUPER_ADMIN" },
      },
    });
    console.log("Deleted dummy non-admin users:", deleted.count);

    // Ensure remaining Super Admin has correct email
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@femmeflo.in").trim().toLowerCase();
    const admin = await db.user.findFirst({
      where: { role: "SUPER_ADMIN" },
    });

    if (admin) {
      if (admin.email !== adminEmail) {
        await db.user.update({
          where: { id: admin.id },
          data: { email: adminEmail },
        });
      }
      console.log("Super Admin active in DB:", adminEmail, "ID:", admin.id);
    } else {
      console.log("No Super Admin found. Run npm run admin:reset to create one.");
    }

    const allUsers = await db.user.findMany({ select: { id: true, email: true, role: true } });
    console.log("Current Users in DB:", allUsers);
    const bcrypt = (await import("bcrypt")).default;
    const adminUser = await db.user.findFirst({ where: { role: "SUPER_ADMIN" } });
    if (adminUser) {
      const match = await bcrypt.compare(process.env.ADMIN_PASSWORD || "", adminUser.passwordHash);
      console.log("Verified ADMIN_PASSWORD match against DB hash:", match);
    }
  } catch (err) {
    console.error("Cleanup failed:", err);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main();
