# Manager Authentication & Security

## 1. Overview & Account Creation

Manager accounts are provisioned exclusively by a Super Admin via `POST /api/v1/admin/managers`. Managers do not have open public registration.

Upon creation, the Super Admin establishes:
- Manager's official name, email, and phone number.
- Temporary initial password.
- Assigned regional territory (`state`, `district`, `village`).
- Initial business permissions (e.g. `SELLER_READ`, `SELLER_CREATE`, `CUSTOMER_READ`, `CUSTOMER_CREATE`).

---

## 2. Login Flow

Managers authenticate via the standard authentication endpoint:

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "login": "rajesh.sharma@femmeflo.com",
  "password": "ManagerSecurePassword123!"
}
```

### Response (200 OK)
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresInSeconds": 3600,
    "user": {
      "id": "e4b17f8a-9213-4fba-bbcf-098e916a4c21",
      "name": "Rajesh Sharma",
      "email": "rajesh.sharma@femmeflo.com",
      "phone": "+919876543210",
      "role": "MANAGER",
      "active": true,
      "state": "Maharashtra",
      "district": "Pune",
      "village": null,
      "managerId": null,
      "permissions": ["SELLER_READ", "SELLER_CREATE", "CUSTOMER_READ", "CUSTOMER_CREATE"],
      "createdAt": "2026-04-01T10:30:00.000Z",
      "updatedAt": "2026-04-01T10:30:00.000Z"
    }
  }
}
```

---

## 3. Session & Password Operations

### 3.1 Fetch Current User
```http
GET /api/v1/auth/me
Authorization: Bearer <token>
```
Returns the Manager's live user record, including active territory and permissions.

### 3.2 Change Password
```http
PATCH /api/v1/auth/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "TemporaryManagerPass123!",
  "newPassword": "NewManagerPermanentPassword456!"
}
```
**Effect**: Verifies current password, updates bcrypt hash, and increments `tokenVersion` by `+1`, ending all active sessions across any devices.

### 3.3 Forgot & Reset Password
- `POST /api/v1/auth/forgot-password` with `{ "login": "rajesh.sharma@femmeflo.com" }`.
- `POST /api/v1/auth/reset-password` with `{ "token": "<raw_token>", "newPassword": "<new_password>" }`.

---

## 4. Source Files

- **Auth Controller**: [auth.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/auth/auth.controller.ts)
- **Auth Service**: [auth.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/auth/auth.service.ts)
- **Auth Middleware**: [auth.middleware.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/middleware/auth.middleware.ts)
- **RBAC Middleware**: [rbac.middleware.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/middleware/rbac.middleware.ts)
