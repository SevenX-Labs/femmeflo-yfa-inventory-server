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
  throw new Error("TEST_DATABASE_URL and JWT_SECRET must be set to run inventory tests.");
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

test("Inventory Management Endpoints Flow", async (t) => {
  const rand = Math.floor(Math.random() * 8999999 + 1000000);
  const timestamp = `${Date.now()}_${rand}`;

  // 1. Admin login
  const adminRes = await auth.login(process.env["ADMIN_EMAIL"] ?? "admin@femmeflo.com", process.env["ADMIN_PASSWORD"] ?? "AdminPassword123!");
  const adminToken = adminRes.token;

  // Create Manager & Seller
  const createMgr = await request("/admin/managers", {
    method: "POST",
    token: adminToken,
    body: {
      name: `Inv Test Manager ${timestamp}`,
      phone: `+9177${rand}`,
      email: `inv_mgr_${timestamp}@test.com`,
      password: "TestPassword123!",
      permissions: ["SELLER_READ", "SELLER_CREATE"],
    },
  });
  assert.equal(createMgr.status, 201);

  const mgrLogin = await auth.login(`inv_mgr_${timestamp}@test.com`, "TestPassword123!");
  const managerToken = mgrLogin.token;

  const createSeller = await request("/manager/sellers", {
    method: "POST",
    token: managerToken,
    body: {
      name: `Inv Test Seller ${timestamp}`,
      phone: `+9176${rand}`,
      email: `inv_seller_${timestamp}@test.com`,
      password: "TestPassword123!",
    },
  });
  assert.equal(createSeller.status, 201);
  const sellerId = (createSeller.json.data["user"] as { id: string }).id;

  const sellerLogin = await auth.login(`inv_seller_${timestamp}@test.com`, "TestPassword123!");
  const sellerToken = sellerLogin.token;

  // 2. Admin creates Warehouse
  const createWh = await request("/admin/inventory/warehouses", {
    method: "POST",
    token: adminToken,
    body: { name: `Central Warehouse ${timestamp}` },
  });
  assert.equal(createWh.status, 201);
  const warehouseId = (createWh.json.data["warehouse"] as { id: string }).id;

  // 3. Admin receives 400 packets at HQ
  const receiptRes = await request("/admin/inventory/receipts", {
    method: "POST",
    token: adminToken,
    body: { quantity: 400 },
  });
  assert.equal(receiptRes.status, 201);
  const hqId = (receiptRes.json.data["hq"] as { id: string }).id;

  // 4. Transfer 150 packets HQ -> Warehouse
  const transfer1 = await request("/admin/inventory/transfers", {
    method: "POST",
    token: adminToken,
    body: { sourceId: hqId, destinationId: warehouseId, quantity: 150 },
  });
  assert.equal(transfer1.status, 200);

  // Get Seller's stock location
  const sellerInv = await request("/seller/inventory", { token: sellerToken });
  assert.equal(sellerInv.status, 200);
  const sellerLocId = sellerInv.json.data["locationId"] as string;

  // 5. Transfer 40 packets Warehouse -> Seller
  const transfer2 = await request("/admin/inventory/transfers", {
    method: "POST",
    token: adminToken,
    body: { sourceId: warehouseId, destinationId: sellerLocId, quantity: 40 },
  });
  assert.equal(transfer2.status, 200);

  // 6. Excessive transfer returns 409 Conflict
  const overflowTransfer = await request("/admin/inventory/transfers", {
    method: "POST",
    token: adminToken,
    body: { sourceId: sellerLocId, destinationId: warehouseId, quantity: 500 },
  });
  assert.equal(overflowTransfer.status, 409);

  // 7. Verify Seller inventory balance is 40
  const sellerInv2 = await request("/seller/inventory", { token: sellerToken });
  assert.equal(sellerInv2.status, 200);
  assert.equal(sellerInv2.json.data["remaining"], 40);

  // 8. Admin transactions list
  const txList = await request("/admin/inventory/transactions", { token: adminToken });
  assert.equal(txList.status, 200);
  assert.ok(Array.isArray(txList.json.data["items"]));

  t.after(async () => {
    await database.$disconnect();
  });
});
