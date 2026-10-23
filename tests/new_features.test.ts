import { cleanupTestData } from "./test_cleanup.js";
import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { createApp } from "../src/app.js";
import { createDatabase } from "../src/config/database.js";
import { loadAuthEnvironment, loadEnvironment } from "../src/config/env.js";
import { createAuthRoutes } from "../src/routes/auth/auth.routes.js";
import { createAuthService } from "../src/services/auth/auth.service.js";
import { createUserRoutes } from "../src/routes/user.routes.js";
import { processInvoicePdf } from "../src/services/pdf.service.js";

const env = loadEnvironment();
const authEnv = loadAuthEnvironment();

if (!authEnv) {
  throw new Error("TEST_DATABASE_URL and JWT_SECRET must be set to run integration tests.");
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

    const response = await fetch(`http://127.0.0.1:${port}/api/v1${path}`, reqInit);
    const contentType = response.headers.get("content-type") || "";
    let data = null;
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    return { status: response.status, headers: response.headers, data };
  } finally {
    server.close();
  }
}

test("New Features End-to-End Integration Suite", async (t) => {
  const timestamp = Date.now();
  const adminEmail = `admin_feat_${timestamp}@example.com`;
  const managerEmail = `manager_feat_${timestamp}@example.com`;
  const sellerEmail = `seller_feat_${timestamp}@example.com`;
  const sellerPhone = `+9198${String(timestamp).slice(-8)}`;
  const managerPhone = `+9197${String(timestamp).slice(-8)}`;
  const password = "Password123!";

  let adminToken = "";
  let sellerToken = "";
  let adminUserId = "";
  let managerId = "";
  let sellerId = "";

  await cleanupTestData(database);

  await t.test("Swagger OpenAPI documentation endpoint works", async () => {
    const res = await request("/docs.json");
    assert.equal(res.status, 200);
    assert.equal(typeof res.data, "object");
    assert.equal((res.data as Record<string, unknown>).openapi, "3.0.0");
  });

  await t.test("Seed/Create Admin user and login", async () => {
    const passwordHash = await bcrypt.hash(password, 12);
    const adminUser = await database.user.create({
      data: {
        name: "Feature Admin",
        email: adminEmail,
        passwordHash,
        role: "SUPER_ADMIN",
      },
    });
    assert.ok(adminUser.id);
    adminUserId = adminUser.id;

    const loginRes = await request("/auth/login", {
      method: "POST",
      body: { login: adminEmail, password },
    });
    assert.equal(loginRes.status, 200);
    adminToken = (loginRes.data as { data: { token: string } }).data.token;
    assert.ok(adminToken);
  });


  await t.test("Admin Permissions Endpoints", async () => {
    const listRes = await request("/admin/permissions", { token: adminToken });
    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray((listRes.data as { data: { permissions: string[] } }).data.permissions));

    // Onboard a Manager
    const mgrRes = await request("/admin/managers", {
      method: "POST",
      token: adminToken,
      body: {
        name: "Test Manager",
        email: managerEmail,
        phone: managerPhone,

        password,
      },
    });
    assert.equal(mgrRes.status, 201);
    managerId = (mgrRes.data as { data: { user: { id: string } } }).data.user.id;

    // Update Manager Permissions
    const updatePermRes = await request(`/admin/permissions/managers/${managerId}/permissions`, {
      method: "PATCH",
      token: adminToken,
      body: { permissions: ["manage_sellers", "view_reports"] },
    });
    assert.equal(updatePermRes.status, 200);
    const updatedPerms = (updatePermRes.data as { data: { manager: { permissions: string[] } } }).data.manager.permissions;
    assert.deepEqual(updatedPerms, ["manage_sellers", "view_reports"]);
  });

  await t.test("Seller Profile Endpoints", async () => {
    // Onboard a Seller
    const sellerRes = await request("/admin/sellers", {
      method: "POST",
      token: adminToken,
      body: {
        name: "Test Seller Profile",
        email: sellerEmail,
        phone: sellerPhone,
        password,
        managerId,
      },
    });
    assert.equal(sellerRes.status, 201);
    sellerId = (sellerRes.data as { data: { user: { id: string } } }).data.user.id;


    // Login as Seller
    const sellerLoginRes = await request("/auth/login", {
      method: "POST",
      body: { login: sellerEmail, password },
    });
    assert.equal(sellerLoginRes.status, 200);
    sellerToken = (sellerLoginRes.data as { data: { token: string } }).data.token;

    // GET Seller Profile
    const getProfileRes = await request("/seller/profile", { token: sellerToken });
    assert.equal(getProfileRes.status, 200);
    const profile = (getProfileRes.data as { data: { profile: { id: string; name: string } } }).data.profile;
    assert.equal(profile.id, sellerId);

    // PATCH Seller Profile
    const patchProfileRes = await request("/seller/profile", {
      method: "PATCH",
      token: sellerToken,
      body: { name: "Updated Seller Name" },
    });
    assert.equal(patchProfileRes.status, 200);
    const updatedName = (patchProfileRes.data as { data: { profile: { name: string } } }).data.profile.name;
    assert.equal(updatedName, "Updated Seller Name");
  });

  await t.test("Forgot & Reset Password Flow", async () => {
    // Forgot Password Request
    const forgotRes = await request("/auth/forgot-password", {
      method: "POST",
      body: { login: sellerEmail },
    });
    assert.equal(forgotRes.status, 200);
    const debugToken = (forgotRes.data as { debugToken?: string }).debugToken;
    assert.ok(debugToken);

    // Reset Password with token
    const newPassword = "NewPassword123!";
    const resetRes = await request("/auth/reset-password", {
      method: "POST",
      body: { token: debugToken, newPassword },
    });
    assert.equal(resetRes.status, 200);

    // Verify old login token is revoked / new password login works
    const newLoginRes = await request("/auth/login", {
      method: "POST",
      body: { login: sellerEmail, password: newPassword },
    });
    assert.equal(newLoginRes.status, 200);

    // Re-using same token fails
    const reUseRes = await request("/auth/reset-password", {
      method: "POST",
      body: { token: debugToken, newPassword: "AnotherPassword123!" },
    });
    assert.equal(reUseRes.status, 400);
  });

  await t.test("Admin Reports (JSON, CSV, XLSX Exports)", async () => {
    // Sales Report JSON
    const salesJsonRes = await request("/admin/reports/sales?format=json", { token: adminToken });
    assert.equal(salesJsonRes.status, 200);
    assert.ok((salesJsonRes.data as { data: { summary: unknown } }).data.summary);

    // Sales Report CSV
    const salesCsvRes = await request("/admin/reports/sales?format=csv", { token: adminToken });
    assert.equal(salesCsvRes.status, 200);
    assert.equal(salesCsvRes.headers.get("content-type"), "text/csv; charset=utf-8");
    assert.ok(typeof salesCsvRes.data === "string" && salesCsvRes.data.includes("Sale ID"));

    // Sales Report XLSX
    const salesXlsxRes = await request("/admin/reports/sales?format=xlsx", { token: adminToken });
    assert.equal(salesXlsxRes.status, 200);
    assert.equal(salesXlsxRes.headers.get("content-type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    // Inventory Report JSON
    const invJsonRes = await request("/admin/reports/inventory?format=json", { token: adminToken });
    assert.equal(invJsonRes.status, 200);
    assert.ok((invJsonRes.data as { data: { summary: unknown } }).data.summary);

    // Inventory Report CSV
    const invCsvRes = await request("/admin/reports/inventory?format=csv", { token: adminToken });
    assert.equal(invCsvRes.status, 200);
    assert.equal(invCsvRes.headers.get("content-type"), "text/csv; charset=utf-8");

    // Inventory Report XLSX
    const invXlsxRes = await request("/admin/reports/inventory?format=xlsx", { token: adminToken });
    assert.equal(invXlsxRes.status, 200);
    assert.equal(invXlsxRes.headers.get("content-type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });

  await t.test("PDF Invoice Generation Helper", async () => {
    const category = await database.category.create({ data: { name: `Cat_${timestamp}` } });
    const customer = await database.customer.create({
      data: {
        shopName: "Test PDF Shop",
        contactName: "John Doe",
        phone: sellerPhone,
        categoryId: category.id,
        sellerId,
        createdById: adminUserId,

        state: "TestState",
        district: "TestDistrict",
        village: "TestVillage",
      },
    });

    const sale = await database.sale.create({
      data: {
        sellerId,
        customerId: customer.id,
        quantity: 5,
        unitPricePaise: 3000,
        totalPaise: 15000,
        paymentMode: "CASH",
        status: "CONFIRMED",
      },
    });

    const invoice = await database.invoice.create({
      data: {
        saleId: sale.id,
        number: `INV-TEST-${timestamp}`,
        snapshot: {
          invoiceNumber: `INV-TEST-${timestamp}`,
          saleId: sale.id,
          date: new Date().toISOString(),
          customer: { shopName: "Test PDF Shop", contactName: "John Doe", phone: sellerPhone },
          seller: { name: "Seller Name", phone: sellerPhone },
          quantity: 5,
          unitPricePaise: 3000,
          totalPaise: 15000,
          paymentMode: "CASH",
        },
      },
    });

    const pdfPath = await processInvoicePdf(database, invoice.id);
    assert.ok(pdfPath.startsWith("/storage/invoices/"));
  });

  t.after(async () => {
    await cleanupTestData(database);
    await database.$disconnect();
  });
});

function adminIdFromToken(token: string): string {
  const decoded = JSON.parse(Buffer.from(token.split(".")[1]!, "base64").toString("utf-8"));
  return decoded.sub;
}
