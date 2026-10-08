# Super Admin: Incentive & Business Settings Module

## 1. Module Purpose

Allows the Super Admin to govern company-wide commercial policies:
1. **Commission / Incentive Rate**: Rate per packet in Paise credited to field Sellers upon sale confirmation.
2. **Minimum Price Threshold**: Price floor in Paise below which sales trigger the low-price approval workflow.
3. **Incentive Audit**: Global breakdown of seller earnings and confirmed packet tallies.

---

## 2. Business Logic & Invariants

1. **Singleton Configuration**:
   - Settings are stored in `BusinessSettings` with a fixed `id = 1`.
   - Default values if not explicitly set: `minimumPricePaise = 2500` (₹25.00), `incentiveRatePaise = null`.
2. **Incentive Snapshot Rule**:
   - When a sale is confirmed (instantly or via admin approval), the currently active `incentiveRatePaise` from `BusinessSettings` is copied as an **immutable snapshot** into `Sale.incentiveRatePaise` and `Sale.incentiveAmountPaise`.
   - **Crucial Invariant**: Subsequent adjustments to the global incentive rate do **not** retroactively alter previously confirmed sales or their paid commissions.
3. **Paise Accuracy**:
   - `200` Paise = ₹2.00 commission per packet.
   - For an order of 150 packets, incentive is `150 * 200 = 30000 Paise` (₹300.00).

---

## 3. Endpoints

| Method | Path | Summary | Auth & Guard |
| --- | --- | --- | --- |
| `GET` | `/api/v1/admin/incentives` | Seller-wise incentive audit report | `requireRole("SUPER_ADMIN")` |
| `GET` | `/api/v1/admin/incentives/settings` | Read current `BusinessSettings` | `requireRole("SUPER_ADMIN")` |
| `PATCH` | `/api/v1/admin/incentives/settings` | Update minimum price floor or incentive rate | `requireRole("SUPER_ADMIN")` |

---

## 4. Request & Response Examples

### 4.1 Update Business Settings
```http
PATCH /api/v1/admin/incentives/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "incentiveRatePaise": 200,
  "minimumPricePaise": 2500
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Business settings updated",
  "data": {
    "settings": {
      "id": 1,
      "minimumPricePaise": 2500,
      "incentiveRatePaise": 200,
      "updatedAt": "2026-04-01T17:00:00.000Z"
    }
  }
}
```

### 4.2 Retrieve Incentive Audit Report
```http
GET /api/v1/admin/incentives
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Incentive reports retrieved",
  "data": {
    "currentRatePaise": 200,
    "sellers": [
      {
        "seller": {
          "id": "c1f7b889-13da-4a11-8fcb-2e92c2cb9842",
          "name": "Amit Patil",
          "phone": "+919812345678"
        },
        "totalConfirmedPackets": 2500,
        "totalIncentivePaise": 500000,
        "totalIncentiveRupees": 5000.00
      }
    ]
  }
}
```

---

## 5. Source File Links

- **Route Definitions**: [admin/incentive.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/admin/incentive.routes.ts)
- **Controller**: [admin/incentive.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/admin/incentive.controller.ts)
- **Validation**: [incentive.validation.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/incentive.validation.ts)
- **Service**: [admin/incentive.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/admin/incentive.service.ts)
