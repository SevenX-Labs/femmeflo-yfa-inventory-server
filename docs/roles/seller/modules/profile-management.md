# Seller: Profile Self-Service Module

## 1. Module Purpose

Allows field Sellers to view their personal profile information, review their parent Manager's contact details and current stock location balance, and update their personal name, phone number, or email.

---

## 2. Business Logic & Security Rules

1. **Self-Service Only**:
   - Endpoints operate strictly against `response.locals.authUser.id`.
2. **Conflict Verification**:
   - If the Seller updates their `phone` or `email`, the service performs collision checks across the `User` table. If another account already holds the requested phone or email, `HttpError(409, "Phone number is already in use by another account")` is returned.
3. **Manager & Stock Projection**:
   - The profile retrieval query hydrates parent Manager details (`id`, `name`, `phone`, `email`) and the Seller's `stockLocation` balance.
4. **Territory Immutability**:
   - Sellers cannot alter their assigned `state`, `district`, `village`, or `managerId`. Only Super Admins and Managers have authority to change organizational territories.

---

## 3. Endpoints

| Method | Path | Summary | Auth & Guard |
| --- | --- | --- | --- |
| `GET` | `/api/v1/seller/profile` | View profile, manager info & stock balance | `requireRole("SELLER")` |
| `PATCH` | `/api/v1/seller/profile` | Update personal name, phone, or email | `requireRole("SELLER")` |

---

## 4. Request & Response Examples

### 4.1 View Profile
```http
GET /api/v1/seller/profile
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "c1f7b889-13da-4a11-8fcb-2e92c2cb9842",
      "name": "Amit Patil",
      "phone": "+919812345678",
      "email": "amit.patil@femmeflo.com",
      "role": "SELLER",
      "active": true,
      "state": "Maharashtra",
      "district": "Pune",
      "village": "Kothrud",
      "manager": {
        "id": "e4b17f8a-9213-4fba-bbcf-098e916a4c21",
        "name": "Rajesh Sharma",
        "phone": "+919876543210",
        "email": "rajesh.sharma@femmeflo.com"
      },
      "stockLocation": {
        "id": "77777777-7777-7777-7777-777777777777",
        "name": "Amit Patil Stock",
        "balance": 80
      }
    }
  }
}
```

### 4.2 Update Profile
```http
PATCH /api/v1/seller/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "+919899887766"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "profile": {
      "id": "c1f7b889-13da-4a11-8fcb-2e92c2cb9842",
      "name": "Amit Patil",
      "phone": "+919899887766",
      "email": "amit.patil@femmeflo.com",
      "role": "SELLER",
      "active": true,
      "state": "Maharashtra",
      "district": "Pune",
      "village": "Kothrud"
    }
  }
}
```

---

## 5. Source File Links

- **Route Definitions**: [seller/profile.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/seller/profile.routes.ts)
- **Controller**: [seller/profile.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/seller/profile.controller.ts)
- **Service**: [seller/profile.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/seller/profile.service.ts)
