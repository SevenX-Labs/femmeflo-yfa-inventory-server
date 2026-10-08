# Shared Platform Feature: Common Architecture & Utilities

## 1. Standard Response Envelope

All API endpoints return JSON conforming to a standardized response contract:

### 1.1 Success Response Contract
```json
{
  "success": true,
  "message": "Human-readable confirmation message",
  "data": { ... }
}
```

### 1.2 Error Response Contract
```json
{
  "success": false,
  "message": "Descriptive error message",
  "data": { ... } // Optional error details
}
```

---

## 2. Standard Pagination Structure

List endpoints enforce standard pagination defaults:
- `page`: Integer >= 1 (Default: `1`)
- `pageSize`: Integer >= 1, <= 100 (Default: `20`)

### Output Structure:
```json
{
  "items": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

## 3. Date Range Filter Convention

Temporal endpoints (sales, reporting) use the `period` query parameter or explicit ISO dates:

| Parameter Value | Date Calculation |
| --- | --- |
| `this_month` | From `Date.UTC(year, month, 1, 0:00:00)` to present |
| `last_month` | From `Date.UTC(year, month - 1, 1, 0:00:00)` to `Date.UTC(year, month, 0, 23:59:59.999)` |
| `all` | Full chronological history |
| `from` / `to` | Explicit ISO dates. If `to` lacks time, set to `23:59:59.999`. |

Source implementation: [getPeriodDateRange](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/seller/sales.service.ts#L7).

---

## 4. Export Utilities (CSV & Excel XLSX)

Reporting endpoints support streaming and buffer-based data exports:
1. **RFC 4180 CSV**: Generated via `arrayToCsv(headers, rows)` in [export.utils.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/utils/export.utils.ts), correctly handling quotes, line breaks, and commas.
2. **Microsoft Excel (XLSX)**: Generated via `createExcelWorkbookBuffer({ sheetName, columns, rows })` using the `exceljs` library. Supports custom column widths, bold headers, and typed numbers.

---

## 5. Invoice PDF Generation Engine

PDFs are rendered dynamically via `PDFKit`:
- Source: [pdf.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/pdf.service.ts).
- Renders order summary, shop details, seller details, item table, and amounts in INR.
- Persists to `public/storage/invoices/{year}/{month}/{invoiceNumber}.pdf`.
- Idempotency guard prevents duplicate renders if `pdfPath` already exists.

---

## 6. Service Health & Readiness Probes

| Endpoint | Method | Purpose | Response |
| --- | --- | --- | --- |
| `/api/v1/health` | `GET` | Container liveness check | `200 OK` (`{ status: "ok", database: "configured" }`) |
| `/api/v1/ready` | `GET` | Database readiness probe (`SELECT 1`) | `200 OK` (`{ database: "connected" }`) or `503 Service Unavailable` |
