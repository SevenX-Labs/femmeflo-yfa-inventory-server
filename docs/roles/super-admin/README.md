# Super Admin Role Specification

## 1. Role Overview & Responsibilities

The **Super Admin** (`SUPER_ADMIN`) represents the supreme executive and administrative authority in the FemmeFlo Inventory platform. The Super Admin possesses global jurisdiction over all geographical regions, physical facilities, financial policies, personnel, and customer accounts.

### Core Responsibilities:
- **Organization & Personnel Management**: Create, configure, update, and deactivate Managers and Sellers. Assign regional managers and govern manager permissions.
- **Supply Chain & Inventory Governance**: Monitor global inventory across Headquarters (HQ), regional warehouses, and all field seller locations. Authorize warehouse creation, stock receipts, and inter-facility transfers.
- **Price Integrity & Low-Price Approvals**: Review, evaluate, approve, or reject field sales submitted below the minimum price threshold (₹25.00).
- **Financial & Incentive Settings**: Set and adjust system-wide commission rates and price floors.
- **Executive Analytics & Reporting**: Generate multi-dimensional performance reports (sales, inventory) across states, districts, managers, and sellers with exports to CSV and Excel.
- **Billing & Invoice Oversight**: Access and audit customer invoices and generated PDF documents.

---

## 2. Accessible Routes & Endpoints Matrix

All endpoints below require authentication with a Bearer JWT holding `role: "SUPER_ADMIN"`.

| Module | Route / Path | Methods | Documentation |
| --- | --- | --- | --- |
| **Authentication** | `/api/v1/auth/*` | POST, GET, PATCH | [Super Admin Auth](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/auth.md) |
| **Executive Dashboard** | `/api/v1/admin/dashboard` | GET | [Dashboard](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/dashboard.md) |
| **Filter Metadata** | `/api/v1/admin/dashboard/filters` | GET | [Dashboard Filters](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/dashboard.md) |
| **Manager Management** | `/api/v1/admin/managers` | GET, POST, PATCH | [Manager Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/manager-management.md) |
| **Seller Management** | `/api/v1/admin/sellers` | GET, POST, PATCH | [Seller Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/seller-management.md) |
| **Customer / Shop Mgmt** | `/api/v1/admin/customers` | GET, POST, PATCH | [Customer Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/customer-management.md) |
| **Inventory & Transfers** | `/api/v1/admin/inventory/*` | GET, POST | [Inventory Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/inventory-management.md) |
| **Sales Oversight** | `/api/v1/admin/sales` | GET | [Sales Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/sales-management.md) |
| **Low-Price Approvals** | `/api/v1/admin/approvals/*` | GET, POST | [Approvals Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/approval-management.md) |
| **Incentives & Rules** | `/api/v1/admin/incentives/*` | GET, PATCH | [Incentive Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/incentive-management.md) |
| **Invoice Audit** | `/api/v1/admin/invoices` | GET | [Invoice Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/invoice-management.md) |
| **Permissions Catalog** | `/api/v1/admin/permissions` | GET, PATCH | [Permissions](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/permissions.md) |
| **Analytics Reports** | `/api/v1/admin/reports/*` | GET | [Reports Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/report-management.md) |
| **Category Management** | `/api/v1/admin/categories` | GET, POST, PATCH | [Category Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/category-management.md) |

---

## 3. Super Admin Documentation Directory

1. [Authentication & Account Provisioning](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/auth.md)
2. [Executive Dashboard Specification](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/dashboard.md)
3. [Permissions & Access Control System](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/permissions.md)
4. Modules:
   - [Manager Management](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/manager-management.md)
   - [Seller Management](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/seller-management.md)
   - [Customer Management](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/customer-management.md)
   - [Inventory & Stock Transfers](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/inventory-management.md)
   - [Sales Oversight](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/sales-management.md)
   - [Low-Price Approvals](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/approval-management.md)
   - [Incentives & Business Settings](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/incentive-management.md)
   - [Invoices & Billing](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/invoice-management.md)
   - [Permissions Management](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/permission-management.md)
   - [Reports & Analytics](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/report-management.md)
   - [Category Management](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/category-management.md)
