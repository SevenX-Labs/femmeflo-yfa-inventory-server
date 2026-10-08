# Manager: Inventory Monitoring Module

## 1. Module Purpose

Provides Regional Managers with aggregate and seller-by-seller operational inventory oversight. Allows managers to track how many packets have been assigned/transferred to each reporting seller, how many packets have been confirmed sold, and how many remain physically in field stock.

---

## 2. Business Logic & Calculations

For each reporting Seller, the service computes:
1. **Assigned Packets (`assigned`)**:
   - `SUM(StockMovement.quantity)` where `destinationId = seller.stockLocation.id` and `type = "TRANSFER"`.
2. **Confirmed Sold Packets (`sold`)**:
   - `SUM(Sale.quantity)` where `sellerId = seller.id` and `status = "CONFIRMED"`.
3. **Current Field Stock (`remaining`)**:
   - Live balance directly from `seller.stockLocation.balance`.
4. **Regional Summary**:
   - Aggregates `totalSellers`, `totalAssigned`, `totalSold`, and `totalRemaining` across all reporting sellers.

---

## 3. Endpoints

| Method | Path | Summary | Auth & Guard |
| --- | --- | --- | --- |
| `GET` | `/api/v1/manager/inventory` | Aggregate regional inventory summary across sellers | `requireRole("MANAGER")` |

---

## 4. Request & Response Examples

### Query Regional Inventory
```http
GET /api/v1/manager/inventory
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Assigned inventory summary retrieved",
  "data": {
    "summary": {
      "totalSellers": 2,
      "totalAssigned": 1200,
      "totalSold": 950,
      "totalRemaining": 250
    },
    "sellers": [
      {
        "seller": {
          "id": "7fa1209b-6e94-4f2b-b4a1-0268a731ef19",
          "name": "Kiran Deshmukh",
          "phone": "+919822334455",
          "state": "Maharashtra",
          "district": "Pune",
          "village": "Shivajinagar"
        },
        "assigned": 600,
        "sold": 500,
        "remaining": 100
      },
      {
        "seller": {
          "id": "c1f7b889-13da-4a11-8fcb-2e92c2cb9842",
          "name": "Amit Patil",
          "phone": "+919812345678",
          "state": "Maharashtra",
          "district": "Pune",
          "village": "Kothrud"
        },
        "assigned": 600,
        "sold": 450,
        "remaining": 150
      }
    ]
  }
}
```

---

## 5. Source File Links

- **Route Definitions**: [manager/inventory.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/manager/inventory.routes.ts)
- **Controller**: [manager/inventory.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/manager/inventory.controller.ts)
- **Service**: [manager/inventory.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/manager/inventory.service.ts)
