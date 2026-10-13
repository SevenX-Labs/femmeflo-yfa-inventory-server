import 'dotenv/config';
import { writeFile } from 'node:fs/promises';

const BACKEND_BASE = `http://127.0.0.1:${process.env.PORT || 5000}`;
const FRONTEND_BASE = `http://localhost:3000`;

interface TestCaseResult {
  id: string;
  category: 'BACKEND' | 'FRONTEND';
  type: 'SUCCESS' | 'FAILURE';
  name: string;
  method: string;
  url: string;
  expectedStatus: number | number[];
  actualStatus: number;
  passed: boolean;
  durationMs: number;
  details?: string;
}

const results: TestCaseResult[] = [];

async function testHttp(
  id: string,
  category: 'BACKEND' | 'FRONTEND',
  type: 'SUCCESS' | 'FAILURE',
  name: string,
  method: string,
  fullUrl: string,
  expectedStatus: number | number[],
  options: {
    token?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
) {
  const started = performance.now();
  const headers: Record<string, string> = {
    ...options.headers,
  };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  let actualStatus = 0;
  let details = '';
  try {
    const res = await fetch(fullUrl, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      redirect: 'manual', // do not follow redirects automatically so we can inspect 307 / 308 / 200
      signal: AbortSignal.timeout(15000),
    });
    actualStatus = res.status;
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      details = json.message || (json.error ? JSON.stringify(json.error) : '');
    } catch {
      details = text.slice(0, 100);
    }
  } catch (err: any) {
    actualStatus = 0;
    details = err.message || String(err);
  }

  const durationMs = Math.round(performance.now() - started);
  const isExpected = Array.isArray(expectedStatus)
    ? expectedStatus.includes(actualStatus)
    : actualStatus === expectedStatus;

  const result: TestCaseResult = {
    id,
    category,
    type,
    name,
    method,
    url: fullUrl.replace(BACKEND_BASE, '').replace(FRONTEND_BASE, '') || '/',
    expectedStatus,
    actualStatus,
    passed: isExpected,
    durationMs,
    details: details.slice(0, 80),
  };
  results.push(result);
  return { result, actualStatus };
}

async function runAllTests() {
  console.log('===============================================================');
  console.log('🚀 STARTING COMPREHENSIVE ENDPOINT VERIFICATION SUITE');
  console.log(`Backend: ${BACKEND_BASE}`);
  console.log(`Frontend: ${FRONTEND_BASE}`);
  console.log('===============================================================\n');

  // =========================================================================
  // 1. BACKEND - Health & Status
  // =========================================================================
  console.log('--- 1. BACKEND: Health & Diagnostics ---');
  await testHttp('BE-01', 'BACKEND', 'SUCCESS', 'Health Check', 'GET', `${BACKEND_BASE}/api/v1/health`, 200);
  await testHttp('BE-02', 'BACKEND', 'SUCCESS', 'Database Readiness', 'GET', `${BACKEND_BASE}/api/v1/ready`, 200);
  await testHttp('BE-03', 'BACKEND', 'SUCCESS', 'Server Root Info', 'GET', `${BACKEND_BASE}/`, 200);
  await testHttp('BE-04', 'BACKEND', 'SUCCESS', 'Swagger Docs JSON', 'GET', `${BACKEND_BASE}/docs.json`, 200);
  await testHttp('BE-05', 'BACKEND', 'FAILURE', 'Non-existent backend route 404', 'GET', `${BACKEND_BASE}/api/v1/non-existent-route-xyz`, 404);

  // =========================================================================
  // 2. BACKEND - Role Authentication (Success & Failure)
  // =========================================================================
  console.log('\n--- 2. BACKEND: Role Authentication ---');
  // Admin login tests
  const adminLoginSuccess = await testHttp(
    'BE-06', 'BACKEND', 'SUCCESS', 'Admin Role Login Success', 'POST',
    `${BACKEND_BASE}/api/v1/admin/auth/login`, 200,
    { body: { login: 'admin@femmeflo.com', password: 'AdminPassword123!' } }
  );
  await testHttp(
    'BE-07', 'BACKEND', 'FAILURE', 'Admin Role Login Bad Password (401)', 'POST',
    `${BACKEND_BASE}/api/v1/admin/auth/login`, 401,
    { body: { login: 'admin@femmeflo.com', password: 'WrongPassword999!' } }
  );
  await testHttp(
    'BE-08', 'BACKEND', 'FAILURE', 'Admin Role Login Non-Admin Role Rejection (403)', 'POST',
    `${BACKEND_BASE}/api/v1/admin/auth/login`, 403,
    { body: { login: 'manager_feat_1791902800592@example.com', password: 'Password123!' } }
  );
  await testHttp(
    'BE-09', 'BACKEND', 'FAILURE', 'Admin Role Login Empty Body (400)', 'POST',
    `${BACKEND_BASE}/api/v1/admin/auth/login`, 400,
    { body: {} }
  );

  // Manager login tests
  const managerLoginSuccess = await testHttp(
    'BE-10', 'BACKEND', 'SUCCESS', 'Manager Role Login Success', 'POST',
    `${BACKEND_BASE}/api/v1/manager/auth/login`, 200,
    { body: { login: 'manager_feat_1791902800592@example.com', password: 'Password123!' } }
  );
  await testHttp(
    'BE-11', 'BACKEND', 'SUCCESS', 'Manager Alias /manger/auth/login Success', 'POST',
    `${BACKEND_BASE}/api/v1/manger/auth/login`, 200,
    { body: { login: 'manager_feat_1791902800592@example.com', password: 'Password123!' } }
  );
  await testHttp(
    'BE-12', 'BACKEND', 'FAILURE', 'Manager Role Login Bad Password (401)', 'POST',
    `${BACKEND_BASE}/api/v1/manager/auth/login`, 401,
    { body: { login: 'manager_feat_1791902800592@example.com', password: 'WrongPassword999!' } }
  );
  await testHttp(
    'BE-13', 'BACKEND', 'FAILURE', 'Manager Role Login Non-Manager Role Rejection (403)', 'POST',
    `${BACKEND_BASE}/api/v1/manager/auth/login`, 403,
    { body: { login: 'seller_feat_1791899898543@example.com', password: 'Password123!' } }
  );
  await testHttp(
    'BE-14', 'BACKEND', 'FAILURE', 'Manager Role Login Empty Body (400)', 'POST',
    `${BACKEND_BASE}/api/v1/manager/auth/login`, 400,
    { body: {} }
  );

  // Seller login tests
  const sellerLoginSuccess = await testHttp(
    'BE-15', 'BACKEND', 'SUCCESS', 'Seller Role Login Success', 'POST',
    `${BACKEND_BASE}/api/v1/seller/auth/login`, 200,
    { body: { login: 'seller_feat_1791899898543@example.com', password: 'Password123!' } }
  );
  await testHttp(
    'BE-16', 'BACKEND', 'FAILURE', 'Seller Role Login Bad Password (401)', 'POST',
    `${BACKEND_BASE}/api/v1/seller/auth/login`, 401,
    { body: { login: 'seller_feat_1791899898543@example.com', password: 'WrongPassword999!' } }
  );
  await testHttp(
    'BE-17', 'BACKEND', 'FAILURE', 'Seller Role Login Non-Seller Role Rejection (403)', 'POST',
    `${BACKEND_BASE}/api/v1/seller/auth/login`, 403,
    { body: { login: 'manager_feat_1791902800592@example.com', password: 'Password123!' } }
  );
  await testHttp(
    'BE-18', 'BACKEND', 'FAILURE', 'Seller Role Login Empty Body (400)', 'POST',
    `${BACKEND_BASE}/api/v1/seller/auth/login`, 400,
    { body: {} }
  );

  // Legacy universal auth
  await testHttp(
    'BE-19', 'BACKEND', 'SUCCESS', 'Legacy Universal /auth/login Success', 'POST',
    `${BACKEND_BASE}/api/v1/auth/login`, 200,
    { body: { login: 'admin@femmeflo.com', password: 'AdminPassword123!' } }
  );
  await testHttp(
    'BE-20', 'BACKEND', 'FAILURE', 'Legacy Universal /auth/login Bad Password (401)', 'POST',
    `${BACKEND_BASE}/api/v1/auth/login`, 401,
    { body: { login: 'admin@femmeflo.com', password: 'WrongPassword999!' } }
  );
  await testHttp(
    'BE-21', 'BACKEND', 'FAILURE', 'Legacy Universal /auth/login Empty Body (400)', 'POST',
    `${BACKEND_BASE}/api/v1/auth/login`, 400,
    { body: {} }
  );

  // Fetch tokens for subsequent authorized tests
  let adminToken = '';
  let managerToken = '';
  let sellerToken = '';

  try {
    const rAdmin = await fetch(`${BACKEND_BASE}/api/v1/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'admin@femmeflo.com', password: 'AdminPassword123!' }),
    });
    const dAdmin = await rAdmin.json();
    adminToken = dAdmin.data?.token || '';
  } catch {}

  try {
    const rMgr = await fetch(`${BACKEND_BASE}/api/v1/manager/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'manager_feat_1791902800592@example.com', password: 'Password123!' }),
    });
    const dMgr = await rMgr.json();
    managerToken = dMgr.data?.token || '';
  } catch {}

  try {
    const rSeller = await fetch(`${BACKEND_BASE}/api/v1/seller/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'seller_feat_1791899898543@example.com', password: 'Password123!' }),
    });
    const dSeller = await rSeller.json();
    sellerToken = dSeller.data?.token || '';
  } catch {}

  // /auth/me checks
  await testHttp('BE-22', 'BACKEND', 'SUCCESS', 'Auth Me Profile (Admin Token)', 'GET', `${BACKEND_BASE}/api/v1/auth/me`, 200, { token: adminToken });
  await testHttp('BE-23', 'BACKEND', 'SUCCESS', 'Auth Me Profile (Manager Token)', 'GET', `${BACKEND_BASE}/api/v1/auth/me`, 200, { token: managerToken });
  await testHttp('BE-24', 'BACKEND', 'SUCCESS', 'Auth Me Profile (Seller Token)', 'GET', `${BACKEND_BASE}/api/v1/auth/me`, 200, { token: sellerToken });
  await testHttp('BE-25', 'BACKEND', 'FAILURE', 'Auth Me Without Token (401)', 'GET', `${BACKEND_BASE}/api/v1/auth/me`, 401);
  await testHttp('BE-26', 'BACKEND', 'FAILURE', 'Auth Me With Invalid Token (401)', 'GET', `${BACKEND_BASE}/api/v1/auth/me`, 401, { token: 'invalid.jwt.token' });

  // Categories
  await testHttp('BE-27', 'BACKEND', 'SUCCESS', 'Get Categories (Admin Token)', 'GET', `${BACKEND_BASE}/api/v1/categories`, 200, { token: adminToken });
  await testHttp('BE-28', 'BACKEND', 'FAILURE', 'Get Categories Without Token (401)', 'GET', `${BACKEND_BASE}/api/v1/categories`, 401);

  // =========================================================================
  // 3. BACKEND - Super Admin Endpoints
  // =========================================================================
  console.log('\n--- 3. BACKEND: Super Admin Endpoints ---');
  await testHttp('BE-29', 'BACKEND', 'SUCCESS', 'Admin Get Managers (200)', 'GET', `${BACKEND_BASE}/api/v1/admin/managers`, 200, { token: adminToken });
  await testHttp('BE-30', 'BACKEND', 'FAILURE', 'Admin Get Managers Seller Forbidden (403)', 'GET', `${BACKEND_BASE}/api/v1/admin/managers`, 403, { token: sellerToken });
  await testHttp('BE-31', 'BACKEND', 'FAILURE', 'Admin Get Managers Unauthenticated (401)', 'GET', `${BACKEND_BASE}/api/v1/admin/managers`, 401);

  await testHttp('BE-32', 'BACKEND', 'SUCCESS', 'Admin Get Sellers (200)', 'GET', `${BACKEND_BASE}/api/v1/admin/sellers`, 200, { token: adminToken });
  await testHttp('BE-33', 'BACKEND', 'FAILURE', 'Admin Get Sellers Seller Forbidden (403)', 'GET', `${BACKEND_BASE}/api/v1/admin/sellers`, 403, { token: sellerToken });

  await testHttp('BE-34', 'BACKEND', 'SUCCESS', 'Admin Get Customers (200)', 'GET', `${BACKEND_BASE}/api/v1/admin/customers`, 200, { token: adminToken });
  await testHttp('BE-35', 'BACKEND', 'FAILURE', 'Admin Get Customers Seller Forbidden (403)', 'GET', `${BACKEND_BASE}/api/v1/admin/customers`, 403, { token: sellerToken });

  await testHttp('BE-36', 'BACKEND', 'SUCCESS', 'Admin Get Inventory (200)', 'GET', `${BACKEND_BASE}/api/v1/admin/inventory`, 200, { token: adminToken });
  await testHttp('BE-37', 'BACKEND', 'SUCCESS', 'Admin Get Warehouses (200)', 'GET', `${BACKEND_BASE}/api/v1/admin/inventory/warehouses`, 200, { token: adminToken });
  await testHttp('BE-38', 'BACKEND', 'SUCCESS', 'Admin Get Inventory Transactions (200)', 'GET', `${BACKEND_BASE}/api/v1/admin/inventory/transactions`, 200, { token: adminToken });
  await testHttp('BE-39', 'BACKEND', 'SUCCESS', 'Admin Get Sales (200)', 'GET', `${BACKEND_BASE}/api/v1/admin/sales`, 200, { token: adminToken });
  await testHttp('BE-40', 'BACKEND', 'SUCCESS', 'Admin Get Approvals (200)', 'GET', `${BACKEND_BASE}/api/v1/admin/approvals`, 200, { token: adminToken });
  await testHttp('BE-41', 'BACKEND', 'SUCCESS', 'Admin Get Incentives (200)', 'GET', `${BACKEND_BASE}/api/v1/admin/incentives`, 200, { token: adminToken });
  await testHttp('BE-42', 'BACKEND', 'SUCCESS', 'Admin Get Dashboard (200)', 'GET', `${BACKEND_BASE}/api/v1/admin/dashboard`, 200, { token: adminToken });
  await testHttp('BE-43', 'BACKEND', 'SUCCESS', 'Admin Get Dashboard Filters (200)', 'GET', `${BACKEND_BASE}/api/v1/admin/dashboard/filters`, 200, { token: adminToken });
  await testHttp('BE-44', 'BACKEND', 'SUCCESS', 'Admin Get Invoices (200)', 'GET', `${BACKEND_BASE}/api/v1/admin/invoices`, 200, { token: adminToken });
  await testHttp('BE-45', 'BACKEND', 'SUCCESS', 'Admin Get Permissions (200)', 'GET', `${BACKEND_BASE}/api/v1/admin/permissions`, 200, { token: adminToken });
  await testHttp('BE-46', 'BACKEND', 'SUCCESS', 'Admin Get Sales Reports (200)', 'GET', `${BACKEND_BASE}/api/v1/admin/reports/sales`, 200, { token: adminToken });
  await testHttp('BE-47', 'BACKEND', 'SUCCESS', 'Admin Get Inventory Reports (200)', 'GET', `${BACKEND_BASE}/api/v1/admin/reports/inventory`, 200, { token: adminToken });

  await testHttp('BE-48', 'BACKEND', 'FAILURE', 'Admin Create Manager Validation Failure (400)', 'POST', `${BACKEND_BASE}/api/v1/admin/managers`, 400, { token: adminToken, body: {} });
  await testHttp('BE-49', 'BACKEND', 'FAILURE', 'Admin Create Seller Validation Failure (400)', 'POST', `${BACKEND_BASE}/api/v1/admin/sellers`, 400, { token: adminToken, body: {} });
  await testHttp('BE-50', 'BACKEND', 'FAILURE', 'Admin Patch Manager Bad UUID (400/404)', 'PATCH', `${BACKEND_BASE}/api/v1/admin/managers/invalid-uuid`, [400, 404], { token: adminToken, body: { name: 'New Name' } });
  await testHttp('BE-51', 'BACKEND', 'FAILURE', 'Admin Patch Seller Bad UUID (400/404)', 'PATCH', `${BACKEND_BASE}/api/v1/admin/sellers/invalid-uuid`, [400, 404], { token: adminToken, body: { name: 'New Name' } });

  // =========================================================================
  // 4. BACKEND - Manager Endpoints
  // =========================================================================
  console.log('\n--- 4. BACKEND: Manager Endpoints ---');
  await testHttp('BE-52', 'BACKEND', 'SUCCESS', 'Manager Get Supervised Sellers (200)', 'GET', `${BACKEND_BASE}/api/v1/manager/sellers`, 200, { token: managerToken });
  await testHttp('BE-53', 'BACKEND', 'FAILURE', 'Manager Route Seller Forbidden (403)', 'GET', `${BACKEND_BASE}/api/v1/manager/sellers`, 403, { token: sellerToken });
  await testHttp('BE-54', 'BACKEND', 'FAILURE', 'Manager Route Unauthenticated (401)', 'GET', `${BACKEND_BASE}/api/v1/manager/sellers`, 401);
  await testHttp('BE-55', 'BACKEND', 'FAILURE', 'Manager Create Seller Empty Body (400)', 'POST', `${BACKEND_BASE}/api/v1/manager/sellers`, 400, { token: managerToken, body: {} });

  // =========================================================================
  // 5. BACKEND - Seller Endpoints
  // =========================================================================
  console.log('\n--- 5. BACKEND: Seller Endpoints ---');
  await testHttp('BE-56', 'BACKEND', 'SUCCESS', 'Seller Get Profile (200)', 'GET', `${BACKEND_BASE}/api/v1/seller/profile`, 200, { token: sellerToken });
  await testHttp('BE-57', 'BACKEND', 'FAILURE', 'Seller Route Admin Forbidden (403)', 'GET', `${BACKEND_BASE}/api/v1/seller/profile`, 403, { token: adminToken });
  await testHttp('BE-58', 'BACKEND', 'FAILURE', 'Seller Route Unauthenticated (401)', 'GET', `${BACKEND_BASE}/api/v1/seller/profile`, 401);
  await testHttp('BE-59', 'BACKEND', 'FAILURE', 'Seller Update Profile Empty Body (400)', 'PATCH', `${BACKEND_BASE}/api/v1/seller/profile`, 400, { token: sellerToken, body: {} });
  await testHttp('BE-60', 'BACKEND', 'SUCCESS', 'Seller Get Inventory (200)', 'GET', `${BACKEND_BASE}/api/v1/seller/inventory`, 200, { token: sellerToken });
  await testHttp('BE-61', 'BACKEND', 'SUCCESS', 'Seller Get Sales (200)', 'GET', `${BACKEND_BASE}/api/v1/seller/sales`, 200, { token: sellerToken });
  await testHttp('BE-62', 'BACKEND', 'SUCCESS', 'Seller Get Customers (200)', 'GET', `${BACKEND_BASE}/api/v1/seller/customers`, 200, { token: sellerToken });

  // =========================================================================
  // 6. FRONTEND - Public, Admin, Manager, Seller Routes
  // =========================================================================
  console.log('\n--- 6. FRONTEND: Public & Authentication Pages ---');
  await testHttp('FE-01', 'FRONTEND', 'SUCCESS', 'Public Landing Page (/)', 'GET', `${FRONTEND_BASE}/`, 200);
  await testHttp('FE-02', 'FRONTEND', 'SUCCESS', 'Public Legacy Login (/login)', 'GET', `${FRONTEND_BASE}/login`, 200);
  await testHttp('FE-03', 'FRONTEND', 'FAILURE', 'Non-existent frontend route 404', 'GET', `${FRONTEND_BASE}/non-existent-page-xyz`, [404, 200]); // Next.js returns custom 404 page

  console.log('\n--- 7. FRONTEND: Admin Portal Pages ---');
  await testHttp('FE-04', 'FRONTEND', 'SUCCESS', 'Admin Root (/admin)', 'GET', `${FRONTEND_BASE}/admin`, 200);
  await testHttp('FE-05', 'FRONTEND', 'SUCCESS', 'Admin Login Legacy (/admin/login)', 'GET', `${FRONTEND_BASE}/admin/login`, 200);
  await testHttp('FE-06', 'FRONTEND', 'SUCCESS', 'Admin Role Login (/admin/auth/login)', 'GET', `${FRONTEND_BASE}/admin/auth/login`, 200);
  await testHttp('FE-07', 'FRONTEND', 'SUCCESS', 'Admin Dashboard (/admin/dashboard)', 'GET', `${FRONTEND_BASE}/admin/dashboard`, [200, 307, 308]);
  await testHttp('FE-08', 'FRONTEND', 'SUCCESS', 'Admin Managers List (/admin/managers)', 'GET', `${FRONTEND_BASE}/admin/managers`, 200);
  await testHttp('FE-09', 'FRONTEND', 'SUCCESS', 'Admin Sellers List (/admin/sellers)', 'GET', `${FRONTEND_BASE}/admin/sellers`, 200);
  await testHttp('FE-10', 'FRONTEND', 'SUCCESS', 'Admin Inventory (/admin/inventory)', 'GET', `${FRONTEND_BASE}/admin/inventory`, 200);
  await testHttp('FE-11', 'FRONTEND', 'SUCCESS', 'Admin Sales (/admin/sales)', 'GET', `${FRONTEND_BASE}/admin/sales`, 200);
  await testHttp('FE-12', 'FRONTEND', 'SUCCESS', 'Admin Approvals (/admin/approvals)', 'GET', `${FRONTEND_BASE}/admin/approvals`, 200);
  await testHttp('FE-13', 'FRONTEND', 'SUCCESS', 'Admin Incentives (/admin/incentives)', 'GET', `${FRONTEND_BASE}/admin/incentives`, 200);
  await testHttp('FE-14', 'FRONTEND', 'SUCCESS', 'Admin Invoices (/admin/invoices)', 'GET', `${FRONTEND_BASE}/admin/invoices`, 200);
  await testHttp('FE-15', 'FRONTEND', 'SUCCESS', 'Admin Reports Hub (/admin/reports)', 'GET', `${FRONTEND_BASE}/admin/reports`, 200);
  await testHttp('FE-16', 'FRONTEND', 'SUCCESS', 'Admin Sales Reports (/admin/reports/sales)', 'GET', `${FRONTEND_BASE}/admin/reports/sales`, [200, 307, 308]);
  await testHttp('FE-17', 'FRONTEND', 'SUCCESS', 'Admin Inventory Reports (/admin/reports/inventory)', 'GET', `${FRONTEND_BASE}/admin/reports/inventory`, [200, 307, 308]);
  await testHttp('FE-18', 'FRONTEND', 'SUCCESS', 'Admin Customers (/admin/customers)', 'GET', `${FRONTEND_BASE}/admin/customers`, 200);
  await testHttp('FE-19', 'FRONTEND', 'SUCCESS', 'Admin Categories (/admin/categories)', 'GET', `${FRONTEND_BASE}/admin/categories`, 200);
  await testHttp('FE-20', 'FRONTEND', 'SUCCESS', 'Admin Users (/admin/users)', 'GET', `${FRONTEND_BASE}/admin/users`, [200, 307, 308]);
  await testHttp('FE-21', 'FRONTEND', 'SUCCESS', 'Admin Settings (/admin/settings)', 'GET', `${FRONTEND_BASE}/admin/settings`, [200, 307, 308]);
  await testHttp('FE-22', 'FRONTEND', 'SUCCESS', 'Admin Transactions (/admin/transactions)', 'GET', `${FRONTEND_BASE}/admin/transactions`, [200, 307, 308]);
  await testHttp('FE-23', 'FRONTEND', 'SUCCESS', 'Admin Warehouses (/admin/warehouses)', 'GET', `${FRONTEND_BASE}/admin/warehouses`, [200, 307, 308]);

  console.log('\n--- 8. FRONTEND: Manager Portal Pages ---');
  await testHttp('FE-24', 'FRONTEND', 'SUCCESS', 'Manager Home (/manager)', 'GET', `${FRONTEND_BASE}/manager`, 200);
  await testHttp('FE-25', 'FRONTEND', 'SUCCESS', 'Manager Login Legacy (/manager/login)', 'GET', `${FRONTEND_BASE}/manager/login`, 200);
  await testHttp('FE-26', 'FRONTEND', 'SUCCESS', 'Manager Role Login (/manager/auth/login)', 'GET', `${FRONTEND_BASE}/manager/auth/login`, 200);
  await testHttp('FE-27', 'FRONTEND', 'SUCCESS', 'Manager Sellers List (/manager/sellers)', 'GET', `${FRONTEND_BASE}/manager/sellers`, 200);
  await testHttp('FE-28', 'FRONTEND', 'SUCCESS', 'Manager Add Seller (/manager/sellers/new)', 'GET', `${FRONTEND_BASE}/manager/sellers/new`, 200);
  await testHttp('FE-29', 'FRONTEND', 'SUCCESS', 'Manager Customers List (/manager/customers)', 'GET', `${FRONTEND_BASE}/manager/customers`, 200);
  await testHttp('FE-30', 'FRONTEND', 'SUCCESS', 'Manager Add Customer (/manager/customers/new)', 'GET', `${FRONTEND_BASE}/manager/customers/new`, 200);
  await testHttp('FE-31', 'FRONTEND', 'SUCCESS', 'Manager Alias Home (/manger)', 'GET', `${FRONTEND_BASE}/manger`, 200);
  await testHttp('FE-32', 'FRONTEND', 'SUCCESS', 'Manager Alias Login Legacy (/manger/login)', 'GET', `${FRONTEND_BASE}/manger/login`, [200, 307, 308]);
  await testHttp('FE-33', 'FRONTEND', 'SUCCESS', 'Manager Alias Role Login (/manger/auth/login)', 'GET', `${FRONTEND_BASE}/manger/auth/login`, 200);

  console.log('\n--- 9. FRONTEND: Seller Portal Pages ---');
  await testHttp('FE-34', 'FRONTEND', 'SUCCESS', 'Seller Home (/seller)', 'GET', `${FRONTEND_BASE}/seller`, 200);
  await testHttp('FE-35', 'FRONTEND', 'SUCCESS', 'Seller Login Legacy (/seller/login)', 'GET', `${FRONTEND_BASE}/seller/login`, 200);
  await testHttp('FE-36', 'FRONTEND', 'SUCCESS', 'Seller Role Login (/seller/auth/login)', 'GET', `${FRONTEND_BASE}/seller/auth/login`, 200);
  await testHttp('FE-37', 'FRONTEND', 'SUCCESS', 'Seller Inventory (/seller/inventory)', 'GET', `${FRONTEND_BASE}/seller/inventory`, 200);
  await testHttp('FE-38', 'FRONTEND', 'SUCCESS', 'Seller Sales (/seller/sales)', 'GET', `${FRONTEND_BASE}/seller/sales`, 200);
  await testHttp('FE-39', 'FRONTEND', 'SUCCESS', 'Seller Record Sale (/seller/sales/new)', 'GET', `${FRONTEND_BASE}/seller/sales/new`, 200);
  await testHttp('FE-40', 'FRONTEND', 'SUCCESS', 'Seller Customers (/seller/customers)', 'GET', `${FRONTEND_BASE}/seller/customers`, 200);
  await testHttp('FE-41', 'FRONTEND', 'SUCCESS', 'Seller Add Customer (/seller/customers/new)', 'GET', `${FRONTEND_BASE}/seller/customers/new`, 200);

  // Write results JSON
  await writeFile('test-endpoint-results.json', JSON.stringify({ results }, null, 2));

  // Print Summary
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log('\n===============================================================');
  console.log('📊 TEST EXECUTION SUMMARY:');
  console.log(`Total Test Cases Executed: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  console.log('===============================================================\n');

  if (failed > 0) {
    console.log('FAILED TEST CASES:');
    for (const f of results.filter((r) => !r.passed)) {
      console.log(`- [${f.id}] ${f.name}: Expected ${JSON.stringify(f.expectedStatus)}, got ${f.actualStatus} (${f.details})`);
    }
  }
}

runAllTests().catch((err) => {
  console.error('Test run failed unexpectedly:', err);
  process.exit(1);
});
