import { cleanupTestData } from "./test_cleanup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { createDatabase } from "../src/config/database.js";
import { loadAuthEnvironment, loadEnvironment } from "../src/config/env.js";
import { createAuthRoutes } from "../src/routes/auth/auth.routes.js";
import { createAuthService } from "../src/services/auth/auth.service.js";
import { createUserRoutes } from "../src/routes/user.routes.js";

const env = loadEnvironment();
const authEnv = loadAuthEnvironment();

if (!authEnv) {
  throw new Error("TEST_DATABASE_URL and JWT_SECRET must be set to run dashboard tests.");
}

const database = createDatabase(authEnv.DATABASE_URL);
const auth = createAuthService(database, { secret: authEnv.JWT_SECRET, expiresIn: authEnv.JWT_EXPIRES_IN });
const app = createApp({ corsOrigins: env.CORS_ORIGINS, authRoutes: createAuthRoutes(auth), userRoutes: createUserRoutes(database, auth) });

async function request(path: string, options: { method?: string; body?: unknown; token?: string } = {}) {
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  try {
    const headers: Record<string, string> = {};
    if (options.token) headers["Authorization"] = `Bearer ${options.token}`;
    if (options.body) headers["Content-Type"] = "application/json";

    const reqInit: RequestInit = {
      method: options.method ?? "GET",
      headers,
    };
    if (options.body) {
      reqInit.body = JSON.stringify(options.body);
    }

    const response = await fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
      ...reqInit,
    });
    const json = (await response.json()) as { success: boolean; message: string; data: Record<string, unknown> };
    return { status: response.status, json };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("Dashboard Metrics and Geographic Filtering Flow", async (t) => {
  const rand = Math.floor(Math.random() * 8999999 + 1000000);
  const timestamp = `${Date.now()}_${rand}`;

  // Admin login
  const adminRes = await auth.login(process.env["ADMIN_EMAIL"] ?? "admin@femmeflo.in", process.env["ADMIN_PASSWORD"] ?? "AdminPassword123!");
  const adminToken = adminRes.token;

  // Create Manager
  const createMgr = await request("/admin/managers", {
    method: "POST",
    token: adminToken,
    body: {
      name: `Dash Test Manager ${timestamp}`,
      phone: `+9147${rand}`,
      email: `dash_mgr_${timestamp}@test.com`,
      password: "TestPassword123!",
      state: "Maharashtra",
      district: "Thane",
      permissions: ["SELLER_READ", "SELLER_CREATE"],
    },
  });
  assert.equal(createMgr.status, 201);

  const mgrLogin = await auth.login(`dash_mgr_${timestamp}@test.com`, "TestPassword123!");
  const managerToken = mgrLogin.token;

  // Create Seller
  const createSeller = await request("/manager/sellers", {
    method: "POST",
    token: managerToken,
    body: {
      name: `Dash Test Seller ${timestamp}`,
      phone: `+9146${rand}`,
      email: `dash_seller_${timestamp}@test.com`,
      password: "TestPassword123!",
      state: "Maharashtra",
      district: "Thane",
      village: "Diva",
    },
  });
  assert.equal(createSeller.status, 201);

  const sellerLogin = await auth.login(`dash_seller_${timestamp}@test.com`, "TestPassword123!");
  const sellerToken = sellerLogin.token;

  // Seller Dashboard check
  const sellerDash = await request("/seller/dashboard", { token: sellerToken });
  assert.equal(sellerDash.status, 200);
  assert.ok("assignedPackets" in (sellerDash.json.data["metrics"] as object));

  // Manager Dashboard check
  const mgrDash = await request("/manager/dashboard", { token: managerToken });
  assert.equal(mgrDash.status, 200);
  assert.ok("totalSellers" in (mgrDash.json.data["metrics"] as object));

  // Admin Dashboard check
  const adminDash = await request("/admin/dashboard", { token: adminToken });
  assert.equal(adminDash.status, 200);
  assert.ok("totalPacketsSold" in (adminDash.json.data["metrics"] as object));

  t.after(async () => {
    await cleanupTestData(database);
    await database.$disconnect();
  });
});
