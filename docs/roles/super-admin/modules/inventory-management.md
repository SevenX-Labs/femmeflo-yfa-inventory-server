# Super Admin: Inventory & Stock Transfer Module

## 1. Module Purpose

Serves as the central command for physical supply chain and stock movement. Governs inventory inflow into the Headquarters (HQ) central repository, creation and oversight of regional Warehouses, execution of inter-facility stock transfers to Sellers, and audit logs of all movements.

---

## 2. Business Logic & Rules

1. **HQ Singleton Assurance**:
   - The system guarantees the existence of a central `HQ` stock location via `getOrCreateHQ()`.
2. **Stock Inflow (`RECEIPT`)**:
   - Stock receipts always credit the `HQ` location.
   - An immutable `StockMovement` of type `RECEIPT` is generated with `destinationId = hq.id`, `sourceId = null`, and `actorId = admin.id`.
3. **Atomic Stock Transfers (`TRANSFER`)**:
   - Transfers can occur between any two valid locations: `HQ → Warehouse`, `Warehouse → Seller`, `HQ → Seller`, etc.
   - The transaction asserts `source.balance >= requestedQuantity`. If insufficient, an `HttpError(409)` is thrown.
   - Source balance decrements, destination balance increments, and a `StockMovement` record of type `TRANSFER` is logged atomically.
4. **Warehouse Management**:
   - Warehouses are provisioned with unique, case-insensitive names and initialize with `balance: 0`.

---

## 3. Endpoints

| Method | Path | Summary | Auth & Guard |
| --- | --- | --- | --- |
| `GET` | `/api/v1/admin/inventory` | Complete inventory summary across HQ, Warehouses & Sellers | `requireRole("SUPER_ADMIN")` |
| `POST` | `/api/v1/admin/inventory/warehouses` | Create a regional transit Warehouse | `requireRole("SUPER_ADMIN")` |
| `GET` | `/api/v1/admin/inventory/warehouses` | List all regional Warehouses | `requireRole("SUPER_ADMIN")` |
| `POST` | `/api/v1/admin/inventory/receipts` | Record stock receipt arriving at HQ | `requireRole("SUPER_ADMIN")` |
| `POST` | `/api/v1/admin/inventory/transfers` | Execute inter-facility stock transfer | `requireRole("SUPER_ADMIN")` |
| `GET` | `/api/v1/admin/inventory/transactions` | Query complete immutable stock movement ledger | `requireRole("SUPER_ADMIN")` |

---

## 4. Request & Response Examples

### 4.1 Stock Receipt to HQ
```http
POST /api/v1/admin/inventory/receipts
Authorization: Bearer <token>
Content-Type: application/json

{
  "quantity": 10000
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Stock receipt added to HQ",
  "data": {
    "hq": {
      "id": "11111111-1111-1111-1111-111111111111",
      "type": "HQ",
      "name": "Headquarters (HQ)",
      "balance": 40000
    },
    "movement": {
      "id": "834c9802-534a-4f5a-8b83-a4c37e96b342",
      "type": "RECEIPT",
      "quantity": 10000,
      "destinationId": "11111111-1111-1111-1111-111111111111",
      "actorId": "2c62c2f6-ec89-498c-8c0c-e2f4a4bf7f09",
      "createdAt": "2026-04-01T14:00:00.000Z"
    }
  }
}
```

### 4.2 Stock Transfer (e.g., HQ to Seller)
```http
POST /api/v1/admin/inventory/transfers
Authorization: Bearer <token>
Content-Type: application/json

{
  "sourceId": "11111111-1111-1111-1111-111111111111",
  "destinationId": "77777777-7777-7777-7777-777777777777",
  "quantity": 500
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Stock transfer completed",
  "data": {
    "source": { "id": "11111111-1111-1111-1111-111111111111", "balance": 39500 },
    "destination": { "id": "77777777-7777-7777-7777-777777777777", "balance": 500 },
    "movement": {
      "id": "3e9b1102-1a42-4f91-8173-98fe871b6540",
      "type": "TRANSFER",
      "quantity": 500,
      "sourceId": "11111111-1111-1111-1111-111111111111",
      "destinationId": "77777777-7777-7777-7777-777777777777",
      "actorId": "2c62c2f6-ec89-498c-8c0c-e2f4a4bf7f09"
    }
  }
}
```

---

## 5. Source File Links

- **Route Definitions**: [admin/inventory.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/admin/inventory.routes.ts)
- **Controller**: [admin/inventory.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/admin/inventory.controller.ts)
- **Validation**: [inventory.validation.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/inventory.validation.ts)
- **Service**: [admin/inventory.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/admin/inventory.service.ts)
