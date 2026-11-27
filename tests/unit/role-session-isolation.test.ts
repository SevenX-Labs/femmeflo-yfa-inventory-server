import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import type { AuthUser } from "../../src/services/auth/auth.types.js";
import { createAuthService } from "../../src/services/auth/auth.service.js";
import { requireRole } from "../../src/middleware/rbac.middleware.js";

test("dual-role Manager sessions remain isolated between SELLER and MANAGER portals via JWT", async () => {
  const secret = randomBytes(48).toString("base64url");
  const password = "Manager@Password123";
  const passwordHash = await bcrypt.hash(password, 4);
  const dualUser: AuthUser = {
    id: "ab987cbb-6eb7-45d8-8f04-8c13e0ac2bb9",
    name: "Dual Role Manager",
    email: "dual@femmeflo.in",
    phone: "+919876543211",
    passwordHash,
    role: "MANAGER",
    isSeller: true,
    active: true,
    tokenVersion: 1,
    managerId: null,
    permissions: ["manage_sellers", "view_customers"],
    state: "Maharashtra",
    district: "Thane",
    village: null,
    alternatePhone: null,
    designation: null,
    employeeCode: null,
    address: null,
    pincode: null,
    aadharNumber: null,
    drivingLicense: null,
    education: null,
  };

  const database = {
    user: {
      async findFirst() {
        return { ...dualUser };
      },
      async findUnique({ where }: { where: { id: string } }) {
        return where.id === dualUser.id ? { ...dualUser } : null;
      },
    },
  } as unknown as PrismaClient;

  const auth = createAuthService(database, { secret, expiresIn: "1h" });

  // 1. Login via Seller portal -> token + /auth/me resolves sessionRole = SELLER
  const sellerSession = await auth.login(dualUser.email!, password, "SELLER");
  assert.equal(sellerSession.user.role, "MANAGER");
  assert.equal(sellerSession.user.sessionRole, "SELLER");
  const authenticatedSeller = await auth.authenticate(sellerSession.token);
  assert.equal(authenticatedSeller?.sessionRole, "SELLER");

  // 2. Login via Manager portal -> stays MANAGER
  const managerSession = await auth.login(dualUser.email!, password, "MANAGER");
  assert.equal(managerSession.user.role, "MANAGER");
  assert.equal(managerSession.user.sessionRole, undefined);
  const authenticatedManager = await auth.authenticate(managerSession.token);
  assert.equal(authenticatedManager?.role, "MANAGER");
  assert.equal(authenticatedManager?.sessionRole, undefined);

  // 3. Switching back to authenticate seller token never picks up cached manager state
  const recheckedSeller = await auth.authenticate(sellerSession.token);
  assert.equal(recheckedSeller?.sessionRole, "SELLER");

  // 4. requireRole("MANAGER") blocks SELLER-portal token, allows MANAGER-portal token
  const guard = requireRole("MANAGER");
  let blockedStatus = 200;
  guard(
    {} as any,
    {
      locals: { authUser: authenticatedSeller },
      status(code: number) {
        blockedStatus = code;
        return this;
      },
      json() {
        return this;
      },
    } as any,
    () => {
      blockedStatus = 200;
    }
  );
  assert.equal(blockedStatus, 403);

  let managerNextCalled = false;
  guard(
    {} as any,
    {
      locals: { authUser: authenticatedManager },
      status() {
        return this;
      },
      json() {
        return this;
      },
    } as any,
    () => {
      managerNextCalled = true;
    }
  );
  assert.equal(managerNextCalled, true);
});
