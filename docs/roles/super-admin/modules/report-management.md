# Super Admin: Reports & Analytics Module

## 1. Module Purpose

Empowers the Super Admin to analyze performance across the entire business through multidimensional reporting engines:
1. **Sales Report Engine**: Aggregate order count, total packets sold, gross and net sales, average order value, with dynamic grouping by Date, Seller, Manager, State, District, or Village.
2. **Inventory Report Engine**: Real-time stock distribution across HQ, Warehouses, and Sellers, plus aggregated inflows (`RECEIPT`), transfers (`TRANSFER`), and customer sales (`SALE`).
3. **Multi-Format Export**: Generates raw `JSON`, RFC-4180 compliant `CSV`, or styled multi-column `XLSX` (Excel) spreadsheets.

---

## 2. Business Logic & Query Capabilities

### 2.1 Sales Reports
- **Filters**:
  - `from` and `to`: ISO date strings. If `to` is a date only (e.g., `2026-04-30`), time is adjusted to `23:59:59.999`.
  - `status`: Default is `CONFIRMED`. Can query `PENDING_APPROVAL` or `REJECTED`.
  - `paymentMode`: `CASH`, `BANK`, `PENDING`.
  - `sellerId`, `managerId`, `state`, `district`, `village`.
  - `groupBy`: `date`, `seller`, `manager`, `state`, `district`, `village`.
  - `format`: `json` (limit 500 items), `csv` (limit 5000 items), `xlsx` (limit 5000 items).

### 2.2 Inventory Reports
- **Filters**:
  - `from` and `to`: Historical movement window.
  - `locationId`: Specific facility or seller.
  - `type`: Facility category (`HQ`, `WAREHOUSE`, `SELLER`).
  - `format`: `json`, `csv`, `xlsx`.

---

## 3. Endpoints

| Method | Path | Summary | Auth & Guard |
| --- | --- | --- | --- |
| `GET` | `/api/v1/admin/reports/sales` | Generate Sales Report (JSON, CSV, or XLSX) | `requireRole("SUPER_ADMIN")` |
| `GET` | `/api/v1/admin/reports/inventory` | Generate Inventory Report (JSON, CSV, or XLSX) | `requireRole("SUPER_ADMIN")` |

---

## 4. Request & Response Examples

### 4.1 Sales Report in JSON with Grouping
```http
GET /api/v1/admin/reports/sales?from=2026-04-01&to=2026-04-30&groupBy=state&format=json
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Sales report retrieved",
  "data": {
    "summary": {
      "totalSalesCount": 150,
      "totalQuantitySold": 15000,
      "grossSalesPaise": 37500000,
      "grossSalesRupees": 375000.00,
      "netSalesPaise": 37500000,
      "netSalesRupees": 375000.00,
      "averageOrderValueRupees": 2500.00
    },
    "groups": [
      {
        "label": "Maharashtra",
        "count": 100,
        "quantity": 10000,
        "totalPaise": 25000000
      },
      {
        "label": "Gujarat",
        "count": 50,
        "quantity": 5000,
        "totalPaise": 12500000
      }
    ],
    "items": [ ... ]
  }
}
```

### 4.2 Sales Report in Excel (XLSX) Format
```http
GET /api/v1/admin/reports/sales?from=2026-04-01&to=2026-04-30&format=xlsx
Authorization: Bearer <token>
```

#### Response (200 OK)
- **Headers**:
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename="sales-report.xlsx"`
- **Body**: Binary XLSX stream with auto-formatted column headers, numeric widths, and totals.

---

## 5. Source File Links

- **Route Definitions**: [admin/report.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/admin/report.routes.ts)
- **Controller**: [admin/report.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/admin/report.controller.ts)
- **Validation**: [report.validation.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/report.validation.ts)
- **Service**: [admin/report.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/admin/report.service.ts)
- **Export Utilities**: [export.utils.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/utils/export.utils.ts)
