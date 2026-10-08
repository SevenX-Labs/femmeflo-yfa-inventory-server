# Manager Dashboard Specification

## 1. Executive Summary

The Manager Dashboard delivers focused regional metrics summarizing field operations for the Manager's direct reporting hierarchy and geographic territory. It provides instant visibility into team size, onboarded customer shops, packet sales volume, regional revenue, and real-time inventory remaining in the field.

---

## 2. Metrics & KPI Summary

All data returned by the Manager Dashboard is strictly scoped to sellers assigned to the authenticated Manager (`seller.managerId = authUser.id`) and filtered by the Manager's territory (`state`, `district`).

| Metric | Property | Source Calculation | Description |
| --- | --- | --- | --- |
| **Total Sellers** | `totalSellers` | `COUNT(User)` where `managerId = authUser.id` and `active = true` | Active sales agents reporting to this Manager |
| **Total Customers** | `totalCustomers` | `COUNT(Customer)` where `seller.managerId = authUser.id` | Total retail shops onboarded by or assigned to reporting sellers |
| **Packets Sold** | `totalPacketsSold` | `SUM(Sale.quantity)` where `seller.managerId = authUser.id` & `status = "CONFIRMED"` | Confirmed sales volume delivered to shops in this region |
| **Regional Revenue (Paise)** | `totalEarningsPaise` | `SUM(Sale.totalPaise)` where `seller.managerId = authUser.id` & `status = "CONFIRMED"` | Gross regional earnings collected in Paise |
| **Regional Revenue (Rupees)** | `totalEarningsRupees` | `totalEarningsPaise / 100` | Gross regional earnings converted to INR |
| **Field Stock Remaining** | `totalRemainingStock` | `SUM(StockLocation.balance)` across reporting sellers | Physical packets currently carried by sellers in the field |

---

## 3. Endpoints

### Retrieve Manager Dashboard
```http
GET /api/v1/manager/dashboard
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Manager dashboard retrieved",
  "data": {
    "metrics": {
      "totalSellers": 6,
      "totalCustomers": 120,
      "totalPacketsSold": 3200,
      "totalEarningsPaise": 8000000,
      "totalEarningsRupees": 80000.00,
      "totalRemainingStock": 800
    }
  }
}
```

---

## 4. Source Files

- **Route Definitions**: [manager/dashboard.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/manager/dashboard.routes.ts)
- **Controller**: [manager/dashboard.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/manager/dashboard.controller.ts)
- **Service**: [manager/dashboard.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/manager/dashboard.service.ts)
