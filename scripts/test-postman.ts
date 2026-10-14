import 'dotenv/config';
import { readFile, readdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { createApp } from '../src/app.js';
import { createAuthService } from '../src/services/auth/auth.service.js';
import { createAuthRoutes } from '../src/routes/auth/auth.routes.js';
import { createUserRoutes } from '../src/routes/user.routes.js';

// Real HTTP + PostgreSQL, using only a newly generated disposable schema.
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required');
process.env.NODE_ENV = 'test';
const schema = `inventory_test_${randomUUID().replaceAll('-', '')}`;
const url = new URL(process.env.TEST_DATABASE_URL);
url.searchParams.set('options', `-c search_path=${schema}`);
const pool = new pg.Pool({ connectionString: url.toString(), connectionTimeoutMillis: 10000, max: 3 });
const db = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) });
const collection = JSON.parse(await readFile(new URL('../docs/postman-manual-testing.postman_collection.json', import.meta.url), 'utf8'));
const items = collection.item.flatMap((folder: any) => folder.item);
const vars: Record<string, string> = Object.fromEntries(collection.variable.map((v: any) => [v.key, v.value]));
vars.adminLogin = 'postman.admin@example.com';
vars.adminPassword = 'Postman test password 123!';
const results: any[] = [];
const completed = new Set<any>();
let server: ReturnType<ReturnType<typeof createApp>['listen']> | undefined;
let created = false;
let base = '';
const originalCwd = process.cwd();
const storageWorkspace = await mkdtemp(path.join(tmpdir(), 'inventory-postman-'));
process.chdir(storageWorkspace); // Invoice PDFs are written beneath cwd; isolate those too.
const resolve = (value: string) => value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
  if (!vars[key]) throw new Error(`Unresolved collection variable: ${key}`);
  return vars[key];
});
async function call(name: string, method: string, path: string, body: any, token: string, expected: number, check?: (data: any) => void) {
  const row: any = { name, method, path, expected, status: null, pass: false };
  results.push(row);
  try {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
    row.status = response.status;
    const contentType = response.headers.get('content-type') || '';
    const data: any = contentType.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, expected, data?.message || 'Unexpected status');
    if (contentType.includes('json')) assert.equal(data.success, expected < 400);
    check?.(data);
    row.pass = true;
    console.log(`PASS ${name} (${row.status})`);
    return data;
  } catch (error) {
    row.error = error instanceof Error ? error.message : String(error);
    console.log(`FAIL ${name}: ${row.error}`);
    return undefined;
  }
}
async function run(item: any, override?: any) {
  completed.add(item);
  const req = item.request;
  const body = override ?? (req.body ? JSON.parse(resolve(req.body.raw)) : undefined);
  const data = await call(item.name, req.method, resolve(req.url).slice(base.length), body, req.auth.type === 'bearer' ? resolve(req.auth.bearer[0].value) : '', item.response[0].code);
  const save = req.description.match(/Save manually: (\{[\s\S]*\})/);
  if (data && save) for (const [key, path] of Object.entries(JSON.parse(save[1]))) {
    const value = (path as string).split('.').reduce((obj: any, part: string) => obj?.[part], data);
    if (value !== undefined) vars[key] = String(value);
  }
  return data;
}
const byName = (name: string) => items.find((i: any) => i.name === name);
const step = (name: string, override?: any) => run(byName(name), override);
async function invariant(name: string, check: () => Promise<void>) {
  try { await check(); results.push({ name, pass: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, pass: false, error: String(error) }); console.log(`FAIL ${name}: ${error}`); }
}
try {
  await pool.query(`CREATE SCHEMA "${schema}"`); created = true;
  const dir = new URL('../prisma/migrations/', import.meta.url);
  const migrations = (await readdir(dir, { withFileTypes: true })).filter(e => e.isDirectory()).sort((a,b) => a.name.localeCompare(b.name));
  for (const entry of migrations) await pool.query((await readFile(new URL(`${entry.name}/migration.sql`, dir), 'utf8')).replace('CREATE SCHEMA IF NOT EXISTS "public";', ''));
  await db.user.create({ data: { name: 'Postman Admin', email: vars.adminLogin, passwordHash: await bcrypt.hash(vars.adminPassword!, 4), role: 'SUPER_ADMIN' } });
  await db.businessSettings.create({ data: { id: 1 } });
  await db.stockLocation.create({ data: { type: 'HQ', name: 'HQ' } });
  const auth = createAuthService(db, { secret: randomBytes(48).toString('hex'), expiresIn: '1h' });
  const app = createApp({ corsOrigins: [], requestLogging: false, authRoutes: createAuthRoutes(auth), userRoutes: createUserRoutes(db, auth), checkDatabase: async () => { await pool.query('SELECT 1'); } });
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server!.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}/api/v1`; vars.baseUrl = base;
  for (const name of ['Check HTTP health', 'Check database readiness', 'Login as admin', 'Create Manager', 'Create Seller', 'Login as manager', 'Login as seller', 'Create category', 'Create customer as seller', 'Get own stock', 'Receive 100 packets at HQ', 'Transfer 50 packets to seller', 'Set price and incentive']) await step(name);
  const stock = async (quantity: number) => assert.equal((await db.stockLocation.findUniqueOrThrow({ where: { id: vars.sellerLocationId } as any })).balance, quantity);
  await invariant('Receipt and transfer conserve total stock', async () => { await stock(50); assert.equal((await db.stockLocation.aggregate({ _sum: { balance: true } }))._sum.balance, 100); });
  const sale: any = await step('Create confirmed unpaid sale');
  await invariant('Confirmed sale totals and stock', async () => { assert.equal(sale.data.sale.totalPaise, 25000); assert.equal(sale.data.sale.incentiveAmountPaise, 2000); assert.equal(sale.data.sale.status, 'CONFIRMED'); await stock(40); });
  await step('Collect full pending payment');
  await invariant('Payment does not deduct stock again', async () => { await stock(40); });
  await step('Create low-price sale for approval');
  await invariant('Pending approval does not deduct stock', async () => { await stock(40); });
  await step('List pending approvals'); await step('Approve low-price sale');
  const reject = await call('Create separate rejection fixture', 'POST', '/seller/sales', { customerId: vars.customerId, quantity: 5, unitPricePaise: 2000, paymentMode: 'PENDING' }, vars.sellerToken!, 201);
  vars.rejectSaleId = reject?.data.sale.id;
  await step('Reject a separate low-price sale');
  await invariant('Main flow: stock 35, revenue 35000, incentive 3000, two invoices', async () => {
    await stock(35);
    const sums = await db.sale.aggregate({ where: { status: 'CONFIRMED' }, _sum: { totalPaise: true, incentiveAmountPaise: true, quantity: true } });
    assert.deepEqual(sums._sum, { totalPaise: 35000, incentiveAmountPaise: 3000, quantity: 15 });
    assert.equal(await db.invoice.count(), 2);
    assert.equal((await db.stockLocation.aggregate({ _sum: { balance: true } }))._sum.balance, 85);
  });
  // Remaining collection examples: avoid duplicate fixtures and defer credential changes.
  for (const item of items) {
    if (completed.has(item) || /password/i.test(item.name)) continue;
    let override;
    if (item.name === 'Create category') override = { name: 'QA Alias Category' };
    if (/Create customer as (manager|admin)/.test(item.name)) override = { ...JSON.parse(resolve(item.request.body.raw)), phone: item.name.includes('manager') ? '+919000000105' : '+919000000106' };
    await run(item, override);
  }
  const a = vars.adminToken!, s = vars.sellerToken!, m = vars.managerToken!;
  await call('Missing token', 'GET', '/seller/inventory', undefined, '', 401);
  await call('Wrong role', 'GET', '/admin/managers', undefined, s, 403);
  await call('Malformed UUID', 'GET', '/admin/sellers/not-a-uuid', undefined, a, 400);
  await call('Unknown query field', 'GET', '/admin/sellers?sort=no', undefined, a, 400);
  await call('Invalid pagination', 'GET', '/admin/sellers?pageSize=101', undefined, a, 400);
  await call('Zero receipt', 'POST', '/admin/inventory/receipts', { quantity: 0 }, a, 400);
  await call('Self transfer', 'POST', '/admin/inventory/transfers', { sourceId: vars.hqLocationId, destinationId: vars.hqLocationId, quantity: 1 }, a, 400);
  await call('Insufficient transfer stock', 'POST', '/admin/inventory/transfers', { sourceId: vars.hqLocationId, destinationId: vars.sellerLocationId, quantity: 100000 }, a, 409);
  await call('Repeat approval', 'POST', `/admin/approvals/${vars.pendingSaleId}/approve`, undefined, a, 409);
  await call('Repeat payment', 'PATCH', `/seller/sales/${vars.saleId}/payment`, { mode: 'CASH' }, s, 409);
  await call('Invalid payment mode', 'PATCH', `/seller/sales/${vars.saleId}/payment`, { mode: 'PENDING' }, s, 400);
  await call('Duplicate category', 'POST', '/admin/categories', { name: 'qa retail' }, a, 409);
  await call('Unknown route', 'GET', '/does-not-exist', undefined, a, 404);
  for (const report of ['sales', 'inventory']) for (const format of ['csv', 'xlsx']) await call(`${report} export ${format}`, 'GET', `/admin/reports/${report}?format=${format}`, undefined, a, 200, data => { assert.ok(Buffer.isBuffer(data) && data.length > 0); if (format === 'xlsx') assert.equal(data.subarray(0,2).toString(), 'PK'); });
  await call('Revoke manager permissions', 'PATCH', `/admin/managers/${vars.managerId}/permissions`, { permissions: [] }, a, 200);
  await call('Revoked permission takes effect', 'GET', '/manager/sellers', undefined, m, 403);
  await call('Restore manager permissions', 'PATCH', `/admin/managers/${vars.managerId}/permissions`, { permissions: ['SELLER_READ','SELLER_CREATE'] }, a, 200);
  const keyedBody = { customerId: vars.customerId, quantity: 1, unitPricePaise: 2500, paymentMode: 'PENDING', requestKey: randomUUID() };
  const keyed: any = await call('Idempotent sale fixture', 'POST', '/seller/sales', keyedBody, s, 201);
  const balanceBeforeReplay = (await db.stockLocation.findUniqueOrThrow({ where: { id: vars.sellerLocationId } as any })).balance;
  await call('Same seller idempotent replay', 'POST', '/seller/sales', keyedBody, s, 201, (data: any) => assert.equal(data.data.sale.id, keyed.data.sale.id));
  await invariant('Idempotent replay does not deduct stock', async () => { await stock(balanceBeforeReplay); });
  const secondLogin: any = await call('Second seller login for ownership tests', 'POST', '/auth/login', { login: 'qa.seller2@example.com', password: vars.sellerPassword }, '', 200);
  await call('Other seller cannot read sale', 'GET', `/seller/sales/${vars.saleId}`, undefined, secondLogin?.data.token, 404);
  const secondCustomer: any = await call('Second seller customer fixture', 'POST', '/seller/customers', { shopName: 'Second Seller Shop', contactName: 'QA Other', phone: '+919000000109', categoryId: vars.categoryId, state: 'Maharashtra', district: 'Thane', village: 'Diva' }, secondLogin?.data.token, 201);
  await call('SECURITY: other seller must not obtain sale via requestKey', 'POST', '/seller/sales', { ...keyedBody, customerId: secondCustomer?.data.customer.id }, secondLogin?.data.token, 403);
  await call('BUSINESS RULE: rejected sale must not accept payment', 'PATCH', `/seller/sales/${vars.rejectSaleId}/payment`, { mode: 'CASH' }, s, 409);
  await step('Change seller password');
  await call('Password change invalidates token', 'GET', '/auth/me', undefined, s, 401);
  await step('Request seller password reset'); await step('Reset seller password');
  await call('Reset token cannot be reused', 'POST', '/auth/reset-password', { token: vars.resetToken, newPassword: vars.newPassword }, '', 400);
  vars.sellerPassword = vars.newPassword!; await step('Login as seller');
  await call('Deactivate test seller', 'PATCH', `/admin/sellers/${vars.sellerId}`, { active: false }, a, 200);
  await call('Deactivation invalidates token', 'GET', '/auth/me', undefined, vars.sellerToken!, 401);
  await call('Deactivated login rejected', 'POST', '/auth/login', { login: vars.sellerLogin, password: vars.sellerPassword }, '', 401);
} catch (error) {
  results.push({ name: 'Runner/setup', pass: false, error: error instanceof Error ? error.message : String(error) });
  console.error('Runner stopped:', error instanceof Error ? error.message : String(error));
} finally {
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
  await db.$disconnect();
  if (created && /^inventory_test_[a-f0-9]{32}$/.test(schema)) {
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    console.log('Disposable test schema removed');
  }
  await pool.end();
  process.chdir(originalCwd);
  if (path.dirname(storageWorkspace) !== path.resolve(tmpdir()) || !path.basename(storageWorkspace).startsWith('inventory-postman-')) throw new Error('Unsafe temporary storage path');
  await rm(storageWorkspace, { recursive: true, force: true });
  const untested = items.filter((i: any) => !completed.has(i)).map((i: any) => i.name);
  const failed = results.filter(r => !r.pass);
  const summary = { executedAt: new Date().toISOString(), source: 'docs/postman-manual-testing.postman_collection.json', collectionExamples: items.length, executedExamples: completed.size, checks: results.length, passed: results.length - failed.length, failed: failed.length, untested, results };
  await writeFile(new URL('../docs/POSTMAN_TEST_RESULTS.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n');
  await writeFile(new URL('../docs/POSTMAN_TEST_RESULTS.md', import.meta.url), `# Automated Postman documentation test results\n\nExecuted: ${summary.executedAt}\n\nReal HTTP requests against the application and a disposable PostgreSQL schema with all migrations. Existing application records were not modified.\n\nCollection examples executed: ${completed.size}/${items.length}. Checks: ${results.length}; passed: ${summary.passed}; failed: ${failed.length}.\n\nRerun: \`npm.cmd run test:postman\` (requires TEST_DATABASE_URL in .env).\n\nChecks assert collection HTTP status/success, the main flow stock and financial totals, exports, validation, roles, permissions, and credential invalidation. This does not certify concurrency, deployment infrastructure, or every possible input/filter combination.\n\n| Check | Expected | Actual | Result | Detail |\n| --- | --- | --- | --- | --- |\n${results.map(r => `| ${r.name} | ${r.expected ?? 'Invariant'} | ${r.status ?? '—'} | ${r.pass ? 'PASS' : 'FAIL'} | ${(r.error ?? '').replaceAll('|', '/').replaceAll('\n', ' ')} |`).join('\n')}\n\nUntested examples: ${untested.join(', ') || 'None'}.\n`);
  console.log(JSON.stringify({ examples: `${completed.size}/${items.length}`, passed: summary.passed, failed: failed.length, untested }));
  if (failed.length || untested.length) process.exitCode = 1;
}
