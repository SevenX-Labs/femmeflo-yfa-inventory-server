# Super Admin: Customer / Shop Management Module

## 1. Module Purpose

Provides the Super Admin with complete operational oversight and write capabilities for all retail Customer / Shop accounts across all geographical regions, categories, and seller assignments.

---

## 2. Business Logic & Rules

1. **Global Scope**:
   - Unlike Managers and Sellers whose visibility is constrained by territory or personal ID, Super Admins can search, list, view, and update any Customer entity system-wide.
2. **Category Validation**:
   - `categoryId` must reference an active, existing `Category` record.
3. **Seller Assignment & Reassignment**:
   - Super Admins can assign a newly onboarded Customer to any active `SELLER`.
   - Super Admins can freely reassign an existing Customer from one Seller to another across any territory or manager.
4. **GPS Coordinates & Storefront Imagery**:
   - Supports storing high-precision shop GPS coordinates (`latitude`, `longitude` with `Decimal(9, 6)`) and storefront image paths (`photoPath`).

---

## 3. Endpoints

| Method | Path | Summary | Auth & Guard |
| --- | --- | --- | --- |
| `POST` | `/api/v1/admin/customers` | Onboard customer assigned to any active seller | `requireRole("SUPER_ADMIN")` |
| `GET` | `/api/v1/admin/customers` | Global search & list with multi-filtering | `requireRole("SUPER_ADMIN")` |
| `GET` | `/api/v1/admin/customers/:id` | View Customer details and assigned Seller | `requireRole("SUPER_ADMIN")` |
| `PATCH` | `/api/v1/admin/customers/:id` | Update Customer profile or reassign Seller | `requireRole("SUPER_ADMIN")` |

---

## 4. Request & Response Examples

### 4.1 Onboard Customer
```http
POST /api/v1/admin/customers
Authorization: Bearer <token>
Content-Type: application/json

{
  "shopName": "Sai Krupa General Store",
  "contactName": "Suresh Kale",
  "phone": "+919765432109",
  "email": "saikrupa@example.com",
  "categoryId": "7a3a91e4-f3a7-47b1-9122-1b11e2f6946d",
  "sellerId": "c1f7b889-13da-4a11-8fcb-2e92c2cb9842",
  "state": "Maharashtra",
  "district": "Pune",
  "village": "Kothrud",
  "latitude": 18.507400,
  "longitude": 73.807700
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Customer created",
  "data": {
    "customer": {
      "id": "9d18e58a-3619-48c0-bc62-09419b4cfb11",
      "shopName": "Sai Krupa General Store",
      "contactName": "Suresh Kale",
      "phone": "+919765432109",
      "email": "saikrupa@example.com",
      "state": "Maharashtra",
      "district": "Pune",
      "village": "Kothrud",
      "active": true,
      "category": { "id": "7a3a91e4-f3a7-47b1-9122-1b11e2f6946d", "name": "General Store" },
      "seller": { "id": "c1f7b889-13da-4a11-8fcb-2e92c2cb9842", "name": "Amit Patil", "phone": "+919812345678" }
    }
  }
}
```

---

## 5. Source File Links

- **Route Definitions**: [admin/customer.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/admin/customer.routes.ts)
- **Controller**: [customer.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/customer.controller.ts)
- **Validation**: [customer.validation.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/customer.validation.ts)
- **Service**: [customer.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/customer.service.ts)
