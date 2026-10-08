# Seller Permissions & Self-Scoping Rules

## 1. Access Control Model

Sellers operate under strict **Self-Scoping Access Control**. A Seller has zero access to data outside their own account, customers, and assigned inventory.

### Core Restrictions:
- **Zero Visibility into Other Sellers**: A Seller cannot view other sellers' profiles, sales, or stock balances.
- **Zero Visibility into Warehouses/HQ**: A Seller can only query their own `StockLocation`.
- **Customer Isolation**: A Seller can only view, onboard, or sell to Customer shops where `customer.sellerId = authUser.id`.
- **Reassignment Prohibition**: A Seller cannot reassign customer ownership to another seller.
- **Pricing Authority Limit**: A Seller cannot unilaterally confirm sales with `unitPricePaise < minimumPricePaise`.

---

## 2. Service Layer Enforcement

Every Seller service method extracts `sellerId = response.locals.authUser.id` and validates ownership:

### Customer Verification in Sales:
```typescript
if (customer.sellerId !== sellerId) {
  throw new HttpError(403, "Customer is not assigned to you");
}
```

### Stock Ownership in Sales:
```typescript
const sellerLoc = await tx.stockLocation.findUnique({ where: { sellerId } });
if (sellerLoc.balance < input.quantity) {
  throw new HttpError(409, `Insufficient stock balance. Available: ${sellerLoc.balance}, Requested: ${input.quantity}`);
}
```

### Customer Reassignment Prevention:
```typescript
if (input.sellerId && input.sellerId !== existing.sellerId) {
  if (user.role === "SELLER") {
    throw new HttpError(403, "Sellers cannot reassign customer ownership");
  }
}
```

---

## 3. Source Files

- **RBAC Middleware**: [rbac.middleware.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/middleware/rbac.middleware.ts)
- **Seller Sales Service**: [seller/sales.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/seller/sales.service.ts)
- **Customer Service**: [customer.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/customer.service.ts)
