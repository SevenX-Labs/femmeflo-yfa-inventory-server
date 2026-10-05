// Keep endpoint descriptions/examples together; generate Markdown and OpenAPI.
import { writeFileSync } from "node:fs";

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const uuid = { type: "string", format: "uuid" };
const nullableString = { type: "string", nullable: true };
const permissions = ["SELLER_READ", "SELLER_CREATE", "CUSTOMER_READ", "CUSTOMER_CREATE", "SALES_READ", "INVENTORY_READ"];
const password = { type: "string", minLength: 12, maxLength: 72, description: "12+ characters and at most 72 UTF-8 bytes. The byte limit also applies to Unicode passwords." };
const fields = {
  name: { type: "string", minLength: 1, maxLength: 100 },
  phone: { type: "string", pattern: "^\\+[1-9]\\d{7,14}$" },
  email: { type: "string", format: "email" },
  state: { type: "string", minLength: 1, maxLength: 100 },
  district: { type: "string", minLength: 1, maxLength: 100 },
  village: { type: "string", minLength: 1, maxLength: 100 },
};
const object = (properties, required = Object.keys(properties)) => ({ type: "object", properties, required, additionalProperties: false });
const schemas = {
  Error: object({ success: { type: "boolean", enum: [false] }, message: { type: "string" } }),
  User: object({
    id: uuid, name: { type: "string" }, email: nullableString, phone: nullableString,
    role: { type: "string", enum: ["SUPER_ADMIN", "MANAGER", "SELLER"] }, active: { type: "boolean" },
    managerId: { ...uuid, nullable: true }, permissions: { type: "array", items: { type: "string" } },
    state: nullableString, district: nullableString, village: nullableString,
  }),
  Pagination: object({ page: { type: "integer" }, pageSize: { type: "integer" }, total: { type: "integer" }, totalPages: { type: "integer" } }),
  Login: object({ login: { type: "string", minLength: 1, maxLength: 254, description: "Assigned email or exact international phone number" }, password: { type: "string", minLength: 1, maxLength: 1024 } }),
  ChangePassword: object({ currentPassword: { type: "string", minLength: 1, maxLength: 1024 }, newPassword: password }),
  ManagerCreate: object({ ...fields, password, permissions: { type: "array", items: { type: "string", enum: permissions }, maxItems: 6, default: [] } }, ["name", "phone", "password"]),
  SellerCreate: object({ ...fields, password, managerId: uuid }, ["name", "phone", "password", "managerId"]),
  ManagerSellerCreate: object({ ...fields, password }, ["name", "phone", "password"]),
  UserUpdate: { ...object({ ...fields, active: { type: "boolean" } }, []), minProperties: 1 },
  Permissions: object({ permissions: { type: "array", items: { type: "string", enum: permissions }, maxItems: 6 } }),
};
const manager = { id: "11111111-1111-4111-8111-111111111111", name: "Asha Manager", email: "asha@example.com", phone: "+919876543210", role: "MANAGER", active: true, managerId: null, permissions: ["SELLER_READ", "SELLER_CREATE"], state: "Maharashtra", district: "Thane", village: null };
const seller = { ...manager, id: "22222222-2222-4222-8222-222222222222", name: "Ravi Seller", email: "ravi@example.com", phone: "+919876543211", role: "SELLER", managerId: manager.id, permissions: [], village: "Diva" };
const managerInput = { name: manager.name, phone: manager.phone, email: manager.email, password: "Example password 123!", state: manager.state, district: manager.district, permissions: manager.permissions };
const sellerInput = { name: seller.name, phone: seller.phone, email: seller.email, password: "Example password 123!", state: seller.state, district: seller.district, village: seller.village, managerId: manager.id };
const { managerId: _managerId, ...managerSellerInput } = sellerInput;
const listParameters = [
  ["page", { type: "integer", minimum: 1, maximum: 100000, default: 1 }, "Page number"],
  ["pageSize", { type: "integer", minimum: 1, maximum: 100, default: 20 }, "Items per page"],
  ["search", { type: "string", maxLength: 100 }, "Case-insensitive name, email or phone substring"],
  ["active", { type: "string", enum: ["true", "false"] }, "Account activation status"],
  ["managerId", uuid, "Additional Manager filter; cannot broaden access"],
  ...["state", "district", "village"].map((name) => [name, { type: "string", maxLength: 100 }, "Case-insensitive exact match"]),
].map(([name, schema, description]) => ({ name, in: "query", required: false, schema, description }));
const errorDescriptions = { 400: "Invalid request or ID", 401: "Missing, invalid, expired or revoked authentication; incorrect credentials", 403: "Role, permission or territory denied", 404: "Record not found or outside assigned scope", 409: "Duplicate contact or conflicting update", 413: "JSON body exceeds 100 KB", 415: "Unsupported JSON encoding", 429: "Too many authentication attempts", 500: "Internal server error", 503: "Service unavailable or not configured" };
const definitions = [];
function endpoint(method, path, summary, access, message, data, dataSchema, options = {}) {
  const status = options.status ?? 200;
  const example = { success: true, message, data };
  const parameters = [...(path.includes("{id}") ? [{ name: "id", in: "path", required: true, schema: uuid, description: "Manager or Seller UUID" }] : []), ...(options.list ? listParameters : [])];
  const responses = {
    [status]: { description: message, content: { "application/json": { schema: object({ success: { type: "boolean", enum: [true] }, message: { type: "string" }, data: dataSchema }), example } } },
  };
  for (const code of [...new Set([...(options.errors ?? []), 500])]) {
    responses[code] = { description: errorDescriptions[code], content: { "application/json": { schema: ref("Error"), example: { success: false, message: code === 500 ? "Internal server error" : errorDescriptions[code] } } } };
  }
  const operation = { summary, description: `${access}. ${options.description ?? ""}`.trim(), security: access === "Public" ? [] : [{ bearerAuth: [] }], parameters, responses };
  if (options.body) operation.requestBody = { required: true, content: { "application/json": { schema: ref(options.body), example: options.input } } };
  definitions.push({ method, path, summary, access, operation, status, example, ...options });
}
const userData = object({ user: ref("User") });
const errors = [400, 401, 403, 404, 409];
const listData = object({ items: { type: "array", items: ref("User") }, pagination: ref("Pagination") });
const listExample = (user) => ({ items: [user], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });

endpoint("get", "/health", "HTTP health", "Public", "API is running", { status: "ok", database: "configured" }, object({ status: { type: "string", enum: ["ok"] }, database: { type: "string", enum: ["configured", "not_configured"] } }), { description: "Reports configuration only. Use /ready for a live database check." });
endpoint("get", "/ready", "Database readiness", "Public", "API is ready", { database: "connected" }, object({ database: { type: "string", enum: ["connected"] } }), { errors: [503], description: "Executes SELECT 1. Does not validate schema migrations or external providers." });
endpoint("post", "/auth/login", "Login", "Public", "Login successful", { token: "<JWT returned by login>", tokenType: "Bearer", expiresInSeconds: 3600, user: seller }, object({ token: { type: "string" }, tokenType: { type: "string", enum: ["Bearer"] }, expiresInSeconds: { type: "integer" }, user: ref("User") }), { body: "Login", input: { login: seller.email, password: "Example password 123!" }, errors: [400, 401, 429, 503], description: "Email is trimmed/lowercased; phone must match its stored international format. Unknown/inactive accounts and wrong passwords return the same 401 message." });
endpoint("get", "/auth/me", "Current user", "Any authenticated active account", "Current user", { user: seller }, userData, { errors: [401, 503] });
endpoint("patch", "/auth/password", "Change password", "Any authenticated active account", "Password changed. Log in again", {}, object({}), { body: "ChangePassword", input: { currentPassword: "Example password 123!", newPassword: "Replacement password 123!" }, errors: [400, 401, 409, 429, 503], description: "All existing tokens are revoked. Log in with the new password after success." });

for (const [resource, user, createSchema, createInput] of [["managers", manager, "ManagerCreate", managerInput], ["sellers", seller, "SellerCreate", sellerInput]]) {
  const singular = resource === "managers" ? "Manager" : "Seller";
  endpoint("get", `/admin/${resource}`, `List ${resource}`, "Super Admin", `${singular}s retrieved`, listExample(user), listData, { list: true, errors: [400, 401, 403] });
  endpoint("post", `/admin/${resource}`, `Create ${singular}`, "Super Admin", `${singular} created`, { user }, userData, { status: 201, body: createSchema, input: createInput, errors, description: singular === "Seller" ? "Requires an active Manager; creates a zero-balance Seller stock account in the same transaction." : "Permissions default to an empty list. District requires state; village requires district." });
  endpoint("get", `/admin/${resource}/{id}`, `Get ${singular}`, "Super Admin", `${singular} retrieved`, { user }, userData, { errors: [400, 401, 403, 404] });
  endpoint("patch", `/admin/${resource}/{id}`, `Update ${singular}`, "Super Admin", `${singular} updated`, { user: { ...user, active: false } }, userData, { body: "UserUpdate", input: { active: false }, errors, description: "Editable fields: name, phone, email, state, district, village, active. Role, password, Manager assignment and permissions cannot be changed here. Activation changes revoke earlier tokens. Territory changes must remain consistent with assignments. Fields cannot currently be cleared with null." });
}
endpoint("patch", "/admin/managers/{id}/permissions", "Replace Manager permissions", "Super Admin", "Manager permissions updated", { user: manager }, userData, { body: "Permissions", input: { permissions: manager.permissions }, errors: [400, 401, 403, 404], description: "Replaces the complete list. Changes take effect on the next authenticated request. Only SELLER_READ and SELLER_CREATE have implemented business routes in this increment; other flags are reserved for PRD modules." });
endpoint("get", "/manager/sellers", "List assigned Sellers", "Manager with SELLER_READ", "Assigned Sellers retrieved", listExample(seller), listData, { list: true, errors: [400, 401, 403], description: "Scope combines assignment and the Manager's configured territory. Query filters cannot broaden scope." });
endpoint("post", "/manager/sellers", "Onboard assigned Seller", "Manager with SELLER_CREATE", "Seller created", { user: seller }, userData, { status: 201, body: "ManagerSellerCreate", input: managerSellerInput, errors, description: "Manager ID comes from the logged-in account. Supplying managerId/role/permissions is rejected. Missing territory fields inherit Manager restrictions; conflicting locations return 403. Creates the stock account atomically." });
endpoint("get", "/manager/sellers/{id}", "Get assigned Seller", "Manager with SELLER_READ", "Assigned Seller retrieved", { user: seller }, userData, { errors: [400, 401, 403, 404], description: "Returns 404 for another Manager's Seller or a Seller outside the configured territory." });

const paths = {};
for (const entry of definitions) (paths[entry.path] ??= {})[entry.method] = entry.operation;
writeFileSync(new URL("../docs/openapi.json", import.meta.url), JSON.stringify({
  openapi: "3.0.3", info: { title: "Femmeflo Inventory API", version: "0.2.0", description: "HTTP health, JWT authentication, Manager and Seller onboarding. Remaining PRD modules are not implemented yet." },
  servers: [{ url: "http://localhost:5000/api/v1" }], paths,
  components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } }, schemas },
}, null, 2) + "\n");

const json = (value) => "```json\n" + JSON.stringify(value, null, 2) + "\n```";
let markdown = `# Frontend API reference\n\nBase URL: http://localhost:5000/api/v1. API version: v1. Generated with npm run docs:api from scripts/generate-api-docs.mjs.\n\n## Integration status\n\nImplemented: health/readiness, login, current user, password change, Manager management/permissions, Seller onboarding and scoped Seller reads. Database-backed endpoints need configured PostgreSQL and applied migrations. Forgot/reset password, customers, sales, inventory operations, incentives, invoices, uploads, notifications and reports are not implemented yet.\n\n## Authentication flow\n\n1. An Admin/authorized Manager creates assigned credentials. There is no public signup.\n2. POST /auth/login with login and password.\n3. Keep the returned token in frontend memory and send Authorization: Bearer <token> on protected requests. A full page reload requires login again under this simple flow. There is no refresh token or server logout endpoint; frontend logout discards the token.\n4. A 401 from a protected endpoint means login is needed. Password change or deactivation invalidates existing tokens. Account role/permissions are loaded from the database on each request.\n\n## Shared conventions\n\n- JSON writes: Content-Type: application/json. Protected routes: Authorization: Bearer <token>.\n- UUID path IDs. Unknown body/query fields are rejected on documented input schemas.\n- Phone format: + followed by country code and subscriber digits, e.g. +919876543210. Emails are normalized to lowercase.\n- New passwords: at least 12 characters and at most 72 UTF-8 bytes. Never send role or permissions when onboarding as a Manager.\n- List sorting is fixed: newest created first, then ID ascending for ties. No client-supplied sort is implemented.\n- All list filters combine with AND; search checks name/email/phone. Manager assignment/territory scope always applies.\n- page defaults to 1; pageSize defaults to 20, maximum 100. An empty list has totalPages 0.\n- No date fields or upload endpoints are exposed in this increment. Future dates will be ISO 8601 UTC.\n- Login and password change share a limit of 20 requests per IP per 15 minutes per server process; 429 includes Retry-After. Current setup assumes direct connections. Configure trusted proxy handling before Render deployment; do not blindly trust client forwarded headers.\n- Health reports configuration; readiness checks the connection only, not migration state.\n\n## Common errors\n\n${json({ success: false, message: "Readable error message" })}\n\n| Code | Meaning |\n| --- | --- |\n${Object.entries(errorDescriptions).map(([code, description]) => `| ${code} | ${description} |`).join("\n")}\n\n## Endpoint index\n\n| Method | Path | Access |\n| --- | --- | --- |\n${definitions.map((entry) => `| ${entry.method.toUpperCase()} | ${entry.path} | ${entry.access} |`).join("\n")}\n`;
for (const entry of definitions) {
  markdown += `\n## ${entry.summary}\n\nPurpose: ${entry.operation.description}\n\nMethod/URL: ${entry.method.toUpperCase()} /api/v1${entry.path}\n\nAuthentication: ${entry.access === "Public" ? "Not required" : "Bearer token required"}. Authorization: ${entry.access}.\n\nHeaders: ${entry.access === "Public" ? "No Authorization header required." : "Authorization: Bearer <token>."} ${entry.body ? "Content-Type: application/json." : "No request body."}\n\n`;
  if (entry.operation.parameters.length) {
    markdown += "Parameters:\n\n| Name | Location | Type | Required | Description |\n| --- | --- | --- | --- | --- |\n";
    markdown += entry.operation.parameters.map((param) => `| ${param.name} | ${param.in} | ${param.schema.type}${param.schema.format ? ` (${param.schema.format})` : ""} | ${param.required ? "Yes" : "No"} | ${param.description} |`).join("\n") + "\n\n";
  } else markdown += "Path/query parameters: none.\n\n";
  if (entry.body) {
    const schema = schemas[entry.body];
    markdown += `Request body:\n\n${json(entry.input)}\n\nValidation: required fields: ${schema.required.length ? schema.required.join(", ") : "at least one permitted field"}. Unknown fields are rejected. See shared conventions and OpenAPI for field bounds.\n\n`;
  } else markdown += "Request body: none.\n\n";
  markdown += `Success: HTTP ${entry.status}\n\n${json(entry.example)}\n\nErrors: ${Object.keys(entry.operation.responses).filter((code) => Number(code) >= 400).map((code) => `${code} (${errorDescriptions[code]})`).join("; ")}. Error JSON uses the common format above.\n`;
}
markdown += "\n## Frontend handoff\n\nUse the endpoint index above and [OpenAPI](openapi.json). Bootstrap the initial Admin using the README, then create a Manager with SELLER_READ/SELLER_CREATE, log in as that Manager and onboard a Seller. Password reset, sales and other PRD modules remain unavailable. Seller reassignment and clearing optional fields are not implemented. CORS_ORIGINS must include the frontend origin.\n";
writeFileSync(new URL("../docs/API.md", import.meta.url), markdown);
console.log(`Documented ${definitions.length} endpoint operations.`);
