# Super Admin: Category Management Module

## 1. Module Purpose

Manages the catalog of retail business categories (e.g., General Store, Pharmacy, Cosmetics, Supermarket) used to classify customer shops across the platform. Categories provide classification for sales analytics, reporting, and dashboard segmentation.

---

## 2. Business Logic & Rules

1. **Uniqueness**:
   - Category names are unique (enforced with case-insensitive collision checks in addition to the DB unique constraint).
2. **Dual-Route Mounting**:
   - Mounted at `/api/v1/admin/categories` guarded with `requireRole("SUPER_ADMIN")`.
   - Also mounted at `/api/v1/categories` for general read and write access across authenticated users.
3. **Active Status / Soft Deactivation**:
   - Updating `active: false` retains historic customer relationships while preventing the category from being selected during new customer onboarding.

---

## 3. Endpoints

| Method | Path | Summary | Auth & Guard |
| --- | --- | --- | --- |
| `POST` | `/api/v1/admin/categories` | Create a new retail Category | `requireRole("SUPER_ADMIN")` |
| `GET` | `/api/v1/admin/categories` | List Categories (filter by active, search) | `requireRole("SUPER_ADMIN")` |
| `GET` | `/api/v1/admin/categories/:id` | Get details of a single Category | `requireRole("SUPER_ADMIN")` |
| `PATCH` | `/api/v1/admin/categories/:id` | Update Category name or active state | `requireRole("SUPER_ADMIN")` |

---

## 4. Request & Response Examples

### 4.1 Create Category
```http
POST /api/v1/admin/categories
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Supermarket"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Category created",
  "data": {
    "category": {
      "id": "c8b4179e-4e6f-4217-a068-154df6377e89",
      "name": "Supermarket",
      "active": true,
      "createdAt": "2026-04-01T18:00:00.000Z",
      "updatedAt": "2026-04-01T18:00:00.000Z"
    }
  }
}
```

---

## 5. Source File Links

- **Route Definitions**: [category.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/category.routes.ts)
- **Controller**: [category.controller.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/category.controller.ts)
- **Validation**: [category.validation.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/controller/category.validation.ts)
- **Service**: [category.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/category.service.ts)
