# FemmeFlo Inventory & Management Platform Documentation

Welcome to the official technical and architectural documentation for the **FemmeFlo YFA Inventory Management System**.

This role-based distribution platform manages the complete operational cycle:
```text
HQ Stock → Regional Warehouse → Field Seller → Shop / Customer → Sale → Payment → Inventory Deduction → Incentive → Invoice (PDF) → Executive Reports
```

---

## 1. Quick Navigation Index

| Section | Description | Documentation Links |
| --- | --- | --- |
| **System Architecture** | Technical stack, tier design, database schema, and authentication | [Overview](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/architecture/overview.md) • [Folder Structure](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/architecture/folder-structure.md) • [Database](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/architecture/database.md) • [Auth Flow](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/architecture/authentication-flow.md) |
| **Super Admin Role** | Complete administrative command, approvals, settings & reports | [Super Admin Guide](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/README.md) • [Dashboard](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/dashboard.md) • [Permissions](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/permissions.md) |
| **Manager Role** | Regional team supervision, seller & customer onboarding, sales monitoring | [Manager Guide](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/README.md) • [Dashboard](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/dashboard.md) • [Permissions](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/permissions.md) |
| **Seller Role** | Frontline field sales, mobile stock tracking, customer orders & incentives | [Seller Guide](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/README.md) • [Dashboard](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/dashboard.md) • [Permissions](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/permissions.md) |
| **Shared Platform** | Universal authentication, RBAC guards, notifications & common utilities | [Authentication](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/shared/authentication.md) • [Authorization](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/shared/authorization.md) • [Notifications](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/shared/notifications.md) • [Common Features](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/shared/common-features.md) |
| **API Reference** | API overview, status codes, and 42-endpoint master catalog | [API Overview](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/api/overview.md) • [Endpoints Catalog](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/api/endpoints.md) |
| **Workflows** | End-to-end user provisioning and operational business workflows | [User Lifecycle](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/workflows/user-management.md) • [Operational Sales Cycle](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/workflows/role-permission-flow.md) |

---

## 2. Discovered Roles & Capabilities Matrix

The codebase defines three authenticated user roles in the Prisma schema (`enum Role { SUPER_ADMIN, MANAGER, SELLER }`):

| Capability / Module | Super Admin (`SUPER_ADMIN`) | Regional Manager (`MANAGER`) | Field Seller (`SELLER`) |
| --- | :---: | :---: | :---: |
| **Geographic Jurisdiction** | **Global** (All regions) | **Regional** (Assigned territory) | **Local** (Assigned locality) |
| **Manage Managers** | Full CRUD + Permissions | No Access | No Access |
| **Manage Sellers** | Full CRUD | Onboard & View Reporting Sellers | No Access |
| **Customer / Shop Onboarding** | Any active seller in system | Assigned reporting sellers | Self-assigned only |
| **Customer List / View Scope** | Global (all customers) | Assigned sellers & territory | Own customers only |
| **Customer Reassignment** | Full system-wide | Between reporting sellers | Prohibited |
| **Inventory Scope** | HQ, Warehouses & Sellers | Reporting sellers' stock | Personal stock location |
| **Stock Receipts (HQ)** | Yes | No Access | No Access |
| **Stock Transfers** | Between any two locations | No Access | No Access |
| **Record Sales Orders** | No (Supervisory) | No (Supervisory) | **Yes (Direct Field Sales)** |
| **Low-Price Sale Approvals** | **Yes (Approve / Reject)** | No Access | Escalates for Approval |
| **Payment Collection** | Audit Only | Audit Only | **Yes (CASH, BANK, PENDING)** |
| **Incentive Settings** | **Configure Rate & Price Floor** | No Access | View Earned Commissions |
| **Invoice Access** | All invoices & PDFs | View linked sales invoices | View own sales invoices |
| **Executive Reports (Excel/CSV)**| **Yes (Sales & Inventory)** | No Access | No Access |

> **Note on Customers**: The `Customer` model represents commercial entities (shops/retailers). Customers do not hold login credentials or user roles in the current API.

---

## 3. Discovered Modules Breakdown

### 3.1 Super Admin Modules (`docs/roles/super-admin/modules/`)
1. [Manager Management](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/manager-management.md) - Provisioning, updating, and territory configuration.
2. [Seller Management](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/seller-management.md) - Complete seller lifecycle across all managers.
3. [Customer Management](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/customer-management.md) - System-wide customer shop directory.
4. [Inventory Management](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/inventory-management.md) - HQ stock receipts, warehouses, and inter-location transfers.
5. [Sales Oversight](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/sales-management.md) - Global sales ledger and status auditing.
6. [Low-Price Approvals](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/approval-management.md) - Low-price order evaluation and atomic confirmation.
7. [Incentive Management](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/incentive-management.md) - Company commission rate and minimum price floor rules.
8. [Invoice Management](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/invoice-management.md) - Invoice search, point-in-time snapshots, and PDF paths.
9. [Permission Delegation](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/permission-management.md) - Managing manager permission tokens.
10. [Reports & Analytics](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/report-management.md) - Sales and inventory engines with JSON, CSV, and XLSX export.
11. [Category Management](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/super-admin/modules/category-management.md) - Product categories catalog.

### 3.2 Manager Modules (`docs/roles/manager/modules/`)
1. [Seller Onboarding](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/modules/seller-onboarding.md) - Recruiting sellers within regional territory bounds.
2. [Customer Onboarding](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/modules/customer-onboarding.md) - Onboarding and maintaining shops for reporting sellers.
3. [Inventory Monitoring](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/modules/inventory-monitoring.md) - Field stock tracking across reporting sellers.
4. [Sales Monitoring](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/modules/sales-monitoring.md) - Sales velocity and order inspection.

### 3.3 Seller Modules (`docs/roles/seller/modules/`)
1. [Customer Management](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/modules/customer-management.md) - Retail shop onboarding and profile updates.
2. [Sales Operations](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/modules/sales-operations.md) - Recording sales orders and collecting pending payments.
3. [Inventory Tracking](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/modules/inventory-tracking.md) - Personal stock balance and movement transaction history.
4. [Incentive Tracking](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/modules/incentive-tracking.md) - Real-time sales commission earnings.
5. [Profile Self-Service](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/modules/profile-management.md) - Contact profile editing and manager overview.

---

## 4. Implementation Status & Audit Findings

| Feature / Capability | Implementation Status | Notes |
| --- | --- | --- |
| **Stateless JWT Auth with Token Versioning** | **Fully Implemented** | `User.tokenVersion` allows instant global session revocation. |
| **Role-Based Routing (RBAC)** | **Fully Implemented** | Express router strictly checks `Role` on mounted route groups. |
| **Territory & Hierarchy Scoping** | **Fully Implemented** | Enforced at service layer across users, customers, and sales. |
| **Atomic Inventory Transactions** | **Fully Implemented** | Receipts, transfers, and confirmed sales execute inside DB transactions. |
| **Low-Price Approval Engine** | **Fully Implemented** | Unit prices below ₹25.00 require Super Admin approval. |
| **Invoice & PDFKit Generation** | **Fully Implemented** | Renders formatted PDFs to `public/storage/invoices/`. |
| **CSV & Excel (XLSX) Exports** | **Fully Implemented** | Streamed via `exceljs` in `/admin/reports/sales` and `/inventory`. |
| **External Email / WhatsApp Workers** | **Needs Verification / Planned** | Prisma models `Delivery` and `Notification` exist with `EMAIL` and `WHATSAPP` channels; third-party provider integration scheduled in subsequent phases. |
| **Direct Customer Login** | **Not in Scope** | Customers are business entities, not authenticated users. |
| **Category Creation Permission** | **Needs Verification** | `/api/v1/categories` POST/PATCH is open to all authenticated users, while `/api/v1/admin/categories` restricts to Super Admin. |

---

## 5. Getting Started for Developers

### Install & Configure
```bash
# Install dependencies
npm ci

# Configure environment (copy template)
cp .env.example .env

# Validate and apply database migrations
npm run db:validate
npm run db:generate
npm run db:migrate

# Bootstrap the initial Super Admin account
npm run db:bootstrap-admin

# Run development server
npm run dev
```

### Interactive Documentation & Testing
- Visit `http://localhost:5000/docs` for the interactive Swagger UI.
- Use `npm test` to run unit and API smoke tests.
- Reference [Postman Testing Guide](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/POSTMAN_MANUAL_TESTING.md) for pre-built manual testing collections.
