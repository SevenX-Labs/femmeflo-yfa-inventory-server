# Super Admin: Permission Delegation Module

## 1. Module Purpose

Allows the Super Admin to govern the granular permissions granted to individual Regional Managers. While Super Admins always possess unrestricted privileges, Manager capabilities can be custom-tailored based on organizational policy.

---

## 2. Business Logic

1. **Manager Role Assertion**:
   - The permission update endpoint rejects any user whose role is not `MANAGER` (`HttpError(400, "Target user is not a Manager")`).
2. **Permission Deduplication**:
   - The service strips duplicates from incoming permission arrays (`Array.from(new Set(permissions))`).
3. **Audit Trail**:
   - Updates return the modified manager record including their new permission list and updated timestamp.

---

## 3. Endpoints

| Method | Path | Summary | Auth & Guard |
| --- | --- | --- | --- |
| `GET` | `/api/v1/admin/permissions` | Retrieve complete master permissions catalog | `requireRole("SUPER_ADMIN")` |
| `PATCH` | `/api/v1/admin/permissions/managers/:id/permissions` | Update Manager's active permissions | `requireRole("SUPER_ADMIN")` |

---

## 4. Request & Response Examples

### Update Manager Permissions
```http
PATCH /api/v1/admin/permissions/managers/e4b17f8a-9213-4fba-bbcf-098e916a4c21/permissions
Authorization: Bearer <token>
Content-Type: application/json

{
  "permissions": [
    "SELLER_READ",
    "SELLER_CREATE",
    "CUSTOMER_READ",
    "CUSTOMER_CREATE",
    "view_inventory"
  ]
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Manager permissions updated successfully",
  "data": {
    "manager": {
      "id": "e4b17f8a-9213-4fba-bbcf-098e916a4c21",
      "name": "Rajesh Sharma",
      "email": "rajesh.sharma@femmeflo.com",
      "phone": "+919876543210",
      "role": "MANAGER",
      "permissions": [
        "SELLER_READ",
        "SELLER_CREATE",
        "CUSTOMER_READ",
        "CUSTOMER_CREATE",
        "view_inventory"
      ],
      "updatedAt": "2026-04-01T17:30:00.000Z"
    }
  }
}
```

---

## 5. Source File Links

- **Route Definitions**: [admin/permission.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/admin/permission.routes.ts)
- **Controller**: [admin/permission.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/admin/permission.controller.ts)
- **Constants**: [permissions.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/constants/permissions.ts)
- **Service**: [admin/permission.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/admin/permission.service.ts)
