# Super Admin: Sales Oversight Module

## 1. Module Purpose

Provides global visibility across all sales orders created by field Sellers, allowing Super Admins to audit transactions, monitor pricing, review payment modes (`CASH`, `BANK`, `PENDING`), inspect linked invoices, and track order lifecycles.

---

## 2. Business Logic & Query Capabilities

1. **Global Unrestricted Scope**:
   - Super Admins can list and search sales across any seller, customer, status, or date period.
2. **Filter Parameters**:
   - `status`: Filter by `PENDING_APPROVAL`, `CONFIRMED`, `REJECTED`.
   - `paymentMode`: Filter by `CASH`, `BANK`, `PENDING`.
   - `sellerId`: Filter by a particular sales agent.
   - `customerId`: Filter by target retail shop.
   - `period`: Dynamic temporal boundaries (`this_month`, `last_month`, `all`).
   - `search`: Case-insensitive substring matching against `Customer.shopName`, `Customer.contactName`, or `Seller.name`.
3. **Relationship Hydration**:
   - Query responses include embedded customer contact/geography details, seller information, and invoice numbers.

---

## 3. Endpoints

| Method | Path | Summary | Auth & Guard |
| --- | --- | --- | --- |
| `GET` | `/api/v1/admin/sales` | List all sales orders with pagination & filters | `requireRole("SUPER_ADMIN")` |
| `GET` | `/api/v1/admin/sales/:id` | View detailed sale record with invoice & payments | `requireRole("SUPER_ADMIN")` |

---

## 4. Request & Response Examples

### 4.1 List Sales
```http
GET /api/v1/admin/sales?page=1&pageSize=20&period=this_month&status=CONFIRMED
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Sales records retrieved",
  "data": {
    "items": [
      {
        "id": "e932b14e-6e82-4f79-994c-8f6a9c37617b",
        "quantity": 100,
        "unitPricePaise": 2500,
        "totalPaise": 250000,
        "paymentMode": "CASH",
        "status": "CONFIRMED",
        "createdAt": "2026-04-01T15:30:00.000Z",
        "customer": {
          "id": "9d18e58a-3619-48c0-bc62-09419b4cfb11",
          "shopName": "Sai Krupa General Store",
          "contactName": "Suresh Kale",
          "phone": "+919765432109",
          "state": "Maharashtra",
          "district": "Pune",
          "village": "Kothrud"
        },
        "seller": {
          "id": "c1f7b889-13da-4a11-8fcb-2e92c2cb9842",
          "name": "Amit Patil",
          "phone": "+919812345678"
        },
        "invoice": {
          "id": "f512c110-8271-460d-8351-4091a0397701",
          "number": "INV-1712571200000-482"
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

---

## 5. Source File Links

- **Route Definitions**: [admin/sales.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/admin/sales.routes.ts)
- **Controller**: [admin/sales.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/admin/sales.controller.ts)
- **Validation**: [sales.validation.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/sales.validation.ts)
- **Service**: [admin/sales.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/admin/sales.service.ts)
