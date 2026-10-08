# Super Admin: Invoice & Billing Audit Module

## 1. Module Purpose

Manages legal sales invoices generated upon order confirmation. Every confirmed sale automatically produces an immutable point-in-time JSON snapshot in the database and triggers asynchronous PDF rendering to server storage. Super Admins can audit invoice histories, search by invoice reference or shop name, and retrieve PDF paths.

---

## 2. Invoicing Structure & PDF Workflow

1. **Unique Number Generation**:
   - Sequential format: `INV-{timestamp}-{randomInt}` (e.g., `INV-1712572800000-819`).
2. **Snapshot Immutability**:
   - The `snapshot` JSON column stores all relevant order details (customer shop name, contact name, full territory, seller name, quantity, unit price in paise, total in paise, payment mode) at the exact moment of sale confirmation.
   - Future customer edits or seller reassignments do not alter past invoice snapshots.
3. **PDF Generation via PDFKit**:
   - Stored on disk under `public/storage/invoices/{year}/{month}/{invoiceNumber}.pdf`.
   - Exposed via relative path `/storage/invoices/{year}/{month}/{invoiceNumber}.pdf`.
   - Idempotent: If `invoice.pdfPath` already exists, regeneration is bypassed.

---

## 3. Endpoints

| Method | Path | Summary | Auth & Guard |
| --- | --- | --- | --- |
| `GET` | `/api/v1/admin/invoices` | List invoices with pagination and search | `requireRole("SUPER_ADMIN")` |
| `GET` | `/api/v1/admin/invoices/:id` | View invoice details, snapshot, and payments | `requireRole("SUPER_ADMIN")` |

---

## 4. Request & Response Examples

### 4.1 List Invoices
```http
GET /api/v1/admin/invoices?page=1&pageSize=20&search=Sai+Krupa
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Invoices retrieved",
  "data": {
    "items": [
      {
        "id": "f512c110-8271-460d-8351-4091a0397701",
        "number": "INV-1712572800000-819",
        "createdAt": "2026-04-01T16:00:00.000Z",
        "sale": {
          "id": "e932b14e-6e82-4f79-994c-8f6a9c37617b",
          "quantity": 100,
          "totalPaise": 220000,
          "paymentMode": "CASH",
          "customer": {
            "id": "9d18e58a-3619-48c0-bc62-09419b4cfb11",
            "shopName": "Sai Krupa General Store",
            "contactName": "Suresh Kale"
          },
          "seller": {
            "id": "c1f7b889-13da-4a11-8fcb-2e92c2cb9842",
            "name": "Amit Patil"
          }
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

- **Route Definitions**: [admin/invoice.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/admin/invoice.routes.ts)
- **Controller**: [admin/invoice.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/admin/invoice.controller.ts)
- **Service**: [admin/invoice.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/admin/invoice.service.ts)
- **PDF Engine**: [pdf.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/pdf.service.ts)
