import "dotenv/config";
import bcrypt from "bcrypt";
import { createDatabase } from "../src/config/database.js";

const DEFAULT_INITIAL_PASSWORD = "femmeflo@2026";

async function main() {
  const email = (process.argv[2] || process.env.ADMIN_EMAIL || "admin@femmeflo.in").trim().toLowerCase();
  const password = process.argv[3] || DEFAULT_INITIAL_PASSWORD;
  const name = process.env.ADMIN_NAME || "Super Admin";

  const db = createDatabase(process.env.DATABASE_URL!);
  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const existingAdmin = await db.user.findFirst({
      where: { email },
    }) || await db.user.findFirst({
      where: { role: "SUPER_ADMIN" },
    });

    let admin;
    if (existingAdmin) {
      admin = await db.user.update({
        where: { id: existingAdmin.id },
        data: {
          name,
          email,
          passwordHash,
          role: "SUPER_ADMIN",
          active: true,
          tokenVersion: { increment: 1 },
        },
      });
    } else {
      admin = await db.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: "SUPER_ADMIN",
          active: true,
        },
      });
    }

    console.log("==========================================");
    console.log("Super Admin Account Ready in DB:");
    console.log(`Email:    ${admin.email}`);
    console.log(`Password: ${password}`);
    console.log(`Role:     ${admin.role}`);
    console.log(`Active:   ${admin.active}`);
    console.log("==========================================");
  } catch (err) {
    console.error("Failed to set admin credentials in DB:", err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
