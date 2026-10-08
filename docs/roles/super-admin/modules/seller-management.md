# Super Admin: Seller Management Module

## 1. Module Purpose

Enables the Super Admin to oversee, onboard, update, reassign, and deactivate field Sellers (`role: "SELLER"`). Sellers carry physical product packets, visit retail customer shops, record sales orders, and collect customer payments.

---

## 2. Business Logic & Rules

1. **Manager Hierarchy & Automatic Territory Inheritance**:
   - Every Seller must be assigned to an active Manager (`managerId`).
   - If the incoming Seller payload does not specify `state`, `district`, or `village`, the Seller automatically inherits the parent Manager's territory.
   - If explicit territory values are provided, they must strictly reside within the parent Manager's geographical domain (checked case-insensitively).
2. **Automatic Stock Location Provisioning**:
   - In an atomic transaction, creating a Seller automatically inserts a linked `StockLocation` of type `SELLER` with `balance: 0` and `name: seller.name`.
3. **Name Synchronization**:
   - If a Seller's name is updated, the linked `StockLocation.name` is automatically synchronized.
4. **Deactivation & Invalidation**:
   - Updating `active: false` increments `tokenVersion`, invalidating the Seller's active mobile/web JWT sessions.

---

## 3. Endpoints

| Method | Path | Summary | Auth & Guard |
| --- | --- | --- | --- |
| `POST` | `/api/v1/admin/sellers` | Onboard a new Seller under a Manager | `requireRole("SUPER_ADMIN")` |
| `GET` | `/api/v1/admin/sellers` | List Sellers across all regions & managers | `requireRole("SUPER_ADMIN")` |
| `GET` | `/api/v1/admin/sellers/:id` | View detailed Seller profile | `requireRole("SUPER_ADMIN")` |
| `PATCH` | `/api/v1/admin/sellers/:id` | Update Seller details or active state | `requireRole("SUPER_ADMIN")` |

---

## 4. Request & Response Examples

### 4.1 Create Seller
```http
POST /api/v1/admin/sellers
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Amit Patil",
  "phone": "+919812345678",
  "email": "amit.patil@femmeflo.com",
  "password": "InitialSellerPassword123!",
  "managerId": "e4b17f8a-9213-4fba-bbcf-098e916a4c21",
  "state": "Maharashtra",
  "district": "Pune",
  "village": "Kothrud"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Seller created",
  "data": {
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

## 5. Source File Links

- **Route Definitions**: [admin/seller.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/admin/seller.routes.ts)
- **Controller**: [admin/seller.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/admin/seller.controller.ts)
- **Validation**: [user.validation.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/user.validation.ts)
- **Service**: [admin/seller.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/admin/seller.service.ts) and [user.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/user.service.ts)
