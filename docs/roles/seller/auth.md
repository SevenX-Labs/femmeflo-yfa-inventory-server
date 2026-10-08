# Seller Authentication & Mobile Session Flow

## 1. Overview & Account Creation

Seller accounts are created by either a Super Admin or an authorized Regional Manager holding `SELLER_CREATE` permissions. Sellers do not self-register publicly.

Key parameters configured upon onboarding:
- Name, phone number, and optional email.
- Initial temporary password.
- Mandatory link to parent Manager (`managerId`).
- Geographic territory (`state`, `district`, `village`).
- Auto-provisioned `StockLocation` of type `SELLER`.

---

## 2. Login Flow (Phone or Email)

Sellers frequently authenticate from mobile web or PWA applications using their mobile phone number:

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "login": "+919812345678",
  "password": "SellerPassword123!"
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
      "id": "c1f7b889-13da-4a11-8fcb-2e92c2cb9842",
      "name": "Amit Patil",
      "email": "amit.patil@femmeflo.com",
      "phone": "+919812345678",
      "role": "SELLER",
      "active": true,
      "state": "Maharashtra",
      "district": "Pune",
      "village": "Kothrud",
      "managerId": "e4b17f8a-9213-4fba-bbcf-098e916a4c21",
      "permissions": [],
      "createdAt": "2026-04-01T11:00:00.000Z",
      "updatedAt": "2026-04-01T11:00:00.000Z"
    }
  }
}
```

---

## 3. Session Operations

### 3.1 Fetch Current User Profile
```http
GET /api/v1/auth/me
Authorization: Bearer <token>
```
Returns authenticated Seller profile info.

### 3.2 Change Password
```http
PATCH /api/v1/auth/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePassword456!"
}
```
**Effect**: Verifies current credentials, writes updated hash, and increments `tokenVersion` by `+1`, instantly terminating any existing sessions.

### 3.3 Forgot Password & Reset
1. Request: `POST /api/v1/auth/forgot-password` with `{ "login": "+919812345678" }`.
2. Confirm: `POST /api/v1/auth/reset-password` with `{ "token": "<raw_token>", "newPassword": "<new_password>" }`.

---

## 4. Source Files

- **Auth Controller**: [auth.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/auth/auth.controller.ts)
- **Auth Service**: [auth.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/auth/auth.service.ts)
- **Auth Middleware**: [auth.middleware.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/middleware/auth.middleware.ts)
