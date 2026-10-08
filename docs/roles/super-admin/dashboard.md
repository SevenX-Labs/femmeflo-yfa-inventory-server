# Super Admin Dashboard Specification

## 1. Executive Summary

The Super Admin Dashboard provides centralized, real-time KPI metrics aggregating sales performance, total revenue, physical inventory distribution, and organizational coverage across the entire enterprise. It features a multi-criteria filter engine allowing administrators to slice data across geographical boundaries, management hierarchies, and product categories.

---

## 2. Metrics & Widgets

| Widget / Card | Metric Code | Source Data Calculation | Description |
| --- | --- | --- | --- |
| **Total Packets Sold** | `totalPacketsSold` | `SUM(Sale.quantity)` where `status = "CONFIRMED"` | Total inventory packets sold across all regions |
| **Gross Revenue (Paise)** | `totalEarningsPaise` | `SUM(Sale.totalPaise)` where `status = "CONFIRMED"` | Total gross revenue collected in integer Paise |
| **Gross Revenue (Rupees)** | `totalEarningsRupees` | `totalEarningsPaise / 100` | Revenue converted to INR |
| **States Covered** | `totalStates` | Distinct `Customer.state` count where `active = true` | Number of unique states with active retail shops |
| **Retail Shops** | `totalShops` | `COUNT(Customer)` where `active = true` | Total active onboarded customer shops |
| **Active Managers** | `totalManagers` | `COUNT(User)` where `role = "MANAGER"` & `active = true` | Regional managers actively managing field teams |
| **Active Sellers** | `totalSellers` | `COUNT(User)` where `role = "SELLER"` & `active = true` | Field sales agents active in the field |
| **Total System Stock** | `totalInventory` | `SUM(StockLocation.balance)` across all locations | Combined stock across HQ, warehouses, and sellers |
| **HQ Balance** | `hqStock` | `StockLocation.balance` where `type = "HQ"` | Current reserve stock held at Headquarters |
| **Warehouse Balance** | `warehouseStock` | `SUM(StockLocation.balance)` where `type = "WAREHOUSE"` | Stock staged at regional transit warehouses |
| **Field Seller Stock** | `sellerStock` | `SUM(StockLocation.balance)` where `type = "SELLER"` | Hand-carried inventory held by active sellers |
| **Incentive Liability (Paise)** | `totalIncentivePaise` | `SUM(Sale.incentiveAmountPaise)` where `status = "CONFIRMED"` | Accrued commissions owed/earned by sellers |
| **Incentive Liability (Rupees)** | `totalIncentiveRupees` | `totalIncentivePaise / 100` | Commission total converted to INR |

---

## 3. API Endpoints

### 3.1 Retrieve Dashboard Metrics
```http
GET /api/v1/admin/dashboard
Authorization: Bearer <token>
```

#### Query Parameters (All Optional for Dynamic Slicing):
- `state`: String (e.g. `Maharashtra`)
- `district`: String (e.g. `Pune`)
- `village`: String (e.g. `Kothrud`)
- `categoryId`: UUID (Filter by shop category)
- `managerId`: UUID (Filter by specific Manager's hierarchy)
- `sellerId`: UUID (Filter by specific Seller)

#### Sample Response (200 OK)
```json
{
  "success": true,
  "message": "Super Admin dashboard retrieved",
  "data": {
    "metrics": {
      "totalPacketsSold": 14250,
      "totalEarningsPaise": 35625000,
      "totalEarningsRupees": 356250.00,
      "totalStates": 4,
      "totalShops": 850,
      "totalManagers": 8,
      "totalSellers": 45,
      "totalInventory": 50000,
      "hqStock": 30000,
      "warehouseStock": 15000,
      "sellerStock": 5000,
      "totalIncentivePaise": 2850000,
      "totalIncentiveRupees": 28500.00
    },
    "appliedFilters": {
      "state": "Maharashtra"
    }
  }
}
```

### 3.2 Retrieve Filter Options Metadata
Provides distinct populated territories and active categories to populate frontend dropdown selects:

```http
GET /api/v1/admin/dashboard/filters
Authorization: Bearer <token>
```

#### Sample Response (200 OK)
```json
{
  "success": true,
  "message": "Filter options retrieved",
  "data": {
    "categories": [
      { "id": "4b6e5e79-6b5c-4d22-83b6-16f5c50c0297", "name": "Pharmacy" },
      { "id": "7a3a91e4-f3a7-47b1-9122-1b11e2f6946d", "name": "General Store" }
    ],
    "states": ["Maharashtra", "Gujarat", "Karnataka"],
    "districts": ["Pune", "Nagpur", "Ahmedabad", "Bengaluru"]
  }
}
```

---

## 4. Source Files

- **Routes**: [dashboard.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/admin/dashboard.routes.ts)
- **Controller**: [dashboard.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/admin/dashboard.controller.ts)
- **Validation**: [dashboard.validation.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/dashboard.validation.ts)
- **Service**: [dashboard.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/admin/dashboard.service.ts)
