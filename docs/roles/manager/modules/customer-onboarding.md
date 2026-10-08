# Manager: Customer Onboarding Module

## 1. Module Purpose

Allows Regional Managers to onboard retail shops and customer accounts directly, or modify shop details for accounts operating within their regional territory. Every customer onboarded by a Manager must be assigned to one of their active reporting Sellers.

---

## 2. Business Logic & Security Enforcements

1. **Mandatory Seller Assignment**:
   - When onboarding as a Manager, `sellerId` is required in the payload.
   - The system verifies `seller.managerId === manager.id`. If assigned to another manager, throws `HttpError(403, "Seller is not assigned to you")`.
2. **Category Validation**:
   - `categoryId` must correspond to an active, valid `Category`.
3. **Territory Isolation**:
   - Listings and lookups automatically filter by `where.seller.managerId = manager.id`.
   - If the customer falls outside the Manager's territory, `HttpError(404, "Customer not found or outside assigned scope")` is returned.
4. **Reassignment Constraints**:
   - When updating customer details, a Manager may only reassign customer ownership to another active Seller who also reports to this same Manager.

---

## 3. Endpoints

| Method | Path | Summary | Auth & Guard |
| --- | --- | --- | --- |
| `POST` | `/api/v1/manager/customers` | Onboard customer assigned to a reporting seller | `requireRole("MANAGER")` |
| `GET` | `/api/v1/manager/customers` | List assigned customers with search & pagination | `requireRole("MANAGER")` |
| `GET` | `/api/v1/manager/customers/:id` | View assigned customer details | `requireRole("MANAGER")` |
| `PATCH` | `/api/v1/manager/customers/:id` | Update customer or reassign between reporting sellers | `requireRole("MANAGER")` |

---

## 4. Request & Response Examples

### Onboard Customer via Manager
```http
POST /api/v1/manager/customers
Authorization: Bearer <token>
Content-Type: application/json

{
  "shopName": "Ganesh Medical & General",
  "contactName": "Ganesh Shinde",
  "phone": "+919833445566",
  "categoryId": "4b6e5e79-6b5c-4d22-83b6-16f5c50c0297",
  "sellerId": "7fa1209b-6e94-4f2b-b4a1-0268a731ef19",
  "state": "Maharashtra",
  "district": "Pune",
  "village": "Shivajinagar"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Customer created",
  "data": {
    "customer": {
      "id": "bb4012ce-1382-4df7-8c3b-7a13ef6a192b",
      "shopName": "Ganesh Medical & General",
      "contactName": "Ganesh Shinde",
      "phone": "+919833445566",
      "state": "Maharashtra",
      "district": "Pune",
      "village": "Shivajinagar",
      "active": true,
      "category": { "id": "4b6e5e79-6b5c-4d22-83b6-16f5c50c0297", "name": "Pharmacy" },
      "seller": { "id": "7fa1209b-6e94-4f2b-b4a1-0268a731ef19", "name": "Kiran Deshmukh" }
    }
  }
}
```

---

## 5. Source File Links

- **Route Definitions**: [manager/customer.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/manager/customer.routes.ts)
- **Controller**: [customer.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/customer.controller.ts)
- **Validation**: [customer.validation.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/customer.validation.ts)
- **Service**: [customer.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/customer.service.ts)
