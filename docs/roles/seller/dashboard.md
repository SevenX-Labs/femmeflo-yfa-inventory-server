# Seller Operational Dashboard Specification

## 1. Executive Summary

The Seller Dashboard is designed for field mobile operations, giving the sales agent a concise real-time view of their daily inventory status, lifetime confirmed packet sales, remaining stock carried in hand, earned sales commission incentives, and the 5 most recent sales orders.

---

## 2. Dashboard Metrics & Data Sources

| Card / Widget | Metric Key | Source Data Calculation | Description |
| --- | --- | --- | --- |
| **Assigned Packets** | `assignedPackets` | `SUM(StockMovement.quantity)` where `destinationId = sellerLoc.id` & `type = "TRANSFER"` | Cumulative packets transferred to this seller from HQ/Warehouse |
| **Sold Packets** | `soldPackets` | `SUM(Sale.quantity)` where `sellerId = authUser.id` & `status = "CONFIRMED"` | Cumulative confirmed packet sales |
| **Remaining Packets** | `remainingPackets` | `StockLocation.balance` where `sellerId = authUser.id` | Current packets physically available to sell |
| **Total Incentive (Paise)** | `totalIncentivePaise` | `SUM(Sale.incentiveAmountPaise)` where `sellerId = authUser.id` & `status = "CONFIRMED"` | Earned commissions across all confirmed sales in Paise |
| **Total Incentive (Rupees)** | `totalIncentiveRupees` | `totalIncentivePaise / 100` | Earned commissions converted to INR |
| **Recent Sales** | `recentSales` | Last 5 orders from `Sale` table sorted by `createdAt DESC` | Instant view of the seller's recent transactions |

---

## 3. Endpoints

### Retrieve Seller Dashboard
```http
GET /api/v1/seller/dashboard
Authorization: Bearer <token>
```

#### Sample Response (200 OK)
```json
{
  "success": true,
  "message": "Seller dashboard retrieved",
  "data": {
    "metrics": {
      "assignedPackets": 500,
      "soldPackets": 420,
      "remainingPackets": 80,
      "totalIncentivePaise": 84000,
      "totalIncentiveRupees": 840.00
    },
    "recentSales": [
      {
        "id": "e932b14e-6e82-4f79-994c-8f6a9c37617b",
        "quantity": 25,
        "unitPricePaise": 2500,
        "totalPaise": 62500,
        "paymentMode": "CASH",
        "status": "CONFIRMED",
        "createdAt": "2026-04-01T15:30:00.000Z",
        "customer": {
          "id": "9d18e58a-3619-48c0-bc62-09419b4cfb11",
          "shopName": "Sai Krupa General Store",
          "contactName": "Suresh Kale"
        }
      }
    ]
  }
}
```

---

## 4. Source Files

- **Route Definitions**: [seller/dashboard.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/seller/dashboard.routes.ts)
- **Controller**: [seller/dashboard.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/seller/dashboard.controller.ts)
- **Service**: [seller/dashboard.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/seller/dashboard.service.ts)
