# Super Admin: Manager Management Module

## 1. Module Purpose

Allows the Super Admin to provision, monitor, configure, update, and deactivate Regional Managers. Managers are responsible for recruiting sellers and onboarding customers within assigned territories.

---

## 2. Business Logic & Rules

1. **Territory Integrity**:
   - A Manager's territory is defined by `state`, `district`, and `village`.
   - Hierarchy rule: If `district` is provided, `state` is mandatory. If `village` is provided, `district` is mandatory.
   - When updating a Manager's territory, the system checks whether existing assigned Sellers already exist outside the newly requested territory boundaries. If any seller falls outside, an `HttpError(409)` is thrown with `"Existing Sellers fall outside the requested Manager territory"`.
2. **Permission Assignment**:
   - Super Admins can assign custom business permissions (`permissions: string[]`) during creation or subsequently via `PATCH`.
3. **Deactivation & Invalidation**:
   - Setting `active: false` increments `tokenVersion`, immediately terminating the Manager's active login sessions.

---

## 3. Endpoints

| Method | Path | Summary | Auth & Guard |
| --- | --- | --- | --- |
| `POST` | `/api/v1/admin/managers` | Create a new Manager | `requireRole("SUPER_ADMIN")` |
| `GET` | `/api/v1/admin/managers` | List Managers with pagination & search | `requireRole("SUPER_ADMIN")` |
| `GET` | `/api/v1/admin/managers/:id` | Get details of a single Manager | `requireRole("SUPER_ADMIN")` |
| `PATCH` | `/api/v1/admin/managers/:id` | Update Manager profile, territory, or status | `requireRole("SUPER_ADMIN")` |
| `PATCH` | `/api/v1/admin/managers/:id/permissions` | Update Manager permissions array | `requireRole("SUPER_ADMIN")` |

---

## 4. Request & Response Payloads

### 4.1 Create Manager
```http
POST /api/v1/admin/managers
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Rajesh Sharma",
  "phone": "+919876543210",
  "email": "rajesh.sharma@femmeflo.com",
  "password": "TemporaryManagerPass123!",
  "state": "Maharashtra",
  "district": "Pune",
  "village": null,
  "permissions": ["SELLER_READ", "SELLER_CREATE", "CUSTOMER_READ", "CUSTOMER_CREATE"]
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Manager created",
  "data": {
    "user": {
      "id": "e4b17f8a-9213-4fba-bbcf-098e916a4c21",
      "name": "Rajesh Sharma",
      "email": "rajesh.sharma@femmeflo.com",
      "phone": "+919876543210",
      "role": "MANAGER",
      "active": true,
      "state": "Maharashtra",
      "district": "Pune",
      "village": null,
      "managerId": null,
      "permissions": ["SELLER_READ", "SELLER_CREATE", "CUSTOMER_READ", "CUSTOMER_CREATE"],
      "createdAt": "2026-04-01T10:30:00.000Z",
      "updatedAt": "2026-04-01T10:30:00.000Z"
    }
  }
}
```

### 4.2 List Managers
```http
GET /api/v1/admin/managers?page=1&pageSize=20&search=Rajesh&state=Maharashtra&active=true
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Managers retrieved",
  "data": {
    "items": [ ... ],
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

- **Route Definitions**: [admin/manager.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/admin/manager.routes.ts)
- **Controller**: [admin/manager.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/admin/manager.controller.ts)
- **Validation**: [user.validation.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/user.validation.ts)
- **Service**: [admin/manager.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/admin/manager.service.ts) and [user.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/user.service.ts)
