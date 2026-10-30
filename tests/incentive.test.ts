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
  throw new Error("TEST_DATABASE_URL and JWT_SECRET must be set to run incentive tests.");
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

test("Incentive Management and Settings Flow", async (t) => {
  const rand = Math.floor(Math.random() * 8999999 + 1000000);
  const timestamp = `${Date.now()}_${rand}`;

  await cleanupTestData(database);

  // 1. Admin login & set incentive rate to ₹15 per packet (1500 paise)
  const adminRes = await auth.login(process.env["ADMIN_EMAIL"] ?? "admin@femmeflo.in", process.env["ADMIN_PASSWORD"] ?? "AdminPassword123!");
  const adminToken = adminRes.token;

  const updateSettings = await request("/admin/incentives/settings", {
    method: "PATCH",
    token: adminToken,
    body: { incentiveRatePaise: 1500 },
  });
  assert.equal(updateSettings.status, 200);
  assert.equal((updateSettings.json.data["settings"] as { incentiveRatePaise: number }).incentiveRatePaise, 1500);

  // 2. Create Manager & Seller
  const createMgr = await request("/admin/managers", {
    method: "POST",
    token: adminToken,
    body: {
      name: `Inc Test Manager ${timestamp}`,
      phone: `+9157${rand}`,
      email: `inc_mgr_${timestamp}@test.com`,
      password: "TestPassword123!",
      permissions: ["SELLER_READ", "SELLER_CREATE"],
    },
  });
  assert.equal(createMgr.status, 201);

  const mgrLogin = await auth.login(`inc_mgr_${timestamp}@test.com`, "TestPassword123!");
  const managerToken = mgrLogin.token;

  const createSeller = await request("/manager/sellers", {
    method: "POST",
    token: managerToken,
    body: {
      name: `Inc Test Seller ${timestamp}`,
      phone: `+9156${rand}`,
      email: `inc_seller_${timestamp}@test.com`,
      password: "TestPassword123!",
    },
  });
  assert.equal(createSeller.status, 201);
  const sellerId = (createSeller.json.data["user"] as { id: string }).id;

  const sellerLogin = await auth.login(`inc_seller_${timestamp}@test.com`, "TestPassword123!");
  const sellerToken = sellerLogin.token;

  // Create Category & Customer
  const createCat = await request("/admin/categories", {
    method: "POST",
    token: adminToken,
    body: { name: `Inc Category ${timestamp}` },
  });
  assert.equal(createCat.status, 201);
  const categoryId = (createCat.json.data["category"] as { id: string }).id;

  const createCust = await request("/seller/customers", {
    method: "POST",
    token: sellerToken,
    body: {
      shopName: `Inc Shop ${timestamp}`,
      contactName: "Anil Kumar",
      phone: `+9155${rand}`,
      categoryId,
      state: "Maharashtra",
      district: "Thane",
      village: "Diva",
      noPhotoReason: "Test customer without photo",
    },
  });
  assert.equal(createCust.status, 201);
  const customerId = (createCust.json.data["customer"] as { id: string }).id;

  // Add stock to seller
  const hqReceipt = await request("/admin/inventory/receipts", {
    method: "POST",
    token: adminToken,
    body: { quantity: 200 },
  });
  const hqId = (hqReceipt.json.data["hq"] as { id: string }).id;

  const sellerInv = await request("/seller/inventory", { token: sellerToken });
  const sellerLocId = sellerInv.json.data["locationId"] as string;

  await request("/admin/inventory/transfers", {
    method: "POST",
    token: adminToken,
    body: { sourceId: hqId, destinationId: sellerLocId, quantity: 50 },
  });

  // 3. Seller records confirmed sale of 20 packets @ ₹25
  const saleRes = await request("/seller/sales", {
    method: "POST",
    token: sellerToken,
    body: { customerId, quantity: 20, unitPricePaise: 2500, paymentMode: "CASH" },
  });
  assert.equal(saleRes.status, 201);

  // 4. Seller checks incentives: 20 packets * ₹15 = ₹300 (30000 paise)
  const sellerInc = await request("/seller/incentives", { token: sellerToken });
  assert.equal(sellerInc.status, 200);
  const summary = sellerInc.json.data["summary"] as { totalPacketsSold: number; totalIncentivePaise: number; totalIncentiveRupees: number };
  assert.equal(summary.totalPacketsSold, 20);
  assert.equal(summary.totalIncentivePaise, 30000);
  assert.equal(summary.totalIncentiveRupees, 300);

  // 5. Admin checks incentive report
  const adminInc = await request("/admin/incentives", { token: adminToken });
  assert.equal(adminInc.status, 200);

  t.after(async () => {
    await cleanupTestData(database);
    await database.$disconnect();
  });
});
