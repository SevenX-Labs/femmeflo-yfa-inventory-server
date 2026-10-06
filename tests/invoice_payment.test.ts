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
  throw new Error("TEST_DATABASE_URL and JWT_SECRET must be set to run invoice tests.");
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

test("Invoice Listing and Payment Collection Flow", async (t) => {
  const rand = Math.floor(Math.random() * 8999999 + 1000000);
  const timestamp = `${Date.now()}_${rand}`;

  // Admin login & create seller
  const adminRes = await auth.login(process.env["ADMIN_EMAIL"] ?? "admin@femmeflo.com", process.env["ADMIN_PASSWORD"] ?? "AdminPassword123!");
  const adminToken = adminRes.token;

  const createMgr = await request("/admin/managers", {
    method: "POST",
    token: adminToken,
    body: {
      name: `InvPay Test Manager ${timestamp}`,
      phone: `+9137${rand}`,
      email: `invpay_mgr_${timestamp}@test.com`,
      password: "TestPassword123!",
      permissions: ["SELLER_READ", "SELLER_CREATE"],
    },
  });
  assert.equal(createMgr.status, 201);

  const mgrLogin = await auth.login(`invpay_mgr_${timestamp}@test.com`, "TestPassword123!");
  const managerToken = mgrLogin.token;

  const createSeller = await request("/manager/sellers", {
    method: "POST",
    token: managerToken,
    body: {
      name: `InvPay Test Seller ${timestamp}`,
      phone: `+9136${rand}`,
      email: `invpay_seller_${timestamp}@test.com`,
      password: "TestPassword123!",
    },
  });
  assert.equal(createSeller.status, 201);

  const sellerLogin = await auth.login(`invpay_seller_${timestamp}@test.com`, "TestPassword123!");
  const sellerToken = sellerLogin.token;

  // Create Category & Customer
  const createCat = await request("/admin/categories", {
    method: "POST",
    token: adminToken,
    body: { name: `InvPay Category ${timestamp}` },
  });
  assert.equal(createCat.status, 201);
  const categoryId = (createCat.json.data["category"] as { id: string }).id;

  const createCust = await request("/seller/customers", {
    method: "POST",
    token: sellerToken,
    body: {
      shopName: `InvPay Shop ${timestamp}`,
      contactName: "Manoj Kumar",
      phone: `+9135${rand}`,
      categoryId,
      state: "Maharashtra",
      district: "Thane",
      village: "Diva",
    },
  });
  assert.equal(createCust.status, 201);
  const customerId = (createCust.json.data["customer"] as { id: string }).id;

  // Add stock to seller
  const hqReceipt = await request("/admin/inventory/receipts", {
    method: "POST",
    token: adminToken,
    body: { quantity: 100 },
  });
  const hqId = (hqReceipt.json.data["hq"] as { id: string }).id;

  const sellerInv = await request("/seller/inventory", { token: sellerToken });
  const sellerLocId = sellerInv.json.data["locationId"] as string;

  await request("/admin/inventory/transfers", {
    method: "POST",
    token: adminToken,
    body: { sourceId: hqId, destinationId: sellerLocId, quantity: 30 },
  });

  // Record Sale with PENDING payment
  const saleRes = await request("/seller/sales", {
    method: "POST",
    token: sellerToken,
    body: { customerId, quantity: 5, unitPricePaise: 2500, paymentMode: "PENDING" },
  });
  assert.equal(saleRes.status, 201);
  const saleId = (saleRes.json.data["sale"] as { id: string }).id;

  // Collect Pending Payment -> CASH
  const collectRes = await request(`/seller/sales/${saleId}/payment`, {
    method: "PATCH",
    token: sellerToken,
    body: { mode: "CASH" },
  });
  assert.equal(collectRes.status, 200);

  // Duplicate collection returns 409
  const dupCollect = await request(`/seller/sales/${saleId}/payment`, {
    method: "PATCH",
    token: sellerToken,
    body: { mode: "BANK" },
  });
  assert.equal(dupCollect.status, 409);

  // Admin lists invoices
  const listInv = await request("/admin/invoices", { token: adminToken });
  assert.equal(listInv.status, 200);
  assert.ok(Array.isArray(listInv.json.data["items"]));

  t.after(async () => {
    await database.$disconnect();
  });
});
