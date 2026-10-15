import "dotenv/config";
import bcrypt from "bcrypt";
import { createDatabase } from "../src/config/database.js";

const DEFAULT_INITIAL_PASSWORD = "femmeflo@2026";

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
    await db.category.deleteMany({});
    await db.stockLocation.deleteMany({ where: { type: { not: "HQ" } } });
    await db.stockLocation.updateMany({ where: { type: "HQ" }, data: { balance: 0 } });
    await db.passwordReset.deleteMany({});
    
    // Remove all users except the SUPER_ADMIN
    const deleted = await db.user.deleteMany({
      where: {
        role: { not: "SUPER_ADMIN" },
      },
    });
    console.log("Deleted dummy non-admin users:", deleted.count);

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
      const passwordHash = await bcrypt.hash(DEFAULT_INITIAL_PASSWORD, 12);
      const newAdmin = await db.user.create({
        data: {
          name: "Super Admin",
          email: adminEmail,
          passwordHash,
          role: "SUPER_ADMIN",
          active: true,
        },
      });
      console.log("Super Admin created in DB with initial password:", newAdmin.email);
    }

    const allUsers = await db.user.findMany({ select: { id: true, email: true, role: true } });
    console.log("Current Users in DB:", allUsers);
  } catch (err) {
    console.error("Cleanup failed:", err);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main();
