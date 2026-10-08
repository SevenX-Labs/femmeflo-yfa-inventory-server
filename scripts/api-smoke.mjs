import 'dotenv/config';
import { writeFile } from 'node:fs/promises';

const base = `http://127.0.0.1:${process.env.PORT || 5000}/api/v1`;
const results = [];
const items = [];
let token;
async function check(name, path, expected, { method = 'GET', body, authenticated = false, raw, invalidToken = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authenticated || invalidToken) headers.Authorization = `Bearer ${invalidToken ? 'invalid-token' : token}`;
  const started = performance.now();
  const response = await fetch(base + path, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)), signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch {}
  results.push({ name, method, path, expected, status: response.status, passed: response.status === expected, milliseconds: Math.round(performance.now() - started), message: data?.message });
  const request = { method, header: [{ key: 'Content-Type', value: 'application/json' }], url: '{{baseUrl}}' + path, auth: authenticated ? { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] } : invalidToken ? { type: 'bearer', bearer: [{ key: 'token', value: 'invalid-token', type: 'string' }] } : { type: 'noauth' } };
  if (raw !== undefined || body !== undefined) request.body = { mode: 'raw', raw: raw ?? JSON.stringify(path === '/auth/login' && expected === 200 ? { login: '{{login}}', password: '{{password}}' } : body, null, 2), options: { raw: { language: 'json' } } };
  const script = [`pm.test(${JSON.stringify(name)}, () => pm.response.to.have.status(${expected}));`];
  if (path === '/auth/login' && expected === 200) script.push('if (pm.response.code === 200) pm.collectionVariables.set("token", pm.response.json().data.token);');
  items.push({ name, request, event: [{ listen: 'test', script: { type: 'text/javascript', exec: script } }] });
  return data;
}

await check('Health', '/health', 200);
await check('Database readiness', '/ready', 200);
await check('OpenAPI document', '/docs.json', 200);
await check('Unknown route', '/does-not-exist', 404);
await check('Missing login fields', '/auth/login', 400, { method: 'POST', body: {} });
await check('Malformed JSON', '/auth/login', 400, { method: 'POST', raw: '{' });
await check('Wrong credentials', '/auth/login', 401, { method: 'POST', body: { login: 'api-smoke-nonexistent@example.invalid', password: 'IncorrectPassword123!' } });
await check('Missing token', '/auth/me', 401);
await check('Invalid token', '/auth/me', 401, { invalidToken: true });
const login = await check('Admin login', '/auth/login', 200, { method: 'POST', body: { login: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
token = login?.data?.token;
if (token) {
  for (const path of ['/auth/me', '/categories', '/admin/managers', '/admin/sellers', '/admin/customers', '/admin/inventory', '/admin/inventory/warehouses', '/admin/inventory/transactions', '/admin/sales', '/admin/approvals', '/admin/incentives', '/admin/dashboard', '/admin/dashboard/filters', '/admin/invoices', '/admin/permissions', '/admin/reports/sales', '/admin/reports/inventory']) {
    await check(`Admin GET ${path}`, path, 200, { authenticated: true });
  }
  await check('Admin cannot access manager-only route', '/manager/sellers', 403, { authenticated: true });
  await check('Admin cannot access seller-only route', '/seller/profile', 403, { authenticated: true });
}
await writeFile('api-smoke-results.json', JSON.stringify({ base, results }, null, 2));
await writeFile('docs/api-smoke.postman_collection.json', JSON.stringify({ info: { name: 'Femmeflo API smoke checks', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' }, variable: [{ key: 'baseUrl', value: base }, { key: 'login', value: '' }, { key: 'password', value: '' }, { key: 'token', value: '' }], item: items }, null, 2));
console.table(results);
if (results.some(result => !result.passed)) process.exitCode = 1;
