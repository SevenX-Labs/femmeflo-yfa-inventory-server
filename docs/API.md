# Frontend API reference

Base URL: http://localhost:5000/api/v1. API version: v1. Generated with npm run docs:api from scripts/generate-api-docs.mjs.

## Integration status

Implemented: health/readiness, login, current user, password change, Manager management/permissions, Seller onboarding and scoped Seller reads. Database-backed endpoints need configured PostgreSQL and applied migrations. Forgot/reset password, customers, sales, inventory operations, incentives, invoices, uploads, notifications and reports are not implemented yet.

## Authentication flow

1. An Admin/authorized Manager creates assigned credentials. There is no public signup.
2. POST /auth/login with login and password.
3. Keep the returned token in frontend memory and send Authorization: Bearer <token> on protected requests. A full page reload requires login again under this simple flow. There is no refresh token or server logout endpoint; frontend logout discards the token.
4. A 401 from a protected endpoint means login is needed. Password change or deactivation invalidates existing tokens. Account role/permissions are loaded from the database on each request.

## Shared conventions

- JSON writes: Content-Type: application/json. Protected routes: Authorization: Bearer <token>.
- UUID path IDs. Unknown body/query fields are rejected on documented input schemas.
- Phone format: + followed by country code and subscriber digits, e.g. +919876543210. Emails are normalized to lowercase.
- New passwords: at least 12 characters and at most 72 UTF-8 bytes. Never send role or permissions when onboarding as a Manager.
- List sorting is fixed: newest created first, then ID ascending for ties. No client-supplied sort is implemented.
- All list filters combine with AND; search checks name/email/phone. Manager assignment/territory scope always applies.
- page defaults to 1; pageSize defaults to 20, maximum 100. An empty list has totalPages 0.
- No date fields or upload endpoints are exposed in this increment. Future dates will be ISO 8601 UTC.
- Login and password change share a limit of 20 requests per IP per 15 minutes per server process; 429 includes Retry-After. Current setup assumes direct connections. Configure trusted proxy handling before Render deployment; do not blindly trust client forwarded headers.
- Health reports configuration; readiness checks the connection only, not migration state.

## Common errors

```json
{
  "success": false,
  "message": "Readable error message"
}
```

| Code | Meaning |
| --- | --- |
| 400 | Invalid request or ID |
| 401 | Missing, invalid, expired or revoked authentication; incorrect credentials |
| 403 | Role, permission or territory denied |
| 404 | Record not found or outside assigned scope |
| 409 | Duplicate contact or conflicting update |
| 413 | JSON body exceeds 100 KB |
| 415 | Unsupported JSON encoding |
| 429 | Too many authentication attempts |
| 500 | Internal server error |
| 503 | Service unavailable or not configured |

## Endpoint index

| Method | Path | Access |
| --- | --- | --- |
| GET | /health | Public |
| GET | /ready | Public |
| POST | /auth/login | Public |
| GET | /auth/me | Any authenticated active account |
| PATCH | /auth/password | Any authenticated active account |
| GET | /admin/managers | Super Admin |
| POST | /admin/managers | Super Admin |
| GET | /admin/managers/{id} | Super Admin |
| PATCH | /admin/managers/{id} | Super Admin |
| GET | /admin/sellers | Super Admin |
| POST | /admin/sellers | Super Admin |
| GET | /admin/sellers/{id} | Super Admin |
| PATCH | /admin/sellers/{id} | Super Admin |
| PATCH | /admin/managers/{id}/permissions | Super Admin |
| GET | /manager/sellers | Manager with SELLER_READ |
| POST | /manager/sellers | Manager with SELLER_CREATE |
| GET | /manager/sellers/{id} | Manager with SELLER_READ |
| GET | /categories | Any authenticated user |
| POST | /admin/categories | Super Admin |
| PATCH | /admin/categories/{id} | Super Admin |
| GET | /seller/customers | Seller |
| POST | /seller/customers | Seller |
| GET | /seller/customers/{id} | Seller |
| PATCH | /seller/customers/{id} | Seller |
| GET | /manager/customers | Manager |
| POST | /manager/customers | Manager |
| GET | /manager/customers/{id} | Manager |
| PATCH | /manager/customers/{id} | Manager |
| GET | /admin/customers | Super Admin |
| POST | /admin/customers | Super Admin |
| GET | /admin/customers/{id} | Super Admin |
| PATCH | /admin/customers/{id} | Super Admin |
| GET | /admin/inventory | Super Admin |
| POST | /admin/inventory/warehouses | Super Admin |
| GET | /admin/inventory/warehouses | Super Admin |
| POST | /admin/inventory/receipts | Super Admin |
| POST | /admin/inventory/transfers | Super Admin |
| GET | /admin/inventory/transactions | Super Admin |
| GET | /manager/inventory | Manager |
| GET | /seller/inventory | Seller |
| GET | /seller/inventory/transactions | Seller |
| POST | /seller/sales | Seller |
| GET | /seller/sales | Seller |
| GET | /seller/sales/{id} | Seller |
| GET | /admin/approvals | Super Admin |
| POST | /admin/approvals/{saleId}/approve | Super Admin |
| POST | /admin/approvals/{saleId}/reject | Super Admin |
| GET | /admin/sales | Super Admin |
| GET | /admin/sales/{id} | Super Admin |
| GET | /manager/sales | Manager |
| GET | /manager/sales/{id} | Manager |

## HTTP health

Purpose: Public. Reports configuration only. Use /ready for a live database check.

Method/URL: GET /api/v1/health

Authentication: Not required. Authorization: Public.

Headers: No Authorization header required. No request body.

Path/query parameters: none.

Request body: none.

Success: HTTP 200

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

Errors: 500 (Internal server error). Error JSON uses the common format above.

## Database readiness

Purpose: Public. Executes SELECT 1. Does not validate schema migrations or external providers.

Method/URL: GET /api/v1/ready

Authentication: Not required. Authorization: Public.

Headers: No Authorization header required. No request body.

Path/query parameters: none.

Request body: none.

Success: HTTP 200

```json
{
  "success": true,
  "message": "API is ready",
  "data": {
    "database": "connected"
  }
}
```

Errors: 500 (Internal server error); 503 (Service unavailable or not configured). Error JSON uses the common format above.

## Login

Purpose: Public. Email is trimmed/lowercased; phone must match its stored international format. Unknown/inactive accounts and wrong passwords return the same 401 message.

Method/URL: POST /api/v1/auth/login

Authentication: Not required. Authorization: Public.

Headers: No Authorization header required. Content-Type: application/json.

Path/query parameters: none.

Request body:

```json
{
  "login": "ravi@example.com",
  "password": "Example password 123!"
}
```

Validation: required fields: login, password. Unknown fields are rejected. See shared conventions and OpenAPI for field bounds.

Success: HTTP 200

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "<JWT returned by login>",
    "tokenType": "Bearer",
    "expiresInSeconds": 3600,
    "user": {
      "id": "22222222-2222-4222-8222-222222222222",
      "name": "Ravi Seller",
      "email": "ravi@example.com",
      "phone": "+919876543211",
      "role": "SELLER",
      "active": true,
      "managerId": "11111111-1111-4111-8111-111111111111",
      "permissions": [],
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva"
    }
  }
}
```

Errors: 400 (Invalid request or ID); 401 (Missing, invalid, expired or revoked authentication; incorrect credentials); 429 (Too many authentication attempts); 500 (Internal server error); 503 (Service unavailable or not configured). Error JSON uses the common format above.

## Current user

Purpose: Any authenticated active account.

Method/URL: GET /api/v1/auth/me

Authentication: Bearer token required. Authorization: Any authenticated active account.

Headers: Authorization: Bearer <token>. No request body.

Path/query parameters: none.

Request body: none.

Success: HTTP 200

```json
{
  "success": true,
  "message": "Current user",
  "data": {
    "user": {
      "id": "22222222-2222-4222-8222-222222222222",
      "name": "Ravi Seller",
      "email": "ravi@example.com",
      "phone": "+919876543211",
      "role": "SELLER",
      "active": true,
      "managerId": "11111111-1111-4111-8111-111111111111",
      "permissions": [],
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva"
    }
  }
}
```

Errors: 401 (Missing, invalid, expired or revoked authentication; incorrect credentials); 500 (Internal server error); 503 (Service unavailable or not configured). Error JSON uses the common format above.

## Change password

Purpose: Any authenticated active account. All existing tokens are revoked. Log in with the new password after success.

Method/URL: PATCH /api/v1/auth/password

Authentication: Bearer token required. Authorization: Any authenticated active account.

Headers: Authorization: Bearer <token>. Content-Type: application/json.

Path/query parameters: none.

Request body:

```json
{
  "currentPassword": "Example password 123!",
  "newPassword": "Replacement password 123!"
}
```

Validation: required fields: currentPassword, newPassword. Unknown fields are rejected. See shared conventions and OpenAPI for field bounds.

Success: HTTP 200

```json
{
  "success": true,
  "message": "Password changed. Log in again",
  "data": {}
}
```

Errors: 400 (Invalid request or ID); 401 (Missing, invalid, expired or revoked authentication; incorrect credentials); 409 (Duplicate contact or conflicting update); 429 (Too many authentication attempts); 500 (Internal server error); 503 (Service unavailable or not configured). Error JSON uses the common format above.

## List managers

Purpose: Super Admin.

Method/URL: GET /api/v1/admin/managers

Authentication: Bearer token required. Authorization: Super Admin.

Headers: Authorization: Bearer <token>. No request body.

Parameters:

| Name | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| page | query | integer | No | Page number |
| pageSize | query | integer | No | Items per page |
| search | query | string | No | Case-insensitive name, email or phone substring |
| active | query | string | No | Account activation status |
| managerId | query | string (uuid) | No | Additional Manager filter; cannot broaden access |
| state | query | string | No | Case-insensitive exact match |
| district | query | string | No | Case-insensitive exact match |
| village | query | string | No | Case-insensitive exact match |

Request body: none.

Success: HTTP 200

```json
{
  "success": true,
  "message": "Managers retrieved",
  "data": {
    "items": [
      {
        "id": "11111111-1111-4111-8111-111111111111",
        "name": "Asha Manager",
        "email": "asha@example.com",
        "phone": "+919876543210",
        "role": "MANAGER",
        "active": true,
        "managerId": null,
        "permissions": [
          "SELLER_READ",
          "SELLER_CREATE"
        ],
        "state": "Maharashtra",
        "district": "Thane",
        "village": null
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

Errors: 400 (Invalid request or ID); 401 (Missing, invalid, expired or revoked authentication; incorrect credentials); 403 (Role, permission or territory denied); 500 (Internal server error). Error JSON uses the common format above.

## Create Manager

Purpose: Super Admin. Permissions default to an empty list. District requires state; village requires district.

Method/URL: POST /api/v1/admin/managers

Authentication: Bearer token required. Authorization: Super Admin.

Headers: Authorization: Bearer <token>. Content-Type: application/json.

Path/query parameters: none.

Request body:

```json
{
  "name": "Asha Manager",
  "phone": "+919876543210",
  "email": "asha@example.com",
  "password": "Example password 123!",
  "state": "Maharashtra",
  "district": "Thane",
  "permissions": [
    "SELLER_READ",
    "SELLER_CREATE"
  ]
}
```

Validation: required fields: name, phone, password. Unknown fields are rejected. See shared conventions and OpenAPI for field bounds.

Success: HTTP 201

```json
{
  "success": true,
  "message": "Manager created",
  "data": {
    "user": {
      "id": "11111111-1111-4111-8111-111111111111",
      "name": "Asha Manager",
      "email": "asha@example.com",
      "phone": "+919876543210",
      "role": "MANAGER",
      "active": true,
      "managerId": null,
      "permissions": [
        "SELLER_READ",
        "SELLER_CREATE"
      ],
      "state": "Maharashtra",
      "district": "Thane",
      "village": null
    }
  }
}
```

Errors: 400 (Invalid request or ID); 401 (Missing, invalid, expired or revoked authentication; incorrect credentials); 403 (Role, permission or territory denied); 404 (Record not found or outside assigned scope); 409 (Duplicate contact or conflicting update); 500 (Internal server error). Error JSON uses the common format above.

## Get Manager

Purpose: Super Admin.

Method/URL: GET /api/v1/admin/managers/{id}

Authentication: Bearer token required. Authorization: Super Admin.

Headers: Authorization: Bearer <token>. No request body.

Parameters:

| Name | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| id | path | string (uuid) | Yes | Manager or Seller UUID |

Request body: none.

Success: HTTP 200

```json
{
  "success": true,
  "message": "Manager retrieved",
  "data": {
    "user": {
      "id": "11111111-1111-4111-8111-111111111111",
      "name": "Asha Manager",
      "email": "asha@example.com",
      "phone": "+919876543210",
      "role": "MANAGER",
      "active": true,
      "managerId": null,
      "permissions": [
        "SELLER_READ",
        "SELLER_CREATE"
      ],
      "state": "Maharashtra",
      "district": "Thane",
      "village": null
    }
  }
}
```

Errors: 400 (Invalid request or ID); 401 (Missing, invalid, expired or revoked authentication; incorrect credentials); 403 (Role, permission or territory denied); 404 (Record not found or outside assigned scope); 500 (Internal server error). Error JSON uses the common format above.

## Update Manager

Purpose: Super Admin. Editable fields: name, phone, email, state, district, village, active. Role, password, Manager assignment and permissions cannot be changed here. Activation changes revoke earlier tokens. Territory changes must remain consistent with assignments. Fields cannot currently be cleared with null.

Method/URL: PATCH /api/v1/admin/managers/{id}

Authentication: Bearer token required. Authorization: Super Admin.

Headers: Authorization: Bearer <token>. Content-Type: application/json.

Parameters:

| Name | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| id | path | string (uuid) | Yes | Manager or Seller UUID |

Request body:

```json
{
  "active": false
}
```

Validation: required fields: at least one permitted field. Unknown fields are rejected. See shared conventions and OpenAPI for field bounds.

Success: HTTP 200

```json
{
  "success": true,
  "message": "Manager updated",
  "data": {
    "user": {
      "id": "11111111-1111-4111-8111-111111111111",
      "name": "Asha Manager",
      "email": "asha@example.com",
      "phone": "+919876543210",
      "role": "MANAGER",
      "active": false,
      "managerId": null,
      "permissions": [
        "SELLER_READ",
        "SELLER_CREATE"
      ],
      "state": "Maharashtra",
      "district": "Thane",
      "village": null
    }
  }
}
```

Errors: 400 (Invalid request or ID); 401 (Missing, invalid, expired or revoked authentication; incorrect credentials); 403 (Role, permission or territory denied); 404 (Record not found or outside assigned scope); 409 (Duplicate contact or conflicting update); 500 (Internal server error). Error JSON uses the common format above.

## List sellers

Purpose: Super Admin.

Method/URL: GET /api/v1/admin/sellers

Authentication: Bearer token required. Authorization: Super Admin.

Headers: Authorization: Bearer <token>. No request body.

Parameters:

| Name | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| page | query | integer | No | Page number |
| pageSize | query | integer | No | Items per page |
| search | query | string | No | Case-insensitive name, email or phone substring |
| active | query | string | No | Account activation status |
| managerId | query | string (uuid) | No | Additional Manager filter; cannot broaden access |
| state | query | string | No | Case-insensitive exact match |
| district | query | string | No | Case-insensitive exact match |
| village | query | string | No | Case-insensitive exact match |

Request body: none.

Success: HTTP 200

```json
{
  "success": true,
  "message": "Sellers retrieved",
  "data": {
    "items": [
      {
        "id": "22222222-2222-4222-8222-222222222222",
        "name": "Ravi Seller",
        "email": "ravi@example.com",
        "phone": "+919876543211",
        "role": "SELLER",
        "active": true,
        "managerId": "11111111-1111-4111-8111-111111111111",
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

Errors: 400 (Invalid request or ID); 401 (Missing, invalid, expired or revoked authentication; incorrect credentials); 403 (Role, permission or territory denied); 500 (Internal server error). Error JSON uses the common format above.

## Create Seller

Purpose: Super Admin. Requires an active Manager; creates a zero-balance Seller stock account in the same transaction.

Method/URL: POST /api/v1/admin/sellers

Authentication: Bearer token required. Authorization: Super Admin.

Headers: Authorization: Bearer <token>. Content-Type: application/json.

Path/query parameters: none.

Request body:

```json
{
  "name": "Ravi Seller",
  "phone": "+919876543211",
  "email": "ravi@example.com",
  "password": "Example password 123!",
  "state": "Maharashtra",
  "district": "Thane",
  "village": "Diva",
  "managerId": "11111111-1111-4111-8111-111111111111"
}
```

Validation: required fields: name, phone, password, managerId. Unknown fields are rejected. See shared conventions and OpenAPI for field bounds.

Success: HTTP 201

```json
{
  "success": true,
  "message": "Seller created",
  "data": {
    "user": {
      "id": "22222222-2222-4222-8222-222222222222",
      "name": "Ravi Seller",
      "email": "ravi@example.com",
      "phone": "+919876543211",
      "role": "SELLER",
      "active": true,
      "managerId": "11111111-1111-4111-8111-111111111111",
      "permissions": [],
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva"
    }
  }
}
```

Errors: 400 (Invalid request or ID); 401 (Missing, invalid, expired or revoked authentication; incorrect credentials); 403 (Role, permission or territory denied); 404 (Record not found or outside assigned scope); 409 (Duplicate contact or conflicting update); 500 (Internal server error). Error JSON uses the common format above.

## Get Seller

Purpose: Super Admin.

Method/URL: GET /api/v1/admin/sellers/{id}

Authentication: Bearer token required. Authorization: Super Admin.

Headers: Authorization: Bearer <token>. No request body.

Parameters:

| Name | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| id | path | string (uuid) | Yes | Manager or Seller UUID |

Request body: none.

Success: HTTP 200

```json
{
  "success": true,
  "message": "Seller retrieved",
  "data": {
    "user": {
      "id": "22222222-2222-4222-8222-222222222222",
      "name": "Ravi Seller",
      "email": "ravi@example.com",
      "phone": "+919876543211",
      "role": "SELLER",
      "active": true,
      "managerId": "11111111-1111-4111-8111-111111111111",
      "permissions": [],
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva"
    }
  }
}
```

Errors: 400 (Invalid request or ID); 401 (Missing, invalid, expired or revoked authentication; incorrect credentials); 403 (Role, permission or territory denied); 404 (Record not found or outside assigned scope); 500 (Internal server error). Error JSON uses the common format above.

## Update Seller

Purpose: Super Admin. Editable fields: name, phone, email, state, district, village, active. Role, password, Manager assignment and permissions cannot be changed here. Activation changes revoke earlier tokens. Territory changes must remain consistent with assignments. Fields cannot currently be cleared with null.

Method/URL: PATCH /api/v1/admin/sellers/{id}

Authentication: Bearer token required. Authorization: Super Admin.

Headers: Authorization: Bearer <token>. Content-Type: application/json.

Parameters:

| Name | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| id | path | string (uuid) | Yes | Manager or Seller UUID |

Request body:

```json
{
  "active": false
}
```

Validation: required fields: at least one permitted field. Unknown fields are rejected. See shared conventions and OpenAPI for field bounds.

Success: HTTP 200

```json
{
  "success": true,
  "message": "Seller updated",
  "data": {
    "user": {
      "id": "22222222-2222-4222-8222-222222222222",
      "name": "Ravi Seller",
      "email": "ravi@example.com",
      "phone": "+919876543211",
      "role": "SELLER",
      "active": false,
      "managerId": "11111111-1111-4111-8111-111111111111",
      "permissions": [],
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva"
    }
  }
}
```

Errors: 400 (Invalid request or ID); 401 (Missing, invalid, expired or revoked authentication; incorrect credentials); 403 (Role, permission or territory denied); 404 (Record not found or outside assigned scope); 409 (Duplicate contact or conflicting update); 500 (Internal server error). Error JSON uses the common format above.

## Replace Manager permissions

Purpose: Super Admin. Replaces the complete list. Changes take effect on the next authenticated request. Only SELLER_READ and SELLER_CREATE have implemented business routes in this increment; other flags are reserved for PRD modules.

Method/URL: PATCH /api/v1/admin/managers/{id}/permissions

Authentication: Bearer token required. Authorization: Super Admin.

Headers: Authorization: Bearer <token>. Content-Type: application/json.

Parameters:

| Name | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| id | path | string (uuid) | Yes | Manager or Seller UUID |

Request body:

```json
{
  "permissions": [
    "SELLER_READ",
    "SELLER_CREATE"
  ]
}
```

Validation: required fields: permissions. Unknown fields are rejected. See shared conventions and OpenAPI for field bounds.

Success: HTTP 200

```json
{
  "success": true,
  "message": "Manager permissions updated",
  "data": {
    "user": {
      "id": "11111111-1111-4111-8111-111111111111",
      "name": "Asha Manager",
      "email": "asha@example.com",
      "phone": "+919876543210",
      "role": "MANAGER",
      "active": true,
      "managerId": null,
      "permissions": [
        "SELLER_READ",
        "SELLER_CREATE"
      ],
      "state": "Maharashtra",
      "district": "Thane",
      "village": null
    }
  }
}
```

Errors: 400 (Invalid request or ID); 401 (Missing, invalid, expired or revoked authentication; incorrect credentials); 403 (Role, permission or territory denied); 404 (Record not found or outside assigned scope); 500 (Internal server error). Error JSON uses the common format above.

## List assigned Sellers

Purpose: Manager with SELLER_READ. Scope combines assignment and the Manager's configured territory. Query filters cannot broaden scope.

Method/URL: GET /api/v1/manager/sellers

Authentication: Bearer token required. Authorization: Manager with SELLER_READ.

Headers: Authorization: Bearer <token>. No request body.

Parameters:

| Name | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| page | query | integer | No | Page number |
| pageSize | query | integer | No | Items per page |
| search | query | string | No | Case-insensitive name, email or phone substring |
| active | query | string | No | Account activation status |
| managerId | query | string (uuid) | No | Additional Manager filter; cannot broaden access |
| state | query | string | No | Case-insensitive exact match |
| district | query | string | No | Case-insensitive exact match |
| village | query | string | No | Case-insensitive exact match |

Request body: none.

Success: HTTP 200

```json
{
  "success": true,
  "message": "Assigned Sellers retrieved",
  "data": {
    "items": [
      {
        "id": "22222222-2222-4222-8222-222222222222",
        "name": "Ravi Seller",
        "email": "ravi@example.com",
        "phone": "+919876543211",
        "role": "SELLER",
        "active": true,
        "managerId": "11111111-1111-4111-8111-111111111111",
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

Errors: 400 (Invalid request or ID); 401 (Missing, invalid, expired or revoked authentication; incorrect credentials); 403 (Role, permission or territory denied); 500 (Internal server error). Error JSON uses the common format above.

## Onboard assigned Seller

Purpose: Manager with SELLER_CREATE. Manager ID comes from the logged-in account. Supplying managerId/role/permissions is rejected. Missing territory fields inherit Manager restrictions; conflicting locations return 403. Creates the stock account atomically.

Method/URL: POST /api/v1/manager/sellers

Authentication: Bearer token required. Authorization: Manager with SELLER_CREATE.

Headers: Authorization: Bearer <token>. Content-Type: application/json.

Path/query parameters: none.

Request body:

```json
{
  "name": "Ravi Seller",
  "phone": "+919876543211",
  "email": "ravi@example.com",
  "password": "Example password 123!",
  "state": "Maharashtra",
  "district": "Thane",
  "village": "Diva"
}
```

Validation: required fields: name, phone, password. Unknown fields are rejected. See shared conventions and OpenAPI for field bounds.

Success: HTTP 201

```json
{
  "success": true,
  "message": "Seller created",
  "data": {
    "user": {
      "id": "22222222-2222-4222-8222-222222222222",
      "name": "Ravi Seller",
      "email": "ravi@example.com",
      "phone": "+919876543211",
      "role": "SELLER",
      "active": true,
      "managerId": "11111111-1111-4111-8111-111111111111",
      "permissions": [],
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva"
    }
  }
}
```

Errors: 400 (Invalid request or ID); 401 (Missing, invalid, expired or revoked authentication; incorrect credentials); 403 (Role, permission or territory denied); 404 (Record not found or outside assigned scope); 409 (Duplicate contact or conflicting update); 500 (Internal server error). Error JSON uses the common format above.

## Get assigned Seller

Purpose: Manager with SELLER_READ. Returns 404 for another Manager's Seller or a Seller outside the configured territory.

Method/URL: GET /api/v1/manager/sellers/{id}

Authentication: Bearer token required. Authorization: Manager with SELLER_READ.

Headers: Authorization: Bearer <token>. No request body.

Parameters:

| Name | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| id | path | string (uuid) | Yes | Manager or Seller UUID |

Request body: none.

Success: HTTP 200

```json
{
  "success": true,
  "message": "Assigned Seller retrieved",
  "data": {
    "user": {
      "id": "22222222-2222-4222-8222-222222222222",
      "name": "Ravi Seller",
      "email": "ravi@example.com",
      "phone": "+919876543211",
      "role": "SELLER",
      "active": true,
      "managerId": "11111111-1111-4111-8111-111111111111",
      "permissions": [],
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva"
    }
  }
}
```

Errors: 400 (Invalid request or ID); 401 (Missing, invalid, expired or revoked authentication; incorrect credentials); 403 (Role, permission or territory denied); 404 (Record not found or outside assigned scope); 500 (Internal server error). Error JSON uses the common format above.

## List Categories

Purpose: Authenticated. Returns active categories for selecting when adding/editing customers.

Method/URL: GET /api/v1/categories

Authentication: Bearer token required. Authorization: Any authenticated user.

Headers: Authorization: Bearer <token>. No request body.

Parameters:

| Name | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| search | query | string | No | Search name |
| active | query | string | No | Filter by active status (true/false) |

Success: HTTP 200

```json
{
  "success": true,
  "message": "Categories retrieved",
  "data": {
    "items": [
      {
        "id": "33333333-3333-4333-8333-333333333333",
        "name": "Retail Store",
        "active": true
      }
    ]
  }
}
```

## Create Category

Purpose: Super Admin.

Method/URL: POST /api/v1/admin/categories

Authentication: Bearer token required. Authorization: Super Admin.

Request body:

```json
{
  "name": "Supermarket"
}
```

Success: HTTP 201

```json
{
  "success": true,
  "message": "Category created",
  "data": {
    "category": {
      "id": "33333333-3333-4333-8333-333333333333",
      "name": "Supermarket",
      "active": true
    }
  }
}
```

Errors: 400 (Invalid input); 401 (Unauthorized); 403 (Forbidden); 409 (Category with this name already exists).

## Add Customer / Shop

Purpose: Seller, Manager, or Admin. Onboards a customer/shop with geography, category, and contact details.

Method/URL: POST /api/v1/seller/customers (or /api/v1/manager/customers, /api/v1/admin/customers)

Authentication: Bearer token required.

Request body:

```json
{
  "shopName": "Quality General Store",
  "contactName": "Ramesh Kumar",
  "phone": "+919876543299",
  "categoryId": "33333333-3333-4333-8333-333333333333",
  "sellerId": "22222222-2222-4222-8222-222222222222",
  "state": "Maharashtra",
  "district": "Thane",
  "village": "Diva",
  "latitude": 19.18,
  "longitude": 73.04
}
```

Success: HTTP 201

```json
{
  "success": true,
  "message": "Customer created",
  "data": {
    "customer": {
      "id": "44444444-4444-4444-8444-444444444444",
      "shopName": "Quality General Store",
      "contactName": "Ramesh Kumar",
      "phone": "+919876543299",
      "categoryId": "33333333-3333-4333-8333-333333333333",
      "sellerId": "22222222-2222-4222-8222-222222222222",
      "state": "Maharashtra",
      "district": "Thane",
      "village": "Diva",
      "active": true
    }
  }
}
```

## List Customers

Purpose: Scoped listing by role (Seller sees own customers; Manager sees assigned sellers' customers; Admin sees all).

Method/URL: GET /api/v1/seller/customers (or /api/v1/manager/customers, /api/v1/admin/customers)

Query parameters: `page`, `pageSize`, `search`, `categoryId`, `sellerId`, `state`, `district`, `village`.

Success: HTTP 200 with paginated items.

## Inventory Summary & Locations

Purpose: Super Admin. Returns total stock levels across HQ, Warehouses, and Sellers.

Method/URL: GET /api/v1/admin/inventory

Authentication: Bearer token required. Authorization: Super Admin.

Success: HTTP 200

```json
{
  "success": true,
  "message": "Inventory summary retrieved",
  "data": {
    "totalStock": 400,
    "hqStock": 210,
    "warehouseStock": 150,
    "sellerStock": 40,
    "locations": []
  }
}
```

## Stock Receipt (HQ)

Purpose: Super Admin. Adds newly arrived stock to HQ inventory balance.

Method/URL: POST /api/v1/admin/inventory/receipts

Request body: `{"quantity": 400}`

Success: HTTP 201

## Stock Transfer

Purpose: Super Admin. Transfers stock between locations (HQ -> Warehouse, Warehouse -> Seller). Rejects with 409 if source stock balance is insufficient.

Method/URL: POST /api/v1/admin/inventory/transfers

Request body:

```json
{
  "sourceId": "55555555-5555-5555-5555-555555555555",
  "destinationId": "66666666-6666-6666-6666-666666666666",
  "quantity": 40
}
```

Success: HTTP 200

## Seller Inventory Position

Purpose: Seller. Returns seller's stock location (`assigned`, `sold`, `remaining`).

Method/URL: GET /api/v1/seller/inventory

Success: HTTP 200

```json
{
  "success": true,
  "message": "Inventory retrieved",
  "data": {
    "locationId": "66666666-6666-6666-6666-666666666666",
    "name": "Ravi Seller Stock",
    "assigned": 40,
    "sold": 0,
    "remaining": 40
  }
}
```

## Record Sale

Purpose: Seller. Records a packet sale. If unitPricePaise < 2500 (below ₹25), enters `PENDING_APPROVAL` and notifies Admin. If >= 2500, confirms immediately (deducts seller stock, generates invoice).

Method/URL: POST /api/v1/seller/sales

Authentication: Bearer token required. Authorization: Seller.

Request body:

```json
{
  "customerId": "44444444-4444-4444-8444-444444444444",
  "quantity": 10,
  "unitPricePaise": 2500,
  "paymentMode": "CASH"
}
```

Success: HTTP 201

```json
{
  "success": true,
  "message": "Sale confirmed successfully",
  "data": {
    "sale": {
      "id": "77777777-7777-7777-7777-777777777777",
      "quantity": 10,
      "unitPricePaise": 2500,
      "totalPaise": 25000,
      "paymentMode": "CASH",
      "status": "CONFIRMED"
    }
  }
}
```

## Pending Low-Price Approvals

Purpose: Super Admin. Lists sales awaiting low-price approval.

Method/URL: GET /api/v1/admin/approvals

Success: HTTP 200

## Approve / Reject Low-Price Sale

Purpose: Super Admin. Approves or rejects a low-price sale. Approval deducts stock & generates invoice. Rejection leaves stock untouched.

Method/URL:
- POST /api/v1/admin/approvals/{saleId}/approve
- POST /api/v1/admin/approvals/{saleId}/reject (body: `{"reason": "Price too low"}`)

Success: HTTP 200

## Frontend handoff

Use the endpoint index above and [OpenAPI](openapi.json). Bootstrap the initial Admin using the README, then create a Manager with SELLER_READ/SELLER_CREATE, log in as that Manager and onboard a Seller. Password reset, sales and other PRD modules remain unavailable. Seller reassignment and clearing optional fields are not implemented. CORS_ORIGINS must include the frontend origin.
