# Manager: Seller Onboarding Module

## 1. Module Purpose

Allows Regional Managers to recruit, onboard, and review field Sellers reporting directly under their management structure. Automatically enforces territorial confinement and provisions physical inventory points.

---

## 2. Business Logic & Security Enforcements

1. **Permission Check**:
   - Creating a seller requires `SELLER_CREATE`.
   - Listing and retrieving sellers requires `SELLER_READ`.
2. **Automatic Hierarchy Binding**:
   - The onboarding request automatically binds `managerId: manager.id`. The client cannot specify or override the target `managerId`.
3. **Territory Inheritance & Confinement**:
   - If the Manager is assigned to `Pune`, any seller created by this Manager must either omit territory (inheriting `Pune`) or specify a sub-locality strictly within `Pune`. Specifying an outside territory triggers `HttpError(403, "Seller territory must be within the assigned Manager's territory")`.
4. **Stock Location Provisioning**:
   - During creation, an atomic transaction inserts a linked `StockLocation` of type `SELLER` with `balance: 0`.

---

## 3. Endpoints

| Method | Path | Summary | Guard / Permission |
| --- | --- | --- | --- |
| `POST` | `/api/v1/manager/sellers` | Onboard a new Seller under this Manager | `SELLER_CREATE` |
| `GET` | `/api/v1/manager/sellers` | List reporting Sellers | `SELLER_READ` |
| `GET` | `/api/v1/manager/sellers/:id` | View assigned Seller details | `SELLER_READ` |

---

## 4. Request & Response Examples

### Onboard Seller
```http
POST /api/v1/manager/sellers
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Kiran Deshmukh",
  "phone": "+919822334455",
  "email": "kiran.d@femmeflo.com",
  "password": "SellerSecurePassword123!",
  "state": "Maharashtra",
  "district": "Pune",
  "village": "Shivajinagar"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Seller created",
  "data": {
    "user": {
      "id": "7fa1209b-6e94-4f2b-b4a1-0268a731ef19",
      "name": "Kiran Deshmukh",
      "email": "kiran.d@femmeflo.com",
      "phone": "+919822334455",
      "role": "SELLER",
      "active": true,
      "state": "Maharashtra",
      "district": "Pune",
      "village": "Shivajinagar",
      "managerId": "e4b17f8a-9213-4fba-bbcf-098e916a4c21",
      "permissions": [],
      "createdAt": "2026-04-01T11:45:00.000Z",
      "updatedAt": "2026-04-01T11:45:00.000Z"
    }
  }
}
```

---

## 5. Source File Links

- **Route Definitions**: [manager/seller.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/manager/seller.routes.ts)
- **Controller**: [manager/seller.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/manager/seller.controller.ts)
- **Validation**: [user.validation.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/user.validation.ts)
- **Service**: [manager/seller.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/manager/seller.service.ts) and [user.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/user.service.ts)
