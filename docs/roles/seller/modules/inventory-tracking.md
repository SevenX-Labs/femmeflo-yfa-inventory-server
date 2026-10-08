# Seller: Inventory & Transaction Tracking Module

## 1. Module Purpose

Provides field Sellers with real-time tracking of their assigned physical stock, including total packets received via transfers, total packets confirmed sold, current packet balance on hand, and an audit ledger of all stock transactions.

---

## 2. Business Logic & Calculations

1. **Auto-Provisioning**:
   - If a Seller queries inventory and no `StockLocation` is attached, the system auto-creates a location of `type: "SELLER"` with `name: "{seller.name} Stock"` and `balance: 0`.
2. **Real-Time Balance & Aggregations**:
   - `assigned`: `SUM(StockMovement.quantity)` where `destinationId = location.id` and `type = "TRANSFER"`.
   - `sold`: `SUM(Sale.quantity)` where `sellerId = authUser.id` and `status = "CONFIRMED"`.
   - `remaining`: Real-time integer balance from `StockLocation.balance`.
3. **Transaction History**:
   - Returns all immutable `StockMovement` entries where either `sourceId = location.id` (sales deductions) or `destinationId = location.id` (transfers received from HQ/warehouse).

---

## 3. Endpoints

| Method | Path | Summary | Auth & Guard |
| --- | --- | --- | --- |
| `GET` | `/api/v1/seller/inventory` | View current packet balance, assigned & sold counts | `requireRole("SELLER")` |
| `GET` | `/api/v1/seller/inventory/transactions` | Query personal stock movement transaction ledger | `requireRole("SELLER")` |

---

## 4. Request & Response Examples

### 4.1 Check Personal Stock
```http
GET /api/v1/seller/inventory
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Inventory retrieved",
  "data": {
    "locationId": "77777777-7777-7777-7777-777777777777",
    "name": "Amit Patil Stock",
    "assigned": 500,
    "sold": 420,
    "remaining": 80
  }
}
```

### 4.2 Query Transaction History
```http
GET /api/v1/seller/inventory/transactions?page=1&pageSize=20&type=TRANSFER
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Transactions retrieved",
  "data": {
    "items": [
      {
        "id": "3e9b1102-1a42-4f91-8173-98fe871b6540",
        "type": "TRANSFER",
        "quantity": 500,
        "createdAt": "2026-04-01T14:15:00.000Z",
        "source": {
          "id": "11111111-1111-1111-1111-111111111111",
          "name": "Headquarters (HQ)",
          "type": "HQ"
        },
        "destination": {
          "id": "77777777-7777-7777-7777-777777777777",
          "name": "Amit Patil Stock",
          "type": "SELLER"
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

- **Route Definitions**: [seller/inventory.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/seller/inventory.routes.ts)
- **Controller**: [seller/inventory.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/seller/inventory.controller.ts)
- **Validation**: [inventory.validation.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/inventory.validation.ts)
- **Service**: [seller/inventory.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/seller/inventory.service.ts)
