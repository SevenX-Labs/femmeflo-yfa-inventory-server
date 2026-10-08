# Manager Permissions & Scoping Rules

## 1. Access Control Model

A Manager's system capabilities are constrained by two dimensions:
1. **Granular Business Permissions (`permissions: string[]`)**: Verified via `requirePermission(...)` middleware.
2. **Territory & Reporting Hierarchy Scoping**: Enforced within the service and query layer via `assignedSellerScope` and relational filters.

---

## 2. Granular Permissions Enforcement

In the routing layer, specific Manager actions require assigned permission tokens:

```typescript
// Manager Seller Routes:
router.get("/", requirePermission("SELLER_READ"), controller.list);
router.post("/", requirePermission("SELLER_CREATE"), controller.create);
router.get("/:id", requirePermission("SELLER_READ"), controller.get);
```

If a Manager attempts to onboard a seller without `SELLER_CREATE`, the middleware returns:
```json
{
  "success": false,
  "message": "Permission denied"
}
```
HTTP Status: `403 Forbidden`.

---

## 3. Geographic & Hierarchy Scoping Rules

### 3.1 Assigned Seller Scope (`assignedSellerScope`)
Defined in [user.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/user.service.ts):
```typescript
export function assignedSellerScope(manager: PublicUser): Prisma.UserWhereInput {
  const scope: Prisma.UserWhereInput = { role: "SELLER", managerId: manager.id };
  for (const field of ["state", "district", "village"] as const) {
    if (manager[field]) scope[field] = { equals: manager[field], mode: "insensitive" };
  }
  return scope;
}
```
- A Manager can **only** list, view, or interact with Sellers who have `managerId = manager.id`.
- If the Manager is assigned to `state: "Maharashtra", district: "Pune"`, queries automatically filter out any seller record outside that boundary.

### 3.2 Customer Scoping
When querying or updating customers:
- `where.seller.managerId = manager.id`
- Customer state, district, and village must match the Manager's territory.
- Attempting to access a customer outside this scope returns `404 Not Found or outside assigned scope`.

---

## 4. Source Files

- **RBAC Middleware**: [rbac.middleware.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/middleware/rbac.middleware.ts)
- **User Scoping Logic**: [user.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/user.service.ts)
- **Customer Scoping Logic**: [customer.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/customer.service.ts)
