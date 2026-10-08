# Super Admin Authentication & Security

## 1. Overview & Provisioning

The Super Admin account is provisioned directly through a secure administrative bootstrap script rather than an open registration endpoint.

### Bootstrap Procedure
The CLI tool `scripts/bootstrap-admin.ts` (run via `npm run db:bootstrap-admin`) inspects the environment for:
- `ADMIN_NAME`: Full name of the initial Super Admin.
- `ADMIN_EMAIL`: Unique lowercase email address.
- `ADMIN_PASSWORD`: Strong password (min 12 characters, max 72 bytes).

```bash
npm run db:bootstrap-admin
```

The script:
1. Verifies that an existing Super Admin account is not already registered.
2. Hashes the password using `bcrypt` (12 rounds).
3. Inserts the root `User` record with `role: "SUPER_ADMIN"`, `active: true`, and empty permissions `[]` (Super Admins bypass permission checks).
4. Creates default `BusinessSettings` with `id: 1`, `minimumPricePaise: 2500` (₹25.00), and `incentiveRatePaise: null`.
5. Ensures the root `StockLocation` for `type: "HQ"` exists.

---

## 2. Login Flow

Super Admins authenticate via the unified authentication endpoint:

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "login": "admin@femmeflo.com",
  "password": "SuperSecureAdminPassword123!"
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
      "id": "2c62c2f6-ec89-498c-8c0c-e2f4a4bf7f09",
      "name": "Headquarters Administrator",
      "email": "admin@femmeflo.com",
      "phone": null,
      "role": "SUPER_ADMIN",
      "active": true,
      "state": null,
      "district": null,
      "village": null,
      "managerId": null,
      "permissions": [],
      "createdAt": "2026-04-01T10:00:00.000Z",
      "updatedAt": "2026-04-01T10:00:00.000Z"
    }
  }
}
```

---

## 3. Session & Password Management

### 3.1 Inspect Current Profile
```http
GET /api/v1/auth/me
Authorization: Bearer <token>
```
Returns sanitized profile data from the live database.

### 3.2 Change Password
```http
PATCH /api/v1/auth/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "SuperSecureAdminPassword123!",
  "newPassword": "EvenMoreSecurePassword456!"
}
```
**Effect**: Verifies current password, writes the new bcrypt hash, and increments `tokenVersion` by `+1`, instantly terminating any existing Super Admin sessions.

### 3.3 Account Recovery (Forgot & Reset)
- `POST /api/v1/auth/forgot-password` with `{ "login": "admin@femmeflo.com" }` generates a 20-minute reset token.
- `POST /api/v1/auth/reset-password` with `{ "token": "<raw_token>", "newPassword": "<new_password>" }` updates credentials and increments `tokenVersion`.

---

## 4. Middleware & Source File References

- **Bootstrap Script**: [bootstrap-admin.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/scripts/bootstrap-admin.ts)
- **Auth Routes**: [auth.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/auth/auth.routes.ts)
- **Auth Controller**: [auth.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/auth/auth.controller.ts)
- **Auth Service**: [auth.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/auth/auth.service.ts)
- **RBAC Middleware**: [rbac.middleware.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/middleware/rbac.middleware.ts)
