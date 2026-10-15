import { test } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { createDatabase } from "../src/config/database.js";
import { createAuthService } from "../src/services/auth/auth.service.js";
import { bootstrapInitialAdmin } from "../src/config/bootstrap.js";

test("Admin login, password change in settings, and bootstrap persistence workflow", async () => {
  const database = createDatabase(process.env.DATABASE_URL!);
  const auth = createAuthService(database, {
    secret: process.env.JWT_SECRET || "super_secret_jwt_signing_key_min_32_characters_here",
    expiresIn: "1h",
  });

  const adminEmail = (process.env.ADMIN_EMAIL || "admin@femmeflo.in").trim().toLowerCase();
  const initialPassword = process.env.ADMIN_PASSWORD || "femmeflo@2026";
  const changedPassword = "NewSecretPassword2026!";

  try {
    // 1. Initial bootstrap should ensure admin is ready
    const admin = await bootstrapInitialAdmin(database);
    assert.equal(admin.email, adminEmail);

    // 2. Admin logs in with initial password from .env
    const loginResult = await auth.login(adminEmail, initialPassword);
    assert.ok(loginResult.token, "Admin should receive login token");
    assert.equal(loginResult.user.role, "SUPER_ADMIN");

    // 3. Admin changes password via changePassword (same logic called by PATCH /api/v1/admin/auth/password)
    await auth.changePassword(loginResult.user.id, initialPassword, changedPassword);

    // 4. Old password should now fail
    await assert.rejects(
      async () => {
        await auth.login(adminEmail, initialPassword);
      },
      /Invalid credentials/,
      "Old password should be rejected"
    );

    // 5. New password should successfully log in
    const newLoginResult = await auth.login(adminEmail, changedPassword);
    assert.ok(newLoginResult.token, "Admin should log in with new password");

    // 6. Server restarts or re-bootstrap occurs: verify bootstrap DOES NOT overwrite changed password
    await bootstrapInitialAdmin(database);

    // 7. Admin can STILL log in with the changed password!
    const postBootstrapLogin = await auth.login(adminEmail, changedPassword);
    assert.ok(postBootstrapLogin.token, "Admin should still log in with changed password after bootstrap");

    // 8. Revert back to initialPassword for environment consistency
    await auth.changePassword(postBootstrapLogin.user.id, changedPassword, initialPassword);
    const revertedLogin = await auth.login(adminEmail, initialPassword);
    assert.ok(revertedLogin.token, "Admin successfully restored to initial password");
  } finally {
    await database.$disconnect();
  }
});
