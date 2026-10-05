# Backend implementation checklist

Source: complete PRD supplied on 5 October 2026. This is a plan, not a claim that the listed APIs exist. See API.md for implemented endpoints.

## Existing project summary

The repository starts with 70 empty TypeScript files under src and an empty server.ts. The mentor has already divided routes, controllers and services by admin, manager and seller, with a shared auth area. Keep these folders. Express 5, TypeScript, Prisma 7 and PostgreSQL are declared. Prisma has no business models. There are no working business endpoints, authentication, tests or API documentation in the original scaffold.

Request flow: route -> authentication -> role/scope checks -> validation -> controller -> service -> Prisma -> PostgreSQL -> response. Controllers handle HTTP; services enforce business rules. Do not introduce a repository layer.

## Requirements and acceptance checklist

- [x] JWT login using email or phone, bcrypt passwords, active-account checks, current-user endpoint and password change/token revocation. No public signup.
- [ ] Password recovery and recovery-channel delivery.
- [x] Super Admin creates/lists/edits/deactivates Managers and Sellers and replaces Manager permissions (database integration verification is separate).
- [x] Manager Seller onboarding, assignment/territory-limited Seller list/detail and automatic empty stock account creation.
- [ ] Managers onboard and see only assigned Sellers/customers; permission checks also apply to individual record endpoints.
- [ ] Sellers access only their own customers, sales, stock and incentives.
- [ ] Configurable customer categories; customer/shop name, contact name, phone, category, state, district, village, photo and latitude/longitude.
- [ ] Photo upload to Supabase Storage with size/type validation and scoped access. Browser handles camera and geolocation; API receives photo and coordinates.
- [ ] HQ receipts, HQ-to-warehouse transfers, warehouse-to-Seller allocations, balances and immutable movement history.
- [ ] Positive whole packet quantities; no transfer or confirmed sale may make stock negative, including concurrent requests.
- [ ] Server calculates sale total; Cash/Bank/Pending payment; customer ownership validation.
- [ ] Price below 2500 paise requires approval. Price of exactly 2500 paise does not.
- [ ] Approve/reject only pending sales; record deciding Admin, time and rejection reason.
- [ ] Confirmation deducts stock, earns incentive and creates invoice exactly once in one transaction.
- [ ] Rejected/pending sales do not change stock, sold totals, incentive or final invoice count.
- [ ] Configurable incentive rate with rate captured on each confirmed sale so later changes do not rewrite history.
- [ ] Sales history: all/this month/last month, stable pagination and allowed filters.
- [ ] Pending-payment collection flow with permission checks and payment history.
- [ ] Server-generated invoice PDF containing the confirmed sale snapshot and unique invoice number.
- [ ] Automatic Resend email and configured WhatsApp invoice delivery; Admin WhatsApp approval request; Seller decision notifications.
- [ ] Persist failed delivery attempts and support bounded retries without duplicating sale confirmation or stock deduction.
- [ ] Seller, Manager and Admin dashboards; Admin metrics from PRD, with collected revenue separated from unpaid confirmed sales.
- [ ] Geographic hierarchy and Manager/Seller/category filters; reports and activity visibility.
- [ ] OpenAPI plus frontend API guide, environment setup, critical automated tests and manual integration checklist.

## Working assumptions and unresolved requirements

These choices are provisional and must be visible to the business:

1. One packet product and one HQ; support multiple named warehouses. No product catalog, returns, cancellations, partial payments or stock adjustments until required.
2. Each Seller has one assigned Manager; each customer has one assigned Seller. A Manager selects one of their Sellers while onboarding a customer. Manager scope is assigned ownership plus any configured geographic restriction, never just a frontend filter.
3. Pending low-price sales do not reserve stock. Approval rechecks stock and returns 409 if it is no longer available. Repeated decisions cannot repeat side effects.
4. A sale at or above Rs 25 confirms immediately if stock and required business configuration are valid. Payment Pending is independent of approval Pending: an unpaid confirmed sale still deducts stock and earns incentive.
5. Money is stored as integer paise, e.g. Rs 25 = 2500. Reject negative prices and non-whole quantities. Clarify whether zero-price sales are allowed; initial implementation should require a positive price.
6. Incentive Rs 15 in the PRD is an example, not an approved rate. Require an explicit configured rate before confirmation; never silently invent a rate or treat missing configuration as zero. Business must confirm whether rate is global and whether credit sales earn immediately (PRD currently says confirmed packets).
7. Customer email is missing from the customer fields but required for email invoices. Add an optional email field; show delivery as unavailable if absent. Confirm whether business wants email mandatory.
8. WhatsApp provider remains undecided (Twilio or MSG91). Initially plan an authenticated Admin approval-page link in the message. In-message approve/reject would require a separately specified signed webhook workflow.
9. Categories are Admin-managed, without invented seed values. Category deactivation preserves historical records.
10. Store timestamps in UTC; month filters use Asia/Kolkata calendar boundaries. Return ISO 8601 timestamps.
11. Proposed Total Earnings means confirmed sale value, with paid and pending values also shown. Total Inventory means currently held stock across HQ, warehouses and Sellers, never the sum of cumulative transfers.
12. Geographic/category filters on sales use customer geography/category. Seller stock has no customer category: do not attribute unsold stock to a customer category. Report this explicitly instead of fabricating a filtered stock figure.
13. Confirm territory granularity, reassignment behavior, report/export formats and activity expectations. For MVP, activity comes from onboarding, stock and sales history, not device tracking.
14. Forgot-password delivery needs an agreed email/phone recovery channel; never return reset tokens from production APIs. Missing provider credentials must produce an honest setup/delivery status.

## Proposed minimum database design

The schema and migrations now implement these entities; see DATABASE.md. Remaining module APIs are still planned. Seller reassignment and clearing optional account fields are deferred.

Use Prisma/PostgreSQL. Add createdAt/updatedAt to mutable records and immutable event timestamps to history. Avoid geographic tables until standardized geographic reference data is required.

| Entity | Main fields and relationships |
| --- | --- |
| User | UUID, name, unique normalized email/phone, passwordHash, role, active, optional managerId referring to another User, territory, Manager permission list, token version |
| Category | UUID, unique name, active |
| Customer | UUID, shopName, contactName, phone, optional email, categoryId, sellerId, createdById, state/district/village, photo storage path, latitude/longitude |
| StockLocation | UUID, type HQ/WAREHOUSE/SELLER, name, unique optional sellerId, current packet balance; enforce one HQ |
| StockMovement | UUID, type RECEIPT/TRANSFER/SALE, optional source/destination, positive quantity, actorId, unique optional saleId, timestamp and request key |
| Sale | UUID, sellerId, customerId, quantity, unitPricePaise, totalPaise, payment mode, status PENDING_APPROVAL/CONFIRMED/REJECTED, decision details, timestamps, incentive rate/amount snapshots, request key |
| BusinessSettings | Singleton with minimum price default 2500 and explicitly configured incentive rate (nullable until supplied) |
| Invoice | UUID, unique saleId and invoice number, immutable customer/Seller/sale snapshot, generated PDF storage reference |
| Notification | UUID, recipientId, kind, saleId, message, readAt |
| Delivery | UUID, invoiceId or notificationId, channel EMAIL/WHATSAPP, status, attempts, nextAttemptAt, provider reference, sanitized error |
| PasswordReset | UUID, userId, hashed token, expiry, usedAt |
| PaymentRecord | UUID, saleId, collectorId, payment mode, amountPaise, timestamp; MVP only full settlement |

No separate Approval table is needed: one final decision belongs to one sale. No Incentive ledger is needed for the stated simple per-packet rule: confirmed sales retain their earned amount and rate. Introduce payout tables only if payout tracking is requested.

Critical constraints: unique login identifiers, one stock location per Seller, one invoice and sale stock movement per sale, positive quantities and nonnegative balances, bounded money values. Index foreign keys used for scoping (managerId, sellerId, customerId), sale status/date and invoice number. Add query-specific geographic indexes only after actual query design.

Confirmation and transfers use database transactions plus conditional balance updates. A transaction means all related writes succeed together or none do. Checking stock and then subtracting outside a transaction is not sufficient for concurrent requests.

## Required endpoint plan

All paths below start with /api/v1. These are planned, not implemented contracts. Prefer PATCH activation over destructive deletion of users/history.

| Area | Proposed methods and routes | Access |
| --- | --- | --- |
| Auth | POST /auth/login, /auth/forgot-password, /auth/reset-password; GET /auth/me; PATCH /auth/password | Public login/recovery; authenticated profile/password |
| Managers | GET/POST /admin/managers; GET/PATCH /admin/managers/:id; PATCH /admin/managers/:id/permissions | Super Admin |
| Sellers | GET/POST /admin/sellers; GET/PATCH /admin/sellers/:id; GET/POST /manager/sellers; GET /manager/sellers/:id | Admin; scoped Manager with permission |
| Categories | GET /categories; POST /admin/categories; PATCH /admin/categories/:id | Authenticated read; Admin write |
| Customers | GET/POST /seller/customers; GET/PATCH /seller/customers/:id; corresponding manager and admin routes | Role and ownership scoped |
| Photos | POST /seller/customers/:id/photo; corresponding manager/admin routes | Scoped owner/onboarding permission |
| Inventory | GET /admin/inventory; GET/POST /admin/inventory/warehouses; POST /admin/inventory/receipts; POST /admin/inventory/transfers; GET /admin/inventory/transactions | Admin |
| Scoped inventory | GET /seller/inventory, /seller/inventory/transactions; GET /manager/inventory | Own/scoped read |
| Sales | POST /seller/sales; GET /seller/sales, /seller/sales/:id; GET /manager/sales, /manager/sales/:id; GET /admin/sales, /admin/sales/:id | Own/scoped/global |
| Payments | PATCH /seller/sales/:id/payment; PATCH /admin/sales/:id/payment | Owner/Admin, full settlement only |
| Approvals | GET /admin/approvals; POST /admin/approvals/:saleId/approve, /admin/approvals/:saleId/reject | Admin |
| Incentives | GET /seller/incentives; GET /admin/incentives; GET/PATCH /admin/incentives/settings | Owner/Admin |
| Invoices | GET /seller/sales/:id/invoice; GET /admin/invoices; GET /admin/invoices/:id/pdf | Owner/Admin |
| Dashboards | GET /seller/dashboard, /manager/dashboard, /admin/dashboard | Role/scoped |
| Reports | GET /admin/reports; GET /admin/filters | Admin |
| Notifications | GET /notifications; PATCH /notifications/:id/read | Recipient only |
| Profile | GET/PATCH /seller/profile | Own safe fields, no role/scope escalation |

For lists: page/pageSize with an upper bound, stable sorting, whitelisted fields, and role scope combined with user filters. Invalid IDs -> 400, missing/inaccessible records -> 404, missing/invalid login -> 401, role denial -> 403, duplicate/conflicting state/insufficient stock -> 409. Use 201 for creation and 200 for successful reads/updates.

## Five-day plan

| Day | Deliverables |
| --- | --- |
| 1 | PRD mapping, environment/server setup, schema, Supabase development connection and migrations, first Admin bootstrap |
| 2 | JWT/bcrypt, role and scope middleware, Manager/Seller onboarding, categories, customers, upload flow |
| 3 | Atomic stock receipts/transfers, sales/approvals, payment collection, incentive snapshots, invoice generation |
| 4 | Email/WhatsApp and retry handling, notifications, dashboards/reports, critical integration and concurrency tests, OpenAPI |
| 5 | Full regression and frontend integration, README/API examples, manual checklist, security/Git review and mentor handoff |

Obtain Supabase, Resend and WhatsApp development configuration early. Provider approval or template provisioning may take longer than coding and must remain explicitly tracked.

## Files to modify

First increment: package.json/lockfile, tsconfig.json, .gitignore, .env.example, server.ts, src/app.ts, src/config/env.ts, src/middleware/error.middleware.ts, tests and docs. Preserve existing mentor folders.

Next: prisma/schema.prisma, migrations and seed, src/config/database.ts, existing auth controller/service/routes and auth/rbac middleware. Implement one feature at a time in the existing role folders. Add only missing categories, notifications and integration modules required by the PRD.

## Verification plan

- Startup/build/config errors, JSON error shape, health and CORS behavior.
- Auth: valid/invalid credentials, inactive users, expired/tampered JWTs, denied role, cross-Seller and cross-Manager record access, password recovery reuse/expiry.
- Stock: receipt/transfer math, insufficient stock, invalid quantities, duplicate request and concurrent deductions.
- Sales: exact Rs 25 threshold, server-computed total, unpaid confirmed sale, pending/rejected exclusion, approval after stock changes, repeated/concurrent decisions.
- Incentives: explicit missing-rate behavior and immutable earned rate after setting changes.
- Invoices/delivery: one invoice per confirmation, escaped customer content, PDF output, missing contacts, provider failure/retry without repeating stock writes.
- Data/UI: geographic combinations, pagination, month boundaries, dashboard reconciliation, upload size/type and ownership, docs/examples matched to actual responses.

Reconciliation example: 400 received, 120 allocated, 65 sold -> warehouse 280 + Seller balances 55 + confirmed sold 65 = 400 (HQ zero after full warehouse transfer).
