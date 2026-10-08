# Seller: Incentive & Commission Tracking Module

## 1. Module Purpose

Allows field Sellers to monitor their sales commissions in real time. Provides an itemized list of all confirmed sales, the exact commission rate locked at the time of order confirmation, total packets sold, and cumulative earnings in both Paise and Indian Rupees (INR).

---

## 2. Business Logic & Calculations

1. **Confirmed Sales Only**:
   - Incentives are only earned on sales with `status = "CONFIRMED"`. Orders with `status = "PENDING_APPROVAL"` or `status = "REJECTED"` contribute zero incentive.
2. **Locked Snapshot Rate**:
   - For every confirmed sale, `Sale.incentiveRatePaise` and `Sale.incentiveAmountPaise` store the immutable snapshot determined at confirmation.
   - Example: 50 packets confirmed at 200 Paise/packet yields 10,000 Paise (₹100.00).
3. **Paise to Rupees Conversion**:
   - `totalIncentiveRupees = totalIncentivePaise / 100`.

---

## 3. Endpoints

| Method | Path | Summary | Auth & Guard |
| --- | --- | --- | --- |
| `GET` | `/api/v1/seller/incentives` | Retrieve seller's incentive earnings & itemized sales breakdown | `requireRole("SELLER")` |

---

## 4. Request & Response Examples

### Query Personal Incentives
```http
GET /api/v1/seller/incentives
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Incentives retrieved",
  "data": {
    "summary": {
      "totalPacketsSold": 420,
      "totalIncentivePaise": 84000,
      "totalIncentiveRupees": 840.00
    },
    "items": [
      {
        "saleId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        "date": "2026-04-01T16:30:00.000Z",
        "quantity": 50,
        "incentiveRatePaise": 200,
        "incentiveAmountPaise": 10000,
        "customer": {
          "id": "e2c3b4d5-6a7b-8c9d-0e1f-2a3b4c5d6e7f",
          "shopName": "Mahalaxmi Provision Store",
          "contactName": "Ramesh Jadhav"
        }
      }
    ]
  }
}
```

---

## 5. Source File Links

- **Route Definitions**: [seller/incentive.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/seller/incentive.routes.ts)
- **Controller**: [seller/incentive.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/seller/incentive.controller.ts)
- **Service**: [seller/incentive.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/seller/incentive.service.ts)
