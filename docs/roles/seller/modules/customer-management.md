# Seller: Customer Management Module

## 1. Module Purpose

Enables field Sellers to discover, onboard, and maintain relationships with local retail shops and merchants in their assigned territory. Every shop onboarded by a Seller is automatically bound to that Seller.

---

## 2. Business Logic & Invariants

1. **Automatic Seller Ownership**:
   - When a Seller creates a customer via `POST /api/v1/seller/customers`, the system automatically assigns `assignedSellerId = authUser.id` and `createdById = authUser.id`. The client cannot pass a different `sellerId`.
2. **Category Validation**:
   - `categoryId` must reference an active, valid `Category`.
3. **Territory Capture**:
   - Captures `state`, `district`, `village`, contact person, and phone number.
   - Allows capturing GPS coordinates (`latitude`, `longitude`) and shop storefront image paths (`photoPath`).
4. **No Ownership Reassignment**:
   - Sellers can update contact details or shop photos, but cannot transfer shop ownership to other sellers (`HttpError(403, "Sellers cannot reassign customer ownership")`).
5. **Self-Scoping on Listing & Detail**:
   - `where.sellerId = authUser.id`. Querying another seller's customer returns `404 Not Found or outside assigned scope`.

---

## 3. Endpoints

| Method | Path | Summary | Auth & Guard |
| --- | --- | --- | --- |
| `POST` | `/api/v1/seller/customers` | Onboard a new customer shop | `requireRole("SELLER")` |
| `GET` | `/api/v1/seller/customers` | List own customers with search & pagination | `requireRole("SELLER")` |
| `GET` | `/api/v1/seller/customers/:id` | View customer shop details | `requireRole("SELLER")` |
| `PATCH` | `/api/v1/seller/customers/:id` | Update customer shop details | `requireRole("SELLER")` |

---

## 4. Request & Response Examples

### Onboard Customer
```http
POST /api/v1/seller/customers
Authorization: Bearer <token>
Content-Type: application/json

{
  "shopName": "Mahalaxmi Provision Store",
  "contactName": "Ramesh Jadhav",
  "phone": "+919855667788",
  "categoryId": "7a3a91e4-f3a7-47b1-9122-1b11e2f6946d",
  "state": "Maharashtra",
  "district": "Pune",
  "village": "Kothrud",
  "latitude": 18.508200,
  "longitude": 73.809100
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Customer created",
  "data": {
    "customer": {
      "id": "e2c3b4d5-6a7b-8c9d-0e1f-2a3b4c5d6e7f",
      "shopName": "Mahalaxmi Provision Store",
      "contactName": "Ramesh Jadhav",
      "phone": "+919855667788",
      "state": "Maharashtra",
      "district": "Pune",
      "village": "Kothrud",
      "active": true,
      "category": { "id": "7a3a91e4-f3a7-47b1-9122-1b11e2f6946d", "name": "General Store" },
      "seller": { "id": "c1f7b889-13da-4a11-8fcb-2e92c2cb9842", "name": "Amit Patil" }
    }
  }
}
```

---

## 5. Source File Links

- **Route Definitions**: [seller/customer.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/seller/customer.routes.ts)
- **Controller**: [customer.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/customer.controller.ts)
- **Validation**: [customer.validation.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/customer.validation.ts)
- **Service**: [customer.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/customer.service.ts)
