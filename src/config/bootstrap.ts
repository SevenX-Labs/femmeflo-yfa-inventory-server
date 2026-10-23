import "dotenv/config";
import bcrypt from "bcrypt";
import type { PrismaClient } from "../generated/prisma/client.js";

const DEFAULT_INITIAL_PASSWORD = "femmeflo@2026";

/**
 * Ensures a Super Admin account exists in the database.
 * - Password is NOT stored in .env. It lives exclusively in the database (bcrypt hash).
 * - First-time migration/bootstrap: auto-seeds the initial password "femmeflo@2026".
 * - Subsequent restarts/migrations: NEVER overwrites the password. Any password changed
 *   by the admin in Admin Settings is preserved directly from the DB.
 */
export async function bootstrapInitialAdmin(database: PrismaClient) {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@femmeflo.in").trim().toLowerCase();
  const adminName = process.env.ADMIN_NAME || "Super Admin";

  const existingAdmin = (await database.user.findFirst({
    where: { email: adminEmail },
  })) || (await database.user.findFirst({
    where: { role: "SUPER_ADMIN" },
  }));

  if (existingAdmin) {
    // Admin exists in DB: PRESERVE DB passwordHash completely!
    const updateData: { email?: string; active?: boolean } = {};
    if (existingAdmin.email !== adminEmail) {
      updateData.email = adminEmail;
    }
    if (!existingAdmin.active) {
      updateData.active = true;
    }
    if (Object.keys(updateData).length > 0) {
      await database.user.update({
        where: { id: existingAdmin.id },
        data: updateData,
      });
      console.info(`[Bootstrap] Verified Super Admin email (${adminEmail}). DB password preserved.`);
    }
    return existingAdmin;
  }

  // First time seed: set initial default password in DB only
  const passwordHash = await bcrypt.hash(DEFAULT_INITIAL_PASSWORD, 12);
  const admin = await database.user.create({
    data: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: "SUPER_ADMIN",
      active: true,
    },
  });
  console.info(`[Bootstrap] Initial Super Admin created for ${admin.email} with initial password.`);
  return admin;
}
