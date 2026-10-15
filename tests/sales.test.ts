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
  throw new Error("TEST_DATABASE_URL and JWT_SECRET must be set to run sales tests.");
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

test("Sales Recording and Low-Price Approval Workflow", async (t) => {
  const rand = Math.floor(Math.random() * 8999999 + 1000000);
  const timestamp = `${Date.now()}_${rand}`;

  // 1. Admin login & bootstrap environment
  const adminRes = await auth.login(process.env["ADMIN_EMAIL"] ?? "admin@femmeflo.in", process.env["ADMIN_PASSWORD"] ?? "AdminPassword123!");
  const adminToken = adminRes.token;

  // Create Manager & Seller
  const createMgr = await request("/admin/managers", {
    method: "POST",
    token: adminToken,
    body: {
      name: `Sales Test Manager ${timestamp}`,
      phone: `+9167${rand}`,
      email: `sales_mgr_${timestamp}@test.com`,
      password: "TestPassword123!",
      permissions: ["SELLER_READ", "SELLER_CREATE"],
    },
  });
  assert.equal(createMgr.status, 201);

  const mgrLogin = await auth.login(`sales_mgr_${timestamp}@test.com`, "TestPassword123!");
  const managerToken = mgrLogin.token;

  const createSeller = await request("/manager/sellers", {
    method: "POST",
    token: managerToken,
    body: {
      name: `Sales Test Seller ${timestamp}`,
      phone: `+9166${rand}`,
      email: `sales_seller_${timestamp}@test.com`,
      password: "TestPassword123!",
    },
  });
  assert.equal(createSeller.status, 201);

  const sellerLogin = await auth.login(`sales_seller_${timestamp}@test.com`, "TestPassword123!");
  const sellerToken = sellerLogin.token;

  // Create Category & Customer
  const createCat = await request("/admin/categories", {
    method: "POST",
    token: adminToken,
    body: { name: `Sales Category ${timestamp}` },
  });
  assert.equal(createCat.status, 201);
  const categoryId = (createCat.json.data["category"] as { id: string }).id;

  const createCust = await request("/seller/customers", {
    method: "POST",
    token: sellerToken,
    body: {
      shopName: `Sales Shop ${timestamp}`,
      contactName: "Sunil Sharma",
      phone: `+9165${rand}`,
      categoryId,
      state: "Maharashtra",
      district: "Thane",
      village: "Diva",
    },
  });
  assert.equal(createCust.status, 201);
  const customerId = (createCust.json.data["customer"] as { id: string }).id;

  // Transfer stock to Seller: HQ Receipt 500, HQ -> Seller 100
  const hqReceipt = await request("/admin/inventory/receipts", {
    method: "POST",
    token: adminToken,
    body: { quantity: 500 },
  });
  const hqId = (hqReceipt.json.data["hq"] as { id: string }).id;

  const sellerInv = await request("/seller/inventory", { token: sellerToken });
  const sellerLocId = sellerInv.json.data["locationId"] as string;

  await request("/admin/inventory/transfers", {
    method: "POST",
    token: adminToken,
    body: { sourceId: hqId, destinationId: sellerLocId, quantity: 100 },
  });

  // 2. Normal Sale at ₹25 (2500 paise) for 10 packets -> Confirms immediately, deducts stock to 90
  const normalSale = await request("/seller/sales", {
    method: "POST",
    token: sellerToken,
    body: {
      customerId,
      quantity: 10,
      unitPricePaise: 2500,
      paymentMode: "CASH",
    },
  });
  assert.equal(normalSale.status, 201);
  const normalSaleData = normalSale.json.data["sale"] as { status: string; invoice: unknown };
  assert.equal(normalSaleData.status, "CONFIRMED");
  assert.ok(normalSaleData.invoice);

  // Verify Seller remaining stock is 90
  const checkInv1 = await request("/seller/inventory", { token: sellerToken });
  assert.equal(checkInv1.json.data["remaining"], 90);

  // 3. Low-Price Sale at ₹20 (2000 paise) for 20 packets -> enters PENDING_APPROVAL, stock stays 90
  const lowPriceSale = await request("/seller/sales", {
    method: "POST",
    token: sellerToken,
    body: {
      customerId,
      quantity: 20,
      unitPricePaise: 2000,
      paymentMode: "BANK",
    },
  });
  assert.equal(lowPriceSale.status, 201);
  const pendingSaleId = (lowPriceSale.json.data["sale"] as { id: string; status: string }).id;
  assert.equal((lowPriceSale.json.data["sale"] as { status: string }).status, "PENDING_APPROVAL");

  // Stock stays 90
  const checkInv2 = await request("/seller/inventory", { token: sellerToken });
  assert.equal(checkInv2.json.data["remaining"], 90);

  // 4. Admin approves low-price sale -> status CONFIRMED, stock deducted to 70
  const approveRes = await request(`/admin/approvals/${pendingSaleId}/approve`, {
    method: "POST",
    token: adminToken,
  });
  assert.equal(approveRes.status, 200);

  const checkInv3 = await request("/seller/inventory", { token: sellerToken });
  assert.equal(checkInv3.json.data["remaining"], 70);

  // 5. Low-Price Sale rejected flow
  const lowPriceSale2 = await request("/seller/sales", {
    method: "POST",
    token: sellerToken,
    body: {
      customerId,
      quantity: 15,
      unitPricePaise: 1800,
      paymentMode: "PENDING",
    },
  });
  const rejectSaleId = (lowPriceSale2.json.data["sale"] as { id: string }).id;

  const rejectRes = await request(`/admin/approvals/${rejectSaleId}/reject`, {
    method: "POST",
    token: adminToken,
    body: { reason: "Price too low" },
  });
  assert.equal(rejectRes.status, 200);

  // Stock remains 70
  const checkInv4 = await request("/seller/inventory", { token: sellerToken });
  assert.equal(checkInv4.json.data["remaining"], 70);

  t.after(async () => {
    await cleanupTestData(database);
    await database.$disconnect();
  });
});
