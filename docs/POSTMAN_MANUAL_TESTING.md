# Femmeflo API manual testing guide for Postman

Prepared 8 October 2026. This guide covers the API operations mounted by the current source code. Expected responses are code-derived examples, not results of live requests. Existing API.md and openapi.json describe an older implementation and omit several current modules.

## How to use this guide

Use the setup and main test flow first, then use the endpoint reference for individual tests. Every reference entry specifies the method, URL, token, required body fields, optional query parameters and expected status/JSON. Response examples are **key-field projections**: actual JSON can include additional model fields, timestamps and nested relations. IDs, timestamps, invoice numbers and totals vary with your data. Array examples show representative rows rather than every row; pagination examples assume one matching record. Do not compare dynamic JSON literally.

### Start the API

From the server directory, install dependencies with npm.cmd ci if needed. Configure local .env using .env.example, with DATABASE_URL and JWT_SECRET. On a dedicated development database, run npm.cmd run db:migrate. If no Super Admin exists, configure ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD, then run npm.cmd run db:bootstrap-admin. Bootstrap refuses to replace an existing Admin. Start with npm.cmd run dev. Do not overwrite an existing .env. Default port is 5000; use your configured PORT if different.

Check GET /health and GET /ready before authentication. Without database/auth configuration, /auth/* returns 503 and protected business routes are not mounted (404). A configured but unreachable database can prevent startup. A successful readiness response does not prove migrations exist.

### Configure Postman

Import **postman-manual-testing.postman_collection.json** from this docs folder. It contains all operations below, role-specific Bearer tokens, sample bodies, expected response examples and status checks. Requests are intended to be sent individually; do not run the whole collection blindly because it includes alternative creation routes and password changes.

The collection contains these variables. Edit them in the collection Variables tab (or use an environment consistently; environment values override collection values). Credentials and tokens are local test values; enter the Admin credentials you bootstrapped.

| Variable | Value or source |
| --- | --- |
| baseUrl | http://localhost:5000/api/v1 (no trailing slash) |
| adminLogin / adminPassword | Your existing Super Admin credentials |
| managerLogin / managerPassword | qa.manager@example.com / Example password 123! |
| sellerLogin / sellerPassword | qa.seller@example.com / Example password 123! |
| newPassword | Replacement password 123! |
| adminToken / managerToken / sellerToken | data.token from the corresponding login |
| managerId / sellerId | data.user.id from account creation |
| categoryId / customerId | data.category.id / data.customer.id |
| hqLocationId | data.hq.id from receipt or HQ entry in inventory summary |
| sellerLocationId | data.locationId from GET /seller/inventory |
| warehouseId | data.warehouse.id (a stock-location ID) |
| saleId / pendingSaleId / rejectSaleId | Separate IDs for confirmed, approval and rejection cases |
| invoiceId | data.sale.invoice.id from confirmed sale |
| resetToken | Top-level debugToken from development forgot-password response |

Save returned IDs/tokens manually. The collection deliberately does not overwrite variables automatically. Unresolved {{variables}} are not valid UUIDs. Use unique emails, phones, category and warehouse names when repeating setup in an existing database.

For JSON writes choose Body → raw → JSON, with Content-Type: application/json. Protected calls use Authorization → Bearer Token with the role token shown. Public calls use No Auth. GET requests have no body; enter filters in Params. The collection already configures these settings.

### Shared rules

- Money fields ending in Paise are integers: 2500 = INR 25, 200 = INR 2. Quantities are packet counts, not currency.
- IDs are UUIDs returned by the API. Stock location IDs differ from user IDs.
- Phone example: +919000000101. New passwords need at least 12 characters and at most 72 UTF-8 bytes.
- Strict body/query schemas reject unknown keys. Most PATCH calls require at least one allowed field. Optional generally means omit, not null; incentiveRatePaise explicitly permits null.
- Paginated endpoints default to page=1 and pageSize=20, with maximum pageSize=100. An empty paginated result is items:[] and total=0, totalPages=0.
- Login, forgot-password, reset-password and password change share 20 requests per IP per 15 minutes. HTTP 429 includes Retry-After. Avoid repeatedly logging in for every request.
- There is no public signup, refresh token, logout, DELETE, file-upload or mounted invoice-PDF-download endpoint.

## Main test flow

This sequence makes the numeric expectations repeatable for a new seller. Existing global database data can change Admin totals; record starting balances and compare deltas when needed.

| Step | Request and action | Expected result |
| --- | --- | --- |
| 1 | GET /health then /ready | 200; database configured then connected |
| 2 | POST /auth/login as Admin; save adminToken | 200; user.role SUPER_ADMIN |
| 3 | POST /admin/managers; save managerId | 201; MANAGER with SELLER_READ and SELLER_CREATE |
| 4 | POST /admin/sellers using managerId; save sellerId | 201; SELLER and initial stock 0 |
| 5 | Login as Manager and Seller; save both tokens | 200; respective role |
| 6 | POST /admin/categories; save categoryId | 201; active category |
| 7 | POST /seller/customers; save customerId | 201; customer owned by test seller |
| 8 | GET /seller/inventory; save sellerLocationId | 200; assigned/sold/remaining all 0 |
| 9 | POST /admin/inventory/receipts with quantity 100; save hqLocationId | 201; HQ increases by 100 |
| 10 | POST /admin/inventory/transfers HQ → seller, quantity 50 | 200; seller 50; HQ decreases by 50 |
| 11 | PATCH /admin/incentives/settings with minimum 2500, incentive 200 | 200; settings saved |
| 12 | POST /seller/sales: 10 packets at 2500, PENDING payment; save saleId and invoiceId | 201 CONFIRMED; total 25000, incentive 2000; seller stock 40 |
| 13 | PATCH /seller/sales/{{saleId}}/payment with mode CASH | 200; payment 25000, stock still 40 |
| 14 | POST /seller/sales: 5 packets at 2000, PENDING; save pendingSaleId | 201 PENDING_APPROVAL; total 10000, stock still 40 |
| 15 | GET /admin/approvals, then POST /admin/approvals/{{pendingSaleId}}/approve | 200 CONFIRMED; incentive 1000; stock 35 |
| 16 | Create another 5-packet low-price sale; save rejectSaleId; POST reject | 200 REJECTED; stock stays 35; no invoice for rejected sale |
| 17 | Read sales, invoices, incentives, dashboards and reports | Two confirmed sales, 15 sold, 35000 paise sales, 3000 paise incentive; seller 35 remaining |
| 18 | Test alternate routes, warehouse transfers and filters separately | Compare changes against current balances; totals above will change |
| 19 | Perform password/reset and deactivation tests last | Old tokens rejected; login again with current credentials |

The unpaid approved sale still counts toward confirmed sales revenue and incentives. Payment collection is a separate operation. After the main flow on an otherwise empty database: HQ 50, seller 35, total stock 85; one CASH sale and one PENDING-payment confirmed sale.

## Endpoint reference

The collection repeats login for three roles and sale creation for two scenarios. Alias paths are documented separately. General error checks follow the endpoint reference.

### 01 Health

#### 01 Check HTTP health

**GET {{baseUrl}}/health**

Authorization: No Auth. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Also returns 200 with database not_configured when no database/auth configuration exists. This does not prove database connectivity.

Expected response (key fields):

```json
{
  "success": true,
  "message": "API is running",
  "data": {
    "status": "ok",
    "database": "configured"
  }
}
```

#### 02 Check database readiness

**GET {{baseUrl}}/ready**

Authorization: No Auth. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

503: Database is not configured OR Database is unavailable. Readiness does not verify migrations.

Expected response (key fields):

```json
{
  "success": true,
  "message": "API is ready",
  "data": {
    "database": "connected"
  }
}
```

### 02 Login

#### 03 Login as admin

**POST {{baseUrl}}/auth/login**

Authorization: No Auth. Expected HTTP **200**.

Query parameters: None used by this handler.

Required body fields: login, password.

Request body:

```json
{
  "login": "{{adminLogin}}",
  "password": "{{adminPassword}}"
}
```

Use existing assigned email or international phone. Email is lowercased. Token expiry follows JWT_EXPIRES_IN (default 3600 seconds). Admin identity fields depend on your bootstrap account.

Save from response: `data.token` → `{{adminToken}}`.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "<JWT>",
    "tokenType": "Bearer",
    "expiresInSeconds": 3600,
    "user": {
      "id": "<admin UUID>",
      "name": "QA Seller",
      "email": "qa.seller@example.com",
      "phone": "+919000000102",
      "role": "SUPER_ADMIN",
      "active": true,
      "managerId": null,
      "permissions": [],
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva"
    }
  }
}
```

#### 04 Login as manager

**POST {{baseUrl}}/auth/login**

Authorization: No Auth. Expected HTTP **200**.

Query parameters: None used by this handler.

Required body fields: login, password.

Request body:

```json
{
  "login": "{{managerLogin}}",
  "password": "{{managerPassword}}"
}
```

Use existing assigned email or international phone. Email is lowercased. Token expiry follows JWT_EXPIRES_IN (default 3600 seconds). Admin identity fields depend on your bootstrap account.

Save from response: `data.token` → `{{managerToken}}`.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "<JWT>",
    "tokenType": "Bearer",
    "expiresInSeconds": 3600,
    "user": {
      "id": "{{managerId}}",
      "name": "QA Manager",
      "email": "qa.manager@example.com",
      "phone": "+919000000101",
      "role": "MANAGER",
      "active": true,
      "managerId": null,
      "permissions": [
        "SELLER_READ",
        "SELLER_CREATE"
      ],
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva"
    }
  }
}
```

#### 05 Login as seller

**POST {{baseUrl}}/auth/login**

Authorization: No Auth. Expected HTTP **200**.

Query parameters: None used by this handler.

Required body fields: login, password.

Request body:

```json
{
  "login": "{{sellerLogin}}",
  "password": "{{sellerPassword}}"
}
```

Use existing assigned email or international phone. Email is lowercased. Token expiry follows JWT_EXPIRES_IN (default 3600 seconds). Admin identity fields depend on your bootstrap account.

Save from response: `data.token` → `{{sellerToken}}`.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "<JWT>",
    "tokenType": "Bearer",
    "expiresInSeconds": 3600,
    "user": {
      "id": "{{sellerId}}",
      "name": "QA Seller",
      "email": "qa.seller@example.com",
      "phone": "+919000000102",
      "role": "SELLER",
      "active": true,
      "managerId": "{{managerId}}",
      "permissions": [],
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva"
    }
  }
}
```

#### 06 Get current account

**GET {{baseUrl}}/auth/me**

Authorization: Bearer {{sellerToken}}. Expected HTTP **200**.

Access: any authenticated active account; sellerToken is selected for the sample.

Query parameters: None used by this handler.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Current user",
  "data": {
    "user": {
      "id": "{{sellerId}}",
      "name": "QA Seller",
      "email": "qa.seller@example.com",
      "phone": "+919000000102",
      "role": "SELLER",
      "active": true,
      "managerId": "{{managerId}}",
      "permissions": [],
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva"
    }
  }
}
```

### 03 Accounts

#### 07 Create Manager

**POST {{baseUrl}}/admin/managers**

Authorization: Bearer {{adminToken}}. Expected HTTP **201**.

Query parameters: None used by this handler.

Required body fields: name, phone, password.

Request body:

```json
{
  "name": "QA Manager",
  "phone": "+919000000101",
  "email": "qa.manager@example.com",
  "password": "{{managerPassword}}",
  "state": "Maharashtra",
  "district": "Thane",
  "village": "Diva",
  "permissions": [
    "SELLER_READ",
    "SELLER_CREATE"
  ]
}
```

Optional: email, state, district, village; Manager creation also accepts permissions (default []). Name/location 1–100 characters; phone international format; password 12+ characters and at most 72 UTF-8 bytes. District requires state; village requires district. Seller needs an active Manager and matching territory; omitted territory inherits Manager values. Creates a zero-balance seller stock location.

Save from response: `data.user.id` → `{{managerId}}`.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Manager created",
  "data": {
    "user": {
      "id": "{{managerId}}",
      "name": "QA Manager",
      "email": "qa.manager@example.com",
      "phone": "+919000000101",
      "role": "MANAGER",
      "active": true,
      "managerId": null,
      "permissions": [
        "SELLER_READ",
        "SELLER_CREATE"
      ],
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva"
    }
  }
}
```

#### 08 List managers

**GET {{baseUrl}}/admin/managers**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: Optional: page (1–100000, default 1), pageSize (1–100, default 20), search (max 100), active (true/false), managerId (UUID), state, district, village (max 100 each). Location filters are case-insensitive exact matches. Do not send sort.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Managers retrieved",
  "data": {
    "items": [
      {
        "id": "{{managerId}}",
        "name": "QA Manager",
        "email": "qa.manager@example.com",
        "phone": "+919000000101",
        "role": "MANAGER",
        "active": true,
        "managerId": null,
        "permissions": [
          "SELLER_READ",
          "SELLER_CREATE"
        ],
        "state": "Maharashtra",
        "district": "Thane",
        "village": "Diva"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### 09 Get Manager

**GET {{baseUrl}}/admin/managers/{{managerId}}**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Manager retrieved",
  "data": {
    "user": {
      "id": "{{managerId}}",
      "name": "QA Manager",
      "email": "qa.manager@example.com",
      "phone": "+919000000101",
      "role": "MANAGER",
      "active": true,
      "managerId": null,
      "permissions": [
        "SELLER_READ",
        "SELLER_CREATE"
      ],
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva"
    }
  }
}
```

#### 10 Update Manager

**PATCH {{baseUrl}}/admin/managers/{{managerId}}**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Required body fields: At least one permitted field.

Request body:

```json
{
  "name": "QA Manager Updated"
}
```

Allowed: name, phone, email, state, district, village, active (boolean). Do not send role, password, managerId or permissions here. Null is not accepted. Changing active revokes old tokens; test deactivation after all sales tests.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Manager updated",
  "data": {
    "user": {
      "id": "{{managerId}}",
      "name": "QA Manager Updated",
      "email": "qa.manager@example.com",
      "phone": "+919000000101",
      "role": "MANAGER",
      "active": true,
      "managerId": null,
      "permissions": [
        "SELLER_READ",
        "SELLER_CREATE"
      ],
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva"
    }
  }
}
```

#### 11 Create Seller

**POST {{baseUrl}}/admin/sellers**

Authorization: Bearer {{adminToken}}. Expected HTTP **201**.

Query parameters: None used by this handler.

Required body fields: name, phone, password, managerId.

Request body:

```json
{
  "name": "QA Seller",
  "phone": "+919000000102",
  "email": "qa.seller@example.com",
  "password": "{{sellerPassword}}",
  "state": "Maharashtra",
  "district": "Thane",
  "village": "Diva",
  "managerId": "{{managerId}}"
}
```

Optional: email, state, district, village; Manager creation also accepts permissions (default []). Name/location 1–100 characters; phone international format; password 12+ characters and at most 72 UTF-8 bytes. District requires state; village requires district. Seller needs an active Manager and matching territory; omitted territory inherits Manager values. Creates a zero-balance seller stock location.

Save from response: `data.user.id` → `{{sellerId}}`.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Seller created",
  "data": {
    "user": {
      "id": "{{sellerId}}",
      "name": "QA Seller",
      "email": "qa.seller@example.com",
      "phone": "+919000000102",
      "role": "SELLER",
      "active": true,
      "managerId": "{{managerId}}",
      "permissions": [],
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva"
    }
  }
}
```

#### 12 List sellers

**GET {{baseUrl}}/admin/sellers**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: Optional: page (1–100000, default 1), pageSize (1–100, default 20), search (max 100), active (true/false), managerId (UUID), state, district, village (max 100 each). Location filters are case-insensitive exact matches. Do not send sort.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Sellers retrieved",
  "data": {
    "items": [
      {
        "id": "{{sellerId}}",
        "name": "QA Seller",
        "email": "qa.seller@example.com",
        "phone": "+919000000102",
        "role": "SELLER",
        "active": true,
        "managerId": "{{managerId}}",
        "permissions": [],
        "state": "Maharashtra",
        "district": "Thane",
        "village": "Diva"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### 13 Get Seller

**GET {{baseUrl}}/admin/sellers/{{sellerId}}**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Seller retrieved",
  "data": {
    "user": {
      "id": "{{sellerId}}",
      "name": "QA Seller",
      "email": "qa.seller@example.com",
      "phone": "+919000000102",
      "role": "SELLER",
      "active": true,
      "managerId": "{{managerId}}",
      "permissions": [],
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva"
    }
  }
}
```

#### 14 Update Seller

**PATCH {{baseUrl}}/admin/sellers/{{sellerId}}**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Required body fields: At least one permitted field.

Request body:

```json
{
  "name": "QA Seller Updated"
}
```

Allowed: name, phone, email, state, district, village, active (boolean). Do not send role, password, managerId or permissions here. Null is not accepted. Changing active revokes old tokens; test deactivation after all sales tests.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Seller updated",
  "data": {
    "user": {
      "id": "{{sellerId}}",
      "name": "QA Seller Updated",
      "email": "qa.seller@example.com",
      "phone": "+919000000102",
      "role": "SELLER",
      "active": true,
      "managerId": "{{managerId}}",
      "permissions": [],
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva"
    }
  }
}
```

#### 15 List permission names

**GET {{baseUrl}}/admin/permissions**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "data": {
    "permissions": [
      "manage_sellers",
      "manage_managers",
      "onboard_customers",
      "view_customers",
      "view_inventory",
      "transfer_inventory",
      "approve_sales",
      "view_reports",
      "manage_permissions",
      "SELLER_READ",
      "SELLER_CREATE",
      "CUSTOMER_READ",
      "CUSTOMER_CREATE",
      "SALES_READ",
      "INVENTORY_READ"
    ]
  }
}
```

#### 16 Replace Manager permissions

**PATCH {{baseUrl}}/admin/managers/{{managerId}}/permissions**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Required body fields: permissions (array).

Request body:

```json
{
  "permissions": [
    "SELLER_READ",
    "SELLER_CREATE"
  ]
}
```

Replaces the entire list; [] removes all permissions. Values must come from GET /admin/permissions. At most 15 entries before deduplication. These two URLs are aliases.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Manager permissions updated successfully",
  "data": {
    "manager": {
      "id": "{{managerId}}",
      "name": "QA Manager",
      "email": "qa.manager@example.com",
      "phone": "+919000000101",
      "role": "MANAGER",
      "permissions": [
        "SELLER_READ",
        "SELLER_CREATE"
      ],
      "updatedAt": "<ISO timestamp>"
    }
  }
}
```

#### 17 Replace Manager permissions

**PATCH {{baseUrl}}/admin/permissions/managers/{{managerId}}/permissions**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Required body fields: permissions (array).

Request body:

```json
{
  "permissions": [
    "SELLER_READ",
    "SELLER_CREATE"
  ]
}
```

Replaces the entire list; [] removes all permissions. Values must come from GET /admin/permissions. At most 15 entries before deduplication. These two URLs are aliases.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Manager permissions updated successfully",
  "data": {
    "manager": {
      "id": "{{managerId}}",
      "name": "QA Manager",
      "email": "qa.manager@example.com",
      "phone": "+919000000101",
      "role": "MANAGER",
      "permissions": [
        "SELLER_READ",
        "SELLER_CREATE"
      ],
      "updatedAt": "<ISO timestamp>"
    }
  }
}
```

### 04 Manager sellers

#### 18 List assigned sellers

**GET {{baseUrl}}/manager/sellers**

Authorization: Bearer {{managerToken}}. Expected HTTP **200**.

Query parameters: Optional: page (1–100000, default 1), pageSize (1–100, default 20), search (max 100), active (true/false), managerId (UUID), state, district, village (max 100 each). Location filters are case-insensitive exact matches. Do not send sort.

Request body: **none**.

Requires SELLER_READ. Assigned Manager territory applies.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Assigned Sellers retrieved",
  "data": {
    "items": [
      {
        "id": "{{sellerId}}",
        "name": "QA Seller",
        "email": "qa.seller@example.com",
        "phone": "+919000000102",
        "role": "SELLER",
        "active": true,
        "managerId": "{{managerId}}",
        "permissions": [],
        "state": "Maharashtra",
        "district": "Thane",
        "village": "Diva"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### 19 Get assigned seller

**GET {{baseUrl}}/manager/sellers/{{sellerId}}**

Authorization: Bearer {{managerToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Requires SELLER_READ. Out-of-scope seller returns 404.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Assigned Seller retrieved",
  "data": {
    "user": {
      "id": "{{sellerId}}",
      "name": "QA Seller",
      "email": "qa.seller@example.com",
      "phone": "+919000000102",
      "role": "SELLER",
      "active": true,
      "managerId": "{{managerId}}",
      "permissions": [],
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva"
    }
  }
}
```

#### 20 Create seller as Manager

**POST {{baseUrl}}/manager/sellers**

Authorization: Bearer {{managerToken}}. Expected HTTP **201**.

Query parameters: None used by this handler.

Required body fields: name, phone, password.

Request body:

```json
{
  "name": "QA Second Seller",
  "phone": "+919000000104",
  "email": "qa.seller2@example.com",
  "password": "{{sellerPassword}}",
  "state": "Maharashtra",
  "district": "Thane",
  "village": "Diva"
}
```

Requires SELLER_CREATE. Optional email and territory. Do not send managerId, role or permissions. Manager comes from token. Keep this second seller separate from sellerId used in the main flow.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Seller created",
  "data": {
    "user": {
      "id": "<new seller UUID>",
      "name": "QA Second Seller",
      "email": "qa.seller2@example.com",
      "phone": "+919000000104",
      "role": "SELLER",
      "active": true,
      "managerId": "{{managerId}}",
      "permissions": [],
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva"
    }
  }
}
```

### 05 Categories

#### 21 Create category

**POST {{baseUrl}}/admin/categories**

Authorization: Bearer {{adminToken}}. Expected HTTP **201**.

Query parameters: None used by this handler.

Required body fields: name (trimmed string, 1–50 characters).

Request body:

```json
{
  "name": "QA Retail"
}
```

Both category prefixes reach the same records. Use a different unique name when testing the alias; an existing name returns 409. /categories currently allows any authenticated role for both reads and writes.

Save from response: `data.category.id` → `{{categoryId}}`.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Category created",
  "data": {
    "category": {
      "id": "{{categoryId}}",
      "name": "QA Retail",
      "active": true
    }
  }
}
```

#### 22 List categories

**GET {{baseUrl}}/admin/categories**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: Optional: search (max 50), active (true/false). No pagination.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Categories retrieved",
  "data": {
    "items": [
      {
        "id": "{{categoryId}}",
        "name": "QA Retail",
        "active": true
      }
    ]
  }
}
```

#### 23 Get category

**GET {{baseUrl}}/admin/categories/{{categoryId}}**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Category retrieved",
  "data": {
    "category": {
      "id": "{{categoryId}}",
      "name": "QA Retail",
      "active": true
    }
  }
}
```

#### 24 Update category

**PATCH {{baseUrl}}/admin/categories/{{categoryId}}**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Required body fields: At least one of name (1–50 characters), active (boolean).

Request body:

```json
{
  "active": true
}
```

Use active:false only after dependent customer creation tests.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Category updated",
  "data": {
    "category": {
      "id": "{{categoryId}}",
      "name": "QA Retail",
      "active": true
    }
  }
}
```

#### 25 Create category

**POST {{baseUrl}}/categories**

Authorization: Bearer {{adminToken}}. Expected HTTP **201**.

Access: any authenticated active account; adminToken is selected for the sample.

Query parameters: None used by this handler.

Required body fields: name (trimmed string, 1–50 characters).

Request body:

```json
{
  "name": "QA Retail"
}
```

Both category prefixes reach the same records. Use a different unique name when testing the alias; an existing name returns 409. /categories currently allows any authenticated role for both reads and writes.

Save from response: `data.category.id` → `{{categoryId}}`.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Category created",
  "data": {
    "category": {
      "id": "{{categoryId}}",
      "name": "QA Retail",
      "active": true
    }
  }
}
```

#### 26 List categories

**GET {{baseUrl}}/categories**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Access: any authenticated active account; adminToken is selected for the sample.

Query parameters: Optional: search (max 50), active (true/false). No pagination.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Categories retrieved",
  "data": {
    "items": [
      {
        "id": "{{categoryId}}",
        "name": "QA Retail",
        "active": true
      }
    ]
  }
}
```

#### 27 Get category

**GET {{baseUrl}}/categories/{{categoryId}}**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Access: any authenticated active account; adminToken is selected for the sample.

Query parameters: None used by this handler.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Category retrieved",
  "data": {
    "category": {
      "id": "{{categoryId}}",
      "name": "QA Retail",
      "active": true
    }
  }
}
```

#### 28 Update category

**PATCH {{baseUrl}}/categories/{{categoryId}}**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Access: any authenticated active account; adminToken is selected for the sample.

Query parameters: None used by this handler.

Required body fields: At least one of name (1–50 characters), active (boolean).

Request body:

```json
{
  "active": true
}
```

Use active:false only after dependent customer creation tests.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Category updated",
  "data": {
    "category": {
      "id": "{{categoryId}}",
      "name": "QA Retail",
      "active": true
    }
  }
}
```

### 06 Customers

#### 29 Create customer as seller

**POST {{baseUrl}}/seller/customers**

Authorization: Bearer {{sellerToken}}. Expected HTTP **201**.

Query parameters: None used by this handler.

Required body fields: shopName, contactName, phone, categoryId, state, district, village.

Request body:

```json
{
  "shopName": "QA General Store",
  "contactName": "QA Customer",
  "phone": "+919000000103",
  "categoryId": "{{categoryId}}",
  "state": "Maharashtra",
  "district": "Thane",
  "village": "Diva"
}
```

Optional: email; photoPath, photoUrl or imageUrl (max 500; photoPath wins); latitude (-90 to 90); longitude (-180 to 180). Names and location strings 1–100 characters. Category must be active. Seller token sets ownership automatically; Manager can assign only an active seller under that Manager. No multipart upload is implemented.

Save from response: `data.customer.id` → `{{customerId}}`.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Customer created",
  "data": {
    "customer": {
      "id": "{{customerId}}",
      "shopName": "QA General Store",
      "contactName": "QA Customer",
      "phone": "+919000000103",
      "categoryId": "{{categoryId}}",
      "sellerId": "{{sellerId}}",
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva",
      "active": true
    }
  }
}
```

#### 30 List customers as seller

**GET {{baseUrl}}/seller/customers**

Authorization: Bearer {{sellerToken}}. Expected HTTP **200**.

Query parameters: Optional: page, pageSize, search (max 100), categoryId, sellerId (UUIDs), active (true/false), state, district, village (1–100 characters). Seller requests always use the logged-in seller; Manager results are assignment and territory scoped.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Customers retrieved",
  "data": {
    "items": [
      {
        "id": "{{customerId}}",
        "shopName": "QA General Store",
        "contactName": "QA Customer",
        "phone": "+919000000103",
        "categoryId": "{{categoryId}}",
        "sellerId": "{{sellerId}}",
        "state": "Maharashtra",
        "district": "Thane",
        "village": "Diva",
        "active": true
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### 31 Get customer as seller

**GET {{baseUrl}}/seller/customers/{{customerId}}**

Authorization: Bearer {{sellerToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Customer retrieved",
  "data": {
    "customer": {
      "id": "{{customerId}}",
      "shopName": "QA General Store",
      "contactName": "QA Customer",
      "phone": "+919000000103",
      "categoryId": "{{categoryId}}",
      "sellerId": "{{sellerId}}",
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva",
      "active": true
    }
  }
}
```

#### 32 Update customer as seller

**PATCH {{baseUrl}}/seller/customers/{{customerId}}**

Authorization: Bearer {{sellerToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Required body fields: At least one permitted field.

Request body:

```json
{
  "contactName": "QA Customer Updated"
}
```

All create fields are optional on update; active (boolean) is also accepted. Seller cannot reassign ownership. Manager can reassign only to their own active seller. Do not deactivate the main customer until sales tests are complete.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Customer updated",
  "data": {
    "customer": {
      "id": "{{customerId}}",
      "shopName": "QA General Store",
      "contactName": "QA Customer Updated",
      "phone": "+919000000103",
      "categoryId": "{{categoryId}}",
      "sellerId": "{{sellerId}}",
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva",
      "active": true
    }
  }
}
```

#### 33 Create customer as manager

**POST {{baseUrl}}/manager/customers**

Authorization: Bearer {{managerToken}}. Expected HTTP **201**.

Query parameters: None used by this handler.

Required body fields: shopName, contactName, phone, categoryId, state, district, village, sellerId.

Request body:

```json
{
  "shopName": "QA General Store",
  "contactName": "QA Customer",
  "phone": "+919000000103",
  "categoryId": "{{categoryId}}",
  "state": "Maharashtra",
  "district": "Thane",
  "village": "Diva",
  "sellerId": "{{sellerId}}"
}
```

Optional: email; photoPath, photoUrl or imageUrl (max 500; photoPath wins); latitude (-90 to 90); longitude (-180 to 180). Names and location strings 1–100 characters. Category must be active. Seller token sets ownership automatically; Manager can assign only an active seller under that Manager. No multipart upload is implemented.

Save from response: `data.customer.id` → `{{customerId}}`.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Customer created",
  "data": {
    "customer": {
      "id": "{{customerId}}",
      "shopName": "QA General Store",
      "contactName": "QA Customer",
      "phone": "+919000000103",
      "categoryId": "{{categoryId}}",
      "sellerId": "{{sellerId}}",
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva",
      "active": true
    }
  }
}
```

#### 34 List customers as manager

**GET {{baseUrl}}/manager/customers**

Authorization: Bearer {{managerToken}}. Expected HTTP **200**.

Query parameters: Optional: page, pageSize, search (max 100), categoryId, sellerId (UUIDs), active (true/false), state, district, village (1–100 characters). Seller requests always use the logged-in seller; Manager results are assignment and territory scoped.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Customers retrieved",
  "data": {
    "items": [
      {
        "id": "{{customerId}}",
        "shopName": "QA General Store",
        "contactName": "QA Customer",
        "phone": "+919000000103",
        "categoryId": "{{categoryId}}",
        "sellerId": "{{sellerId}}",
        "state": "Maharashtra",
        "district": "Thane",
        "village": "Diva",
        "active": true
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### 35 Get customer as manager

**GET {{baseUrl}}/manager/customers/{{customerId}}**

Authorization: Bearer {{managerToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Customer retrieved",
  "data": {
    "customer": {
      "id": "{{customerId}}",
      "shopName": "QA General Store",
      "contactName": "QA Customer",
      "phone": "+919000000103",
      "categoryId": "{{categoryId}}",
      "sellerId": "{{sellerId}}",
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva",
      "active": true
    }
  }
}
```

#### 36 Update customer as manager

**PATCH {{baseUrl}}/manager/customers/{{customerId}}**

Authorization: Bearer {{managerToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Required body fields: At least one permitted field.

Request body:

```json
{
  "contactName": "QA Customer Updated"
}
```

All create fields are optional on update; active (boolean) is also accepted. Seller cannot reassign ownership. Manager can reassign only to their own active seller. Do not deactivate the main customer until sales tests are complete.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Customer updated",
  "data": {
    "customer": {
      "id": "{{customerId}}",
      "shopName": "QA General Store",
      "contactName": "QA Customer Updated",
      "phone": "+919000000103",
      "categoryId": "{{categoryId}}",
      "sellerId": "{{sellerId}}",
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva",
      "active": true
    }
  }
}
```

#### 37 Create customer as admin

**POST {{baseUrl}}/admin/customers**

Authorization: Bearer {{adminToken}}. Expected HTTP **201**.

Query parameters: None used by this handler.

Required body fields: shopName, contactName, phone, categoryId, state, district, village, sellerId.

Request body:

```json
{
  "shopName": "QA General Store",
  "contactName": "QA Customer",
  "phone": "+919000000103",
  "categoryId": "{{categoryId}}",
  "state": "Maharashtra",
  "district": "Thane",
  "village": "Diva",
  "sellerId": "{{sellerId}}"
}
```

Optional: email; photoPath, photoUrl or imageUrl (max 500; photoPath wins); latitude (-90 to 90); longitude (-180 to 180). Names and location strings 1–100 characters. Category must be active. Seller token sets ownership automatically; Manager can assign only an active seller under that Manager. No multipart upload is implemented.

Save from response: `data.customer.id` → `{{customerId}}`.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Customer created",
  "data": {
    "customer": {
      "id": "{{customerId}}",
      "shopName": "QA General Store",
      "contactName": "QA Customer",
      "phone": "+919000000103",
      "categoryId": "{{categoryId}}",
      "sellerId": "{{sellerId}}",
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva",
      "active": true
    }
  }
}
```

#### 38 List customers as admin

**GET {{baseUrl}}/admin/customers**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: Optional: page, pageSize, search (max 100), categoryId, sellerId (UUIDs), active (true/false), state, district, village (1–100 characters). Seller requests always use the logged-in seller; Manager results are assignment and territory scoped.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Customers retrieved",
  "data": {
    "items": [
      {
        "id": "{{customerId}}",
        "shopName": "QA General Store",
        "contactName": "QA Customer",
        "phone": "+919000000103",
        "categoryId": "{{categoryId}}",
        "sellerId": "{{sellerId}}",
        "state": "Maharashtra",
        "district": "Thane",
        "village": "Diva",
        "active": true
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### 39 Get customer as admin

**GET {{baseUrl}}/admin/customers/{{customerId}}**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Customer retrieved",
  "data": {
    "customer": {
      "id": "{{customerId}}",
      "shopName": "QA General Store",
      "contactName": "QA Customer",
      "phone": "+919000000103",
      "categoryId": "{{categoryId}}",
      "sellerId": "{{sellerId}}",
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva",
      "active": true
    }
  }
}
```

#### 40 Update customer as admin

**PATCH {{baseUrl}}/admin/customers/{{customerId}}**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Required body fields: At least one permitted field.

Request body:

```json
{
  "contactName": "QA Customer Updated"
}
```

All create fields are optional on update; active (boolean) is also accepted. Seller cannot reassign ownership. Manager can reassign only to their own active seller. Do not deactivate the main customer until sales tests are complete.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Customer updated",
  "data": {
    "customer": {
      "id": "{{customerId}}",
      "shopName": "QA General Store",
      "contactName": "QA Customer Updated",
      "phone": "+919000000103",
      "categoryId": "{{categoryId}}",
      "sellerId": "{{sellerId}}",
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva",
      "active": true
    }
  }
}
```

### 07 Stock

#### 41 Get stock summary

**GET {{baseUrl}}/admin/inventory**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Example is before stock receipts. Save the HQ location id and the SELLER location id whose sellerId matches your test seller. A seller user ID is not a stock-location ID.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Inventory summary retrieved",
  "data": {
    "totalStock": 0,
    "hqStock": 0,
    "warehouseStock": 0,
    "sellerStock": 0,
    "locations": [
      {
        "id": "{{hqLocationId}}",
        "type": "HQ",
        "name": "Headquarters (HQ)",
        "sellerId": null,
        "balance": 0
      },
      {
        "id": "{{sellerLocationId}}",
        "type": "SELLER",
        "name": "QA Seller",
        "sellerId": "{{sellerId}}",
        "balance": 0
      }
    ]
  }
}
```

#### 42 Create warehouse

**POST {{baseUrl}}/admin/inventory/warehouses**

Authorization: Bearer {{adminToken}}. Expected HTTP **201**.

Query parameters: None used by this handler.

Required body fields: name (1–100 characters).

Request body:

```json
{
  "name": "QA Warehouse"
}
```

Duplicate warehouse name (case-insensitive) returns 409.

Save from response: `data.warehouse.id` → `{{warehouseId}}`.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Warehouse created",
  "data": {
    "warehouse": {
      "id": "{{warehouseId}}",
      "type": "WAREHOUSE",
      "name": "QA Warehouse",
      "sellerId": null,
      "balance": 0
    }
  }
}
```

#### 43 List warehouses

**GET {{baseUrl}}/admin/inventory/warehouses**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Warehouses retrieved",
  "data": {
    "items": [
      {
        "id": "{{warehouseId}}",
        "type": "WAREHOUSE",
        "name": "QA Warehouse",
        "sellerId": null,
        "balance": 0
      }
    ]
  }
}
```

#### 44 Receive 100 packets at HQ

**POST {{baseUrl}}/admin/inventory/receipts**

Authorization: Bearer {{adminToken}}. Expected HTTP **201**.

Query parameters: None used by this handler.

Required body fields: quantity (positive integer).

Request body:

```json
{
  "quantity": 100
}
```

Adds to current HQ balance; example assumes starting balance 0. Save data.hq.id as hqLocationId. Repeating this request adds another receipt.

Save from response: `data.hq.id` → `{{hqLocationId}}`.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Stock receipt added to HQ",
  "data": {
    "hq": {
      "id": "{{hqLocationId}}",
      "type": "HQ",
      "name": "Headquarters (HQ)",
      "sellerId": null,
      "balance": 100
    },
    "movement": {
      "id": "<movement UUID>",
      "type": "RECEIPT",
      "quantity": 100,
      "destinationId": "{{hqLocationId}}",
      "sourceId": null
    }
  }
}
```

#### 45 Transfer 50 packets to seller

**POST {{baseUrl}}/admin/inventory/transfers**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Required body fields: sourceId, destinationId (stock-location UUIDs), quantity (positive integer).

Request body:

```json
{
  "sourceId": "{{hqLocationId}}",
  "destinationId": "{{sellerLocationId}}",
  "quantity": 50
}
```

Example assumes HQ 100 and seller 0. Source and destination must differ. Any existing location types are accepted. To test warehouses separately use HQ to warehouse, then warehouse to seller, with sufficient balances.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Stock transfer completed",
  "data": {
    "source": {
      "id": "{{hqLocationId}}",
      "type": "HQ",
      "name": "Headquarters (HQ)",
      "sellerId": null,
      "balance": 50
    },
    "destination": {
      "id": "{{sellerLocationId}}",
      "type": "SELLER",
      "name": "QA Seller",
      "sellerId": "{{sellerId}}",
      "balance": 50
    },
    "movement": {
      "id": "<movement UUID>",
      "type": "TRANSFER",
      "quantity": 50,
      "sourceId": "{{hqLocationId}}",
      "destinationId": "{{sellerLocationId}}"
    }
  }
}
```

#### 46 List all stock movements

**GET {{baseUrl}}/admin/inventory/transactions**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: Optional: page, pageSize, locationId (stock-location UUID), type (RECEIPT/TRANSFER/SALE). Seller requests ignore locationId and use their own stock location.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Stock transactions retrieved",
  "data": {
    "items": [
      {
        "type": "TRANSFER",
        "quantity": 50,
        "sourceId": "{{hqLocationId}}",
        "destinationId": "{{sellerLocationId}}"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### 47 Get own stock

**GET {{baseUrl}}/seller/inventory**

Authorization: Bearer {{sellerToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Call before transfer to get locationId (initial counters 0). Example shown after the 50-packet transfer.

Save from response: `data.locationId` → `{{sellerLocationId}}`.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Inventory retrieved",
  "data": {
    "locationId": "{{sellerLocationId}}",
    "name": "QA Seller",
    "assigned": 50,
    "sold": 0,
    "remaining": 50
  }
}
```

#### 48 List own movements

**GET {{baseUrl}}/seller/inventory/transactions**

Authorization: Bearer {{sellerToken}}. Expected HTTP **200**.

Query parameters: Optional: page, pageSize, locationId (stock-location UUID), type (RECEIPT/TRANSFER/SALE). Seller requests ignore locationId and use their own stock location.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Transactions retrieved",
  "data": {
    "items": [
      {
        "type": "TRANSFER",
        "quantity": 50,
        "destinationId": "{{sellerLocationId}}"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### 49 Get assigned sellers stock

**GET {{baseUrl}}/manager/inventory**

Authorization: Bearer {{managerToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Assignment plus Manager state/district scope. No query filters used. Counts include any additional sellers you created.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Assigned inventory summary retrieved",
  "data": {
    "summary": {
      "totalSellers": 1,
      "totalAssigned": 50,
      "totalSold": 0,
      "totalRemaining": 50
    },
    "sellers": [
      {
        "seller": {
          "id": "{{sellerId}}",
          "name": "QA Seller",
          "phone": "+919000000102",
          "state": "Maharashtra",
          "district": "Thane",
          "village": "Diva"
        },
        "assigned": 50,
        "sold": 0,
        "remaining": 50
      }
    ]
  }
}
```

### 08 Settings

#### 50 Read business settings

**GET {{baseUrl}}/admin/incentives/settings**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Initial incentiveRatePaise may be null. Default minimum price is 2500 paise.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Business settings retrieved",
  "data": {
    "settings": {
      "id": 1,
      "minimumPricePaise": 2500,
      "incentiveRatePaise": 200
    }
  }
}
```

#### 51 Set price and incentive

**PATCH {{baseUrl}}/admin/incentives/settings**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Required body fields: At least one of minimumPricePaise (positive integer), incentiveRatePaise (nonnegative integer or null).

Request body:

```json
{
  "minimumPricePaise": 2500,
  "incentiveRatePaise": 200
}
```

Sets minimum unit price to INR 25 and incentive to INR 2 per packet. Null disables the configured incentive rate for future confirmations. Existing confirmed sales retain their snapshots.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Business settings updated",
  "data": {
    "settings": {
      "id": 1,
      "minimumPricePaise": 2500,
      "incentiveRatePaise": 200
    }
  }
}
```

### 09 Sales

#### 52 Create confirmed unpaid sale

**POST {{baseUrl}}/seller/sales**

Authorization: Bearer {{sellerToken}}. Expected HTTP **201**.

Query parameters: None used by this handler.

Required body fields: customerId (UUID), quantity (positive integer), unitPricePaise (positive integer), paymentMode (CASH/BANK/PENDING).

Request body:

```json
{
  "customerId": "{{customerId}}",
  "quantity": 10,
  "unitPricePaise": 2500,
  "paymentMode": "PENDING"
}
```

Optional requestKey (trimmed string, max 100). Customer must be active and assigned to seller. With minimum 2500 this confirms immediately, deducts 10 packets, creates invoice and snapshots incentive 2000. PENDING means unpaid, not awaiting approval. CASH/BANK additionally creates a full payment record. PDF creation failure can leave pdfPath null without failing sale.

Save from response: `data.sale.id` → `{{saleId}}`; `data.sale.invoice.id` → `{{invoiceId}}`.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Sale confirmed successfully",
  "data": {
    "sale": {
      "id": "{{saleId}}",
      "sellerId": "{{sellerId}}",
      "customerId": "{{customerId}}",
      "quantity": 10,
      "unitPricePaise": 2500,
      "totalPaise": 25000,
      "paymentMode": "PENDING",
      "status": "CONFIRMED",
      "incentiveRatePaise": 200,
      "incentiveAmountPaise": 2000,
      "invoice": {
        "id": "{{invoiceId}}",
        "saleId": "{{saleId}}",
        "number": "<generated invoice number>",
        "pdfPath": "<generated path or null>",
        "snapshot": {
          "quantity": 10,
          "unitPricePaise": 2500,
          "totalPaise": 25000,
          "paymentMode": "PENDING"
        }
      }
    }
  }
}
```

#### 53 Create low-price sale for approval

**POST {{baseUrl}}/seller/sales**

Authorization: Bearer {{sellerToken}}. Expected HTTP **201**.

Query parameters: None used by this handler.

Required body fields: customerId, quantity, unitPricePaise, paymentMode.

Request body:

```json
{
  "customerId": "{{customerId}}",
  "quantity": 5,
  "unitPricePaise": 2000,
  "paymentMode": "PENDING"
}
```

Minimum must still be 2500. No stock is deducted, no invoice is created and no incentive is calculated until approval. Save a separate pendingSaleId; do not overwrite saleId.

Save from response: `data.sale.id` → `{{pendingSaleId}}`.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Sale recorded and sent for low-price approval",
  "data": {
    "sale": {
      "id": "{{pendingSaleId}}",
      "sellerId": "{{sellerId}}",
      "customerId": "{{customerId}}",
      "quantity": 5,
      "unitPricePaise": 2000,
      "totalPaise": 10000,
      "paymentMode": "PENDING",
      "status": "PENDING_APPROVAL",
      "incentiveRatePaise": null,
      "incentiveAmountPaise": null
    }
  }
}
```

#### 54 List sales as seller

**GET {{baseUrl}}/seller/sales**

Authorization: Bearer {{sellerToken}}. Expected HTTP **200**.

Query parameters: Optional: page, pageSize, status (PENDING_APPROVAL/CONFIRMED/REJECTED), paymentMode (CASH/BANK/PENDING), period (all/this_month/last_month), customerId, sellerId (UUIDs), search (max 100). Month boundaries use UTC. Seller requests ignore sellerId and use the authenticated seller.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Sales history retrieved",
  "data": {
    "items": [
      {
        "id": "{{saleId}}",
        "sellerId": "{{sellerId}}",
        "customerId": "{{customerId}}",
        "quantity": 10,
        "unitPricePaise": 2500,
        "totalPaise": 25000,
        "paymentMode": "PENDING",
        "status": "CONFIRMED",
        "incentiveRatePaise": 200,
        "incentiveAmountPaise": 2000
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### 55 Get sale as seller

**GET {{baseUrl}}/seller/sales/{{saleId}}**

Authorization: Bearer {{sellerToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Seller sees own sales. Manager sees assigned sellers’ sales. Invoice may be null for pending/rejected sales; payments is empty before collecting a PENDING payment.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Sale details retrieved",
  "data": {
    "sale": {
      "id": "{{saleId}}",
      "sellerId": "{{sellerId}}",
      "customerId": "{{customerId}}",
      "quantity": 10,
      "unitPricePaise": 2500,
      "totalPaise": 25000,
      "paymentMode": "PENDING",
      "status": "CONFIRMED",
      "incentiveRatePaise": 200,
      "incentiveAmountPaise": 2000,
      "invoice": {
        "id": "{{invoiceId}}",
        "saleId": "{{saleId}}",
        "number": "<generated invoice number>",
        "pdfPath": "<generated path or null>",
        "snapshot": {
          "quantity": 10,
          "unitPricePaise": 2500,
          "totalPaise": 25000,
          "paymentMode": "PENDING"
        }
      },
      "payments": []
    }
  }
}
```

#### 56 List sales as manager

**GET {{baseUrl}}/manager/sales**

Authorization: Bearer {{managerToken}}. Expected HTTP **200**.

Query parameters: Optional: page, pageSize, status (PENDING_APPROVAL/CONFIRMED/REJECTED), paymentMode (CASH/BANK/PENDING), period (all/this_month/last_month), customerId, sellerId (UUIDs), search (max 100). Month boundaries use UTC. Seller requests ignore sellerId and use the authenticated seller.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Assigned sales records retrieved",
  "data": {
    "items": [
      {
        "id": "{{saleId}}",
        "sellerId": "{{sellerId}}",
        "customerId": "{{customerId}}",
        "quantity": 10,
        "unitPricePaise": 2500,
        "totalPaise": 25000,
        "paymentMode": "PENDING",
        "status": "CONFIRMED",
        "incentiveRatePaise": 200,
        "incentiveAmountPaise": 2000
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### 57 Get sale as manager

**GET {{baseUrl}}/manager/sales/{{saleId}}**

Authorization: Bearer {{managerToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Seller sees own sales. Manager sees assigned sellers’ sales. Invoice may be null for pending/rejected sales; payments is empty before collecting a PENDING payment.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Sale details retrieved",
  "data": {
    "sale": {
      "id": "{{saleId}}",
      "sellerId": "{{sellerId}}",
      "customerId": "{{customerId}}",
      "quantity": 10,
      "unitPricePaise": 2500,
      "totalPaise": 25000,
      "paymentMode": "PENDING",
      "status": "CONFIRMED",
      "incentiveRatePaise": 200,
      "incentiveAmountPaise": 2000,
      "invoice": {
        "id": "{{invoiceId}}",
        "saleId": "{{saleId}}",
        "number": "<generated invoice number>",
        "pdfPath": "<generated path or null>",
        "snapshot": {
          "quantity": 10,
          "unitPricePaise": 2500,
          "totalPaise": 25000,
          "paymentMode": "PENDING"
        }
      },
      "payments": []
    }
  }
}
```

#### 58 List sales as admin

**GET {{baseUrl}}/admin/sales**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: Optional: page, pageSize, status (PENDING_APPROVAL/CONFIRMED/REJECTED), paymentMode (CASH/BANK/PENDING), period (all/this_month/last_month), customerId, sellerId (UUIDs), search (max 100). Month boundaries use UTC. Seller requests ignore sellerId and use the authenticated seller.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Sales records retrieved",
  "data": {
    "items": [
      {
        "id": "{{saleId}}",
        "sellerId": "{{sellerId}}",
        "customerId": "{{customerId}}",
        "quantity": 10,
        "unitPricePaise": 2500,
        "totalPaise": 25000,
        "paymentMode": "PENDING",
        "status": "CONFIRMED",
        "incentiveRatePaise": 200,
        "incentiveAmountPaise": 2000
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### 59 Get sale as admin

**GET {{baseUrl}}/admin/sales/{{saleId}}**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Seller sees own sales. Manager sees assigned sellers’ sales. Invoice may be null for pending/rejected sales; payments is empty before collecting a PENDING payment.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Sale details retrieved",
  "data": {
    "sale": {
      "id": "{{saleId}}",
      "sellerId": "{{sellerId}}",
      "customerId": "{{customerId}}",
      "quantity": 10,
      "unitPricePaise": 2500,
      "totalPaise": 25000,
      "paymentMode": "PENDING",
      "status": "CONFIRMED",
      "incentiveRatePaise": 200,
      "incentiveAmountPaise": 2000,
      "invoice": {
        "id": "{{invoiceId}}",
        "saleId": "{{saleId}}",
        "number": "<generated invoice number>",
        "pdfPath": "<generated path or null>",
        "snapshot": {
          "quantity": 10,
          "unitPricePaise": 2500,
          "totalPaise": 25000,
          "paymentMode": "PENDING"
        }
      },
      "payments": []
    }
  }
}
```

#### 60 Collect full pending payment

**PATCH {{baseUrl}}/seller/sales/{{saleId}}/payment**

Authorization: Bearer {{sellerToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Required body fields: mode (CASH or BANK).

Request body:

```json
{
  "mode": "CASH"
}
```

No amount field; collects full sale.totalPaise. Does not deduct stock again. Repeat returns 409. Use the confirmed unpaid sale from the main flow; the implementation currently does not check sale status here.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Pending payment collected successfully",
  "data": {
    "sale": {
      "id": "{{saleId}}",
      "sellerId": "{{sellerId}}",
      "customerId": "{{customerId}}",
      "quantity": 10,
      "unitPricePaise": 2500,
      "totalPaise": 25000,
      "paymentMode": "CASH",
      "status": "CONFIRMED",
      "incentiveRatePaise": 200,
      "incentiveAmountPaise": 2000
    },
    "payment": {
      "id": "<payment UUID>",
      "saleId": "{{saleId}}",
      "collectorId": "{{sellerId}}",
      "mode": "CASH",
      "amountPaise": 25000
    }
  }
}
```

### 10 Approvals

#### 61 List pending approvals

**GET {{baseUrl}}/admin/approvals**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: Optional effective filters: page, pageSize, sellerId, customerId, search. The shared schema also accepts status, paymentMode and period, but this service ignores those three and always returns PENDING_APPROVAL.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Pending sale approval requests retrieved",
  "data": {
    "items": [
      {
        "id": "{{pendingSaleId}}",
        "sellerId": "{{sellerId}}",
        "customerId": "{{customerId}}",
        "quantity": 5,
        "unitPricePaise": 2000,
        "totalPaise": 10000,
        "paymentMode": "PENDING",
        "status": "PENDING_APPROVAL",
        "incentiveRatePaise": null,
        "incentiveAmountPaise": null
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### 62 Approve low-price sale

**POST {{baseUrl}}/admin/approvals/{{pendingSaleId}}/approve**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

No body. Requires sufficient seller stock. Deducts 5, creates invoice, snapshots the current incentive rate, records decision metadata. A second decision returns 409.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Sale approved and confirmed successfully",
  "data": {
    "sale": {
      "id": "{{pendingSaleId}}",
      "sellerId": "{{sellerId}}",
      "customerId": "{{customerId}}",
      "quantity": 5,
      "unitPricePaise": 2000,
      "totalPaise": 10000,
      "paymentMode": "PENDING",
      "status": "CONFIRMED",
      "incentiveRatePaise": 200,
      "incentiveAmountPaise": 1000,
      "invoice": {
        "id": "<new invoice UUID>",
        "saleId": "{{pendingSaleId}}"
      }
    }
  }
}
```

#### 63 Reject a separate low-price sale

**POST {{baseUrl}}/admin/approvals/{{rejectSaleId}}/reject**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Required body fields: None; reason is optional (1–500 characters when supplied).

Request body:

```json
{
  "reason": "Price below approved minimum"
}
```

First create another low-price sale and save its id as rejectSaleId. Body {} or no body uses the default reason. Stock stays unchanged; no invoice or incentive is created.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Sale rejected",
  "data": {
    "sale": {
      "id": "{{rejectSaleId}}",
      "sellerId": "{{sellerId}}",
      "customerId": "{{customerId}}",
      "quantity": 5,
      "unitPricePaise": 2000,
      "totalPaise": 10000,
      "paymentMode": "PENDING",
      "status": "REJECTED",
      "incentiveRatePaise": null,
      "incentiveAmountPaise": null,
      "rejectionReason": "Price below approved minimum"
    }
  }
}
```

### 11 Invoices

#### 64 List invoices

**GET {{baseUrl}}/admin/invoices**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: Optional: page, pageSize, search (max 100; invoice number or shop name).

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Invoices retrieved",
  "data": {
    "items": [
      {
        "id": "{{invoiceId}}",
        "saleId": "{{saleId}}",
        "number": "<generated invoice number>",
        "pdfPath": "<generated path or null>",
        "snapshot": {
          "quantity": 10,
          "unitPricePaise": 2500,
          "totalPaise": 25000,
          "paymentMode": "PENDING"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### 65 Get invoice

**GET {{baseUrl}}/admin/invoices/{{invoiceId}}**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Returns JSON, not PDF bytes. Full response includes sale/customer/seller/payments. snapshot retains the original invoice data. pdfPath can be null; no invoice download route is mounted.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Invoice details retrieved",
  "data": {
    "invoice": {
      "id": "{{invoiceId}}",
      "saleId": "{{saleId}}",
      "number": "<generated invoice number>",
      "pdfPath": "<generated path or null>",
      "snapshot": {
        "quantity": 10,
        "unitPricePaise": 2500,
        "totalPaise": 25000,
        "paymentMode": "PENDING"
      }
    }
  }
}
```

### 12 Incentives

#### 66 Get own incentives

**GET {{baseUrl}}/seller/incentives**

Authorization: Bearer {{sellerToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Example after confirmed sale of 10 plus approved sale of 5; rejected sales excluded. No pagination or query filters.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Incentives retrieved",
  "data": {
    "summary": {
      "totalPacketsSold": 15,
      "totalIncentivePaise": 3000,
      "totalIncentiveRupees": 30
    },
    "items": [
      {
        "saleId": "{{saleId}}",
        "date": "<ISO timestamp>",
        "customer": {
          "id": "{{customerId}}",
          "shopName": "QA General Store",
          "contactName": "QA Customer"
        },
        "quantity": 10,
        "incentiveRatePaise": 200,
        "incentiveAmountPaise": 2000
      },
      {
        "saleId": "{{pendingSaleId}}",
        "quantity": 5,
        "incentiveRatePaise": 200,
        "incentiveAmountPaise": 1000
      }
    ]
  }
}
```

#### 67 Get all seller incentives

**GET {{baseUrl}}/admin/incentives**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Incentive reports retrieved",
  "data": {
    "currentRatePaise": 200,
    "sellers": [
      {
        "seller": {
          "id": "{{sellerId}}",
          "name": "QA Seller",
          "phone": "+919000000102"
        },
        "totalConfirmedPackets": 15,
        "totalIncentivePaise": 3000,
        "totalIncentiveRupees": 30
      }
    ]
  }
}
```

### 13 Dashboards

#### 68 Get seller dashboard

**GET {{baseUrl}}/seller/dashboard**

Authorization: Bearer {{sellerToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

No query filters. recentSales contains up to five recent sales of any status.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Seller dashboard retrieved",
  "data": {
    "metrics": {
      "assignedPackets": 50,
      "soldPackets": 15,
      "remainingPackets": 35,
      "totalIncentivePaise": 3000,
      "totalIncentiveRupees": 30
    },
    "recentSales": [
      {
        "id": "{{saleId}}",
        "sellerId": "{{sellerId}}",
        "customerId": "{{customerId}}",
        "quantity": 10,
        "unitPricePaise": 2500,
        "totalPaise": 25000,
        "paymentMode": "PENDING",
        "status": "CONFIRMED",
        "incentiveRatePaise": 200,
        "incentiveAmountPaise": 2000
      }
    ]
  }
}
```

#### 69 Get Manager dashboard

**GET {{baseUrl}}/manager/dashboard**

Authorization: Bearer {{managerToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

No query filters. Example assumes one seller/customer in scope. Counts may increase if you exercise alternate create routes.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Manager dashboard retrieved",
  "data": {
    "metrics": {
      "totalSellers": 1,
      "totalCustomers": 1,
      "totalPacketsSold": 15,
      "totalEarningsPaise": 35000,
      "totalEarningsRupees": 350,
      "totalRemainingStock": 35
    }
  }
}
```

#### 70 Get Admin dashboard

**GET {{baseUrl}}/admin/dashboard**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: Optional: state, district, village (1–100 characters), managerId, sellerId, categoryId (UUIDs). Some metrics remain global; see implementation notes.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Super Admin dashboard retrieved",
  "data": {
    "metrics": {
      "totalPacketsSold": 15,
      "totalEarningsPaise": 35000,
      "totalEarningsRupees": 350,
      "totalStates": 1,
      "totalShops": 1,
      "totalManagers": 1,
      "totalSellers": 1,
      "totalInventory": 85,
      "hqStock": 50,
      "warehouseStock": 0,
      "sellerStock": 35,
      "totalIncentivePaise": 3000,
      "totalIncentiveRupees": 30
    },
    "appliedFilters": {}
  }
}
```

#### 71 Get dashboard filters

**GET {{baseUrl}}/admin/dashboard/filters**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Filter options retrieved",
  "data": {
    "categories": [
      {
        "id": "{{categoryId}}",
        "name": "QA Retail"
      }
    ],
    "states": [
      "Maharashtra"
    ],
    "districts": [
      "Thane"
    ]
  }
}
```

### 14 Profile

#### 72 Get seller profile

**GET {{baseUrl}}/seller/profile**

Authorization: Bearer {{sellerToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Request body: **none**.

Expected response (key fields):

```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "{{sellerId}}",
      "name": "QA Seller",
      "email": "qa.seller@example.com",
      "phone": "+919000000102",
      "role": "SELLER",
      "active": true,
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva",
      "createdAt": "<ISO timestamp>",
      "updatedAt": "<ISO timestamp>",
      "manager": {
        "id": "{{managerId}}",
        "name": "QA Manager",
        "phone": "+919000000101",
        "email": "qa.manager@example.com"
      },
      "stockLocation": {
        "id": "{{sellerLocationId}}",
        "name": "QA Seller",
        "balance": 35
      }
    }
  }
}
```

#### 73 Update own profile

**PATCH {{baseUrl}}/seller/profile**

Authorization: Bearer {{sellerToken}}. Expected HTTP **200**.

Query parameters: None used by this handler.

Required body fields: At least one of name (1–100 characters), phone (international), email (valid email).

Request body:

```json
{
  "name": "QA Seller Updated"
}
```

No role, active, managerId, location or password fields accepted. Duplicate phone/email returns 409. Updating phone/email changes the login identifier.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "profile": {
      "id": "{{sellerId}}",
      "name": "QA Seller Updated",
      "email": "qa.seller@example.com",
      "phone": "+919000000102",
      "role": "SELLER",
      "active": true,
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva",
      "createdAt": "<ISO timestamp>",
      "updatedAt": "<ISO timestamp>",
      "manager": {
        "id": "{{managerId}}",
        "name": "QA Manager",
        "phone": "+919000000101",
        "email": "qa.manager@example.com"
      },
      "stockLocation": {
        "id": "{{sellerLocationId}}",
        "name": "QA Seller",
        "balance": 35
      }
    }
  }
}
```

### 15 Reports

#### 74 Get sales report

**GET {{baseUrl}}/admin/reports/sales**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: Optional: from, to (YYYY-MM-DD or ISO datetime with timezone), state, district, village, managerId, sellerId, paymentMode, status, groupBy (date/seller/manager/state/district/village), format (json/csv/xlsx; default json). Default status is CONFIRMED. Date-only to includes the end of that UTC day.

Request body: **none**.

Optional groups array appears only with groupBy. JSON items capped at 500; CSV/XLSX at 5000. Summary aggregates all matches; groups only cover returned rows. Example totals assume the main flow. Export with ?format=csv or ?format=xlsx; expect HTTP 200 and attachment sales-report.csv/.xlsx, not JSON.

Expected response (key fields):

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalSalesCount": 2,
      "totalQuantitySold": 15,
      "grossSalesPaise": 35000,
      "grossSalesRupees": 350,
      "netSalesPaise": 35000,
      "netSalesRupees": 350,
      "averageOrderValueRupees": 175
    },
    "items": [
      {
        "id": "{{saleId}}",
        "sellerId": "{{sellerId}}",
        "customerId": "{{customerId}}",
        "quantity": 10,
        "unitPricePaise": 2500,
        "totalPaise": 25000,
        "paymentMode": "PENDING",
        "status": "CONFIRMED",
        "incentiveRatePaise": 200,
        "incentiveAmountPaise": 2000
      }
    ]
  }
}
```

#### 75 Get inventory report

**GET {{baseUrl}}/admin/reports/inventory**

Authorization: Bearer {{adminToken}}. Expected HTTP **200**.

Query parameters: Optional: from, to (YYYY-MM-DD or ISO datetime), locationId (UUID), type (HQ/WAREHOUSE/SELLER), format (json/csv/xlsx; default json). Dates filter movements, not historical stock balances; type filters locations only.

Request body: **none**.

JSON movements capped at 500. CSV/XLSX exports location rows (not movement rows), with attachment inventory-report.csv/.xlsx. Expect text/csv or application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.

Expected response (key fields):

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalStock": 85,
      "hqStock": 50,
      "warehouseStock": 0,
      "sellerStock": 35,
      "totalReceived": 100,
      "totalTransferred": 50,
      "totalSold": 15
    },
    "locations": [
      {
        "id": "{{hqLocationId}}",
        "type": "HQ",
        "name": "Headquarters (HQ)",
        "sellerId": null,
        "balance": 50
      },
      {
        "id": "{{sellerLocationId}}",
        "type": "SELLER",
        "name": "QA Seller",
        "sellerId": "{{sellerId}}",
        "balance": 35
      }
    ],
    "movements": [
      {
        "type": "SALE",
        "quantity": 5
      }
    ]
  }
}
```

### 16 Password tests last

#### 76 Change seller password

**PATCH {{baseUrl}}/auth/password**

Authorization: Bearer {{sellerToken}}. Expected HTTP **200**.

Access: any authenticated active account; sellerToken is selected for the sample.

Query parameters: None used by this handler.

Required body fields: currentPassword, newPassword.

Request body:

```json
{
  "currentPassword": "{{sellerPassword}}",
  "newPassword": "{{newPassword}}"
}
```

New password 12+ characters and at most 72 UTF-8 bytes. All prior seller tokens become invalid. Update sellerPassword and log in again after success.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Password changed. Log in again",
  "data": {}
}
```

#### 77 Request seller password reset

**POST {{baseUrl}}/auth/forgot-password**

Authorization: No Auth. Expected HTTP **200**.

Query parameters: None used by this handler.

Required body fields: login (1–254 characters).

Request body:

```json
{
  "login": "{{sellerLogin}}"
}
```

Public. Existing active account in non-production receives debugToken at the top level. Save as resetToken. Unknown/inactive account and production responses omit debugToken. Tokens expire after 20 minutes; requesting again invalidates previous tokens. No email/SMS delivery is implemented.

Save from response: `debugToken` → `{{resetToken}}`.

Expected response (key fields):

```json
{
  "success": true,
  "message": "If an account exists, a password reset request has been created.",
  "debugToken": "<non-production active-account token only>"
}
```

#### 78 Reset seller password

**POST {{baseUrl}}/auth/reset-password**

Authorization: No Auth. Expected HTTP **200**.

Query parameters: None used by this handler.

Required body fields: token (1–256 characters), newPassword (12+ characters, max 72 UTF-8 bytes).

Request body:

```json
{
  "token": "{{resetToken}}",
  "newPassword": "{{newPassword}}"
}
```

Public. Update sellerPassword and log in again. Token is one-use; old JWTs are revoked. Invalid/expired/used token returns 400.

Expected response (key fields):

```json
{
  "success": true,
  "message": "Password reset successfully. Please log in with your new password."
}
```

## Negative tests and expected errors

All handled errors use JSON with success:false and message; they do not include a success data object. Validation text can vary with the field/Zod version, so check the status and offending field rather than exact full text unless an exact message is listed below.

| Test | Expected HTTP | Expected message or behavior |
| --- | --- | --- |
| Protected call without Authorization | 401 | Authentication required |
| Invalid, expired, or revoked JWT | 401 | Invalid or expired token |
| Seller token on /admin/inventory | 403 | Access denied |
| Manager without SELLER_READ on /manager/sellers | 403 | Permission denied |
| POST /auth/login with {} | 400 | Provide login and password |
| Login with wrong password or inactive account | 401 | Invalid credentials or inactive account |
| Malformed JSON | 400 | Request body must be valid JSON |
| Invalid UUID in a validated path/body | 400 | Validation message naming id or field |
| Create/update with unexpected body key | 400 | Validation error (strict schema) |
| Empty PATCH body for accounts/category/customer/profile/settings | 400 | At least one field/setting required |
| New password shorter than 12 characters | 400 | Password validation error |
| Invalid international phone | 400 | Use an international phone number, e.g. +919876543210 |
| User creation with already-used email/phone | 409 | A record with those unique details already exists |
| Recreate category with same case-insensitive name | 409 | Category with this name already exists |
| Recreate warehouse with same case-insensitive name | 409 | Warehouse with this name already exists |
| Seller creation with nonexistent/inactive Manager UUID | 404 | Active Manager not found |
| Seller territory conflicts with Manager | 403 | Seller territory must be within the assigned Manager's territory |
| Manager/Admin create customer without sellerId | 400 | sellerId is required when onboarding customer as Manager or Admin |
| Customer create with inactive/nonexistent category UUID | 400 | Invalid or inactive category ID |
| Manager assigns customer to another Manager's seller | 403 | Seller is not assigned to you |
| Seller reassigns own customer to another seller | 403 | Sellers cannot reassign customer ownership |
| Receipt, transfer or sale quantity 0, negative or fractional | 400 | Quantity validation error |
| Transfer sourceId equals destinationId | 400 | Source and destination cannot be the same location |
| Transfer with nonexistent stock-location UUID | 404 | Source or destination stock location not found |
| Transfer exceeds source balance | 409 | Insufficient stock at ... Available: ..., Requested: ... |
| Sale with inactive/nonexistent customer | 400 | Invalid or inactive customer ID |
| Sale for another seller's customer | 403 | Customer is not assigned to you |
| Confirmed-price sale exceeds seller balance | 409 | Insufficient stock balance. Available: ..., Requested: ... |
| Approve pending sale without enough stock | 409 | Insufficient stock at seller location. Available: ..., Requested: ... |
| Approve/reject already-decided sale | 409 | Sale has already been decided with status: CONFIRMED or REJECTED |
| Repeat payment collection | 409 | Payment for this sale has already been set to CASH or BANK |
| Payment mode PENDING in collect-payment body | 400 | Only CASH/BANK accepted |
| Seller reads another seller's sale | 404 | Sale record not found |
| Reset token invalid, expired or reused | 400 | Invalid, expired, or already used password reset token |
| Wrong current password on password change | 401 | Current password is incorrect |
| Authentication rate limit exceeded | 429 | Too many authentication attempts. Try again later |
| Unknown route | 404 | Route not found |
| JSON larger than 100 KB | 413 | Request body is too large |
| Unexpected server/database failure | 500 | Internal server error; this is a defect/setup failure, not a success |

Example exact error:

```json
{
  "success": false,
  "message": "Source and destination cannot be the same location"
}
```

### Permission and scope checks

As Admin, replace the test Manager permissions with [] and confirm GET /manager/sellers and POST /manager/sellers return 403. Restore SELLER_READ and SELLER_CREATE afterward. Changes apply on the next authenticated request. Test a second Manager/seller pair for out-of-scope reads. Deactivate a test seller with PATCH /admin/sellers/{{sellerId}} and {"active":false}: old token and login should return 401. Reactivate with {"active":true}, then log in again. Deactivating a Manager does not automatically deactivate assigned sellers.

### Stock and financial assertions

- A receipt increases HQ and total stock by quantity.
- A transfer decreases source and increases destination equally; total stock stays unchanged.
- A confirmed sale or approved low-price sale reduces seller and total stock by quantity exactly once in a sequential manual test.
- Pending approval and rejection do not deduct stock. A low-price sale can be recorded without enough stock, but approval fails until stock is available.
- totalPaise = quantity × unitPricePaise. At incentiveRatePaise=200, incentiveAmountPaise = quantity × 200.
- Payment collection records the full amount and does not change stock. Repeat collection fails with 409.
- For an idempotency check, create a sale with a new unique requestKey, then replay the same body as the same seller. Expect 201 and the same sale ID with no second stock deduction; replay may omit nested invoice/customer/seller fields. Use a unique key per seller/test. Changing the body while reusing a key currently returns the original sale.

## Implementation details that affect testing

These describe current behavior, not stronger business guarantees:

- /categories allows any authenticated role to create/update categories. /admin/categories additionally requires SUPER_ADMIN. Do not expect 403 on Seller writes to /categories in this version.
- Only Manager seller routes currently enforce SELLER_READ and SELLER_CREATE. Manager customer, sales, inventory and dashboard routes enforce role and service-specific scope, not the other permission flags returned by /admin/permissions.
- Scope is not identical across modules. Customer list/get use Manager territory; customer create/update ownership checks do not fully enforce that same territory. Manager sales use assignment only. Manager dashboard/inventory use assignment plus state/district, not village.
- Admin dashboard filters affect sales and some entity counts differently: inventory and totalStates remain global; sellerId does not narrow totalShops and managerId does not narrow the Manager/Seller counts. Verify each metric separately.
- Payment collection checks ownership and PENDING paymentMode but currently does not require CONFIRMED sale status. Keep the normal flow on confirmed sales; record acceptance of payment on pending/rejected sales as a business-rule gap.
- requestKey lookup is global and returns an existing sale without checking seller ownership. Use unique keys; this is not a guarantee of secure cross-user idempotency.
- Stock/payment/approval checks should be tested sequentially here. This guide does not certify behavior under concurrent requests.
- Invoice endpoints return metadata. pdfPath does not imply an accessible HTTP download URL. Invoice snapshots retain original payment mode after later collection; use the current sale/payments for payment status.
- Password recovery creates reset records; production omits debugToken and no delivery integration exists. A successful production forgot-password response does not mean an email/SMS was sent.
- Sales report defaults to CONFIRMED, whereas sales-list endpoints include all statuses unless filtered. Report group totals can differ from full summary totals when row limits apply. Inventory report date ranges affect movements, while balances remain current.

## Record your test results

| Test or endpoint | Role | Actual status | Pass or fail | Actual response or issue |
| --- | --- | --- | --- | --- |
| Health and readiness | Public | | | |
| Login and role checks | All | | | |
| Manager and Seller setup | Admin/Manager | | | |
| Category and customer setup | Admin/Seller | | | |
| Receipt and transfer | Admin | | | |
| Confirmed and low-price sale | Seller | | | |
| Approve and reject | Admin | | | |
| Payment and invoice | Seller/Admin | | | |
| Dashboards and reports | All | | | |
| Validation and scope failures | All | | | |
| Password and deactivation | All | | | |

## Source and maintenance

Verified against src/app.ts, src/routes/user.routes.ts, mounted src/routes files, src/controller validators/handlers, src/services implementations, src/middleware and prisma/schema.prisma. Regenerate these two artifacts with node scripts/generate-postman-guide.mjs after updating the curated expectations in that script. The generator checks route coverage, but business-rule changes still require manual review. It does not execute requests or change database records.
