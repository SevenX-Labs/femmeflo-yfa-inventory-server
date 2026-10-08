# Super Admin Permissions & Access Control

## 1. Permission Architecture

The authorization model is built on two primary layers:
1. **Role Guarding (`requireRole`)**: Restricts access based on the enum `Role` (`SUPER_ADMIN`, `MANAGER`, `SELLER`).
2. **Permission Guarding (`requirePermission`, `requireAnyPermission`)**: Fine-grained capability checks.

### Super Admin Superuser Bypass
In the RBAC middleware ([rbac.middleware.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/middleware/rbac.middleware.ts)):
```typescript
if (user.role === "SUPER_ADMIN") {
  next();
  return;
}
```
**Rule**: The Super Admin role automatically bypasses all granular permission checks. Super Admins do not require explicit assignments in their `permissions` array to execute any operation.

---

## 2. Granular Permissions Catalog

The application defines a catalog of business permissions stored in [permissions.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/constants/permissions.ts):

| Permission String | Intended Purpose | Delegable to Managers by Super Admin? |
| --- | --- | --- |
| `manage_sellers` | Manage seller profiles and lifecycle | Yes |
| `manage_managers` | Create and edit other managers (Restricted to Admin in practice) | Yes (Code constant) |
| `onboard_customers` | Create new customer shops | Yes |
| `view_customers` | View and inspect customer shops | Yes |
| `view_inventory` | Access inventory views | Yes |
| `transfer_inventory` | Execute stock transfers between facilities | Yes |
| `approve_sales` | Approve low-price sales | Yes |
| `view_reports` | Access executive reporting screens | Yes |
| `manage_permissions` | Grant/revoke manager permissions | Yes |
| `SELLER_READ` | Read assigned seller data | Yes (Actively enforced on `/manager/sellers`) |
| `SELLER_CREATE` | Provision new sellers | Yes (Actively enforced on `/manager/sellers`) |
| `CUSTOMER_READ` | Read assigned customer data | Yes |
| `CUSTOMER_CREATE` | Onboard customer shops | Yes |
| `SALES_READ` | Inspect sales orders | Yes |
| `INVENTORY_READ` | Inspect stock movements | Yes |

---

## 3. Manager Permission Delegation

Super Admins have exclusive authority to assign or revoke permissions for any Manager.

### List All Available System Permissions
```http
GET /api/v1/admin/permissions
Authorization: Bearer <token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "permissions": [
      "manage_sellers",
      "manage_managers",
      "onboard_customers",
      "view_customers",
      "view_inventory",
      "transfer_inventory",
      "approve_sales",
      "view_reports",
      "manage_permissions",
      "SELLER_READ",
      "SELLER_CREATE",
      "CUSTOMER_READ",
      "CUSTOMER_CREATE",
      "SALES_READ",
      "INVENTORY_READ"
    ]
  }
}
```

### Update Manager Permissions
```http
PATCH /api/v1/admin/permissions/managers/:id/permissions
# Also accessible at: PATCH /api/v1/admin/managers/:id/permissions
Authorization: Bearer <token>
Content-Type: application/json

{
  "permissions": ["SELLER_READ", "SELLER_CREATE", "CUSTOMER_READ", "CUSTOMER_CREATE"]
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
      "name": "Western Zone Manager",
      "email": "wz.manager@femmeflo.com",
      "phone": "+919876543210",
      "role": "MANAGER",
      "permissions": ["SELLER_READ", "SELLER_CREATE", "CUSTOMER_READ", "CUSTOMER_CREATE"],
      "updatedAt": "2026-04-01T12:00:00.000Z"
    }
  }
}
```

---

## 4. Source Files

- **Constants**: [permissions.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/constants/permissions.ts)
- **Middleware**: [rbac.middleware.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/middleware/rbac.middleware.ts)
- **Routes**: [permission.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/admin/permission.routes.ts)
- **Controller**: [permission.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/admin/permission.controller.ts)
- **Service**: [permission.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/admin/permission.service.ts)
