# Master API Endpoints Catalog

This document provides a comprehensive, authoritative index of all 42 endpoints mounted in the application.

---

## 1. Public & Operational Probes

| Method | Endpoint | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/api/v1/health` | Container liveness check | Public |
| `GET` | `/api/v1/ready` | Database connection readiness probe | Public |

---

## 2. Authentication Endpoints (`/api/v1/auth`)

| Method | Endpoint | Description | Auth / Rate Limit |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/login` | Authenticate via email/phone and password | Rate limited (20 req / 15m) |
| `POST` | `/api/v1/auth/forgot-password` | Request password reset token | Rate limited (20 req / 15m) |
| `POST` | `/api/v1/auth/reset-password` | Reset password using one-time token | Rate limited (20 req / 15m) |
| `GET` | `/api/v1/auth/me` | Fetch authenticated user profile | Bearer Token |
| `PATCH` | `/api/v1/auth/password` | Change current user password | Bearer Token + Rate limited |

---

## 3. Product Categories (`/api/v1/categories`)

| Method | Endpoint | Description | Auth / Guard |
| --- | --- | --- | --- |
| `GET` | `/api/v1/categories` | List active product categories | Bearer Token |
| `POST` | `/api/v1/categories` | Create a category | Bearer Token |
| `GET` | `/api/v1/categories/:id` | Get category details | Bearer Token |
| `PATCH` | `/api/v1/categories/:id` | Update category name or active state | Bearer Token |

---

## 4. Super Admin Endpoints (`/api/v1/admin`)

Guarded by: `requireAuthentication` + `requireRole("SUPER_ADMIN")`.

### 4.1 Dashboard
- `GET /api/v1/admin/dashboard` - Global KPI metrics with multi-filtering
- `GET /api/v1/admin/dashboard/filters` - Filter dropdown metadata (states, districts, categories)

### 4.2 Manager Management
- `GET /api/v1/admin/managers` - List Managers with search and territory filters
- `POST /api/v1/admin/managers` - Provision a new Manager with territory and permissions
- `GET /api/v1/admin/managers/:id` - Get Manager details
- `PATCH /api/v1/admin/managers/:id` - Update Manager profile, territory, or active status
- `PATCH /api/v1/admin/managers/:id/permissions` - Update Manager's permissions list

### 4.3 Seller Management
- `GET /api/v1/admin/sellers` - List all Sellers across the enterprise
- `POST /api/v1/admin/sellers` - Onboard a Seller under a Manager
- `GET /api/v1/admin/sellers/:id` - Get Seller details
- `PATCH /api/v1/admin/sellers/:id` - Update Seller details or active status

### 4.4 Customer Management
- `GET /api/v1/admin/customers` - List all Customer shops system-wide
- `POST /api/v1/admin/customers` - Onboard a Customer assigned to any active Seller
- `GET /api/v1/admin/customers/:id` - View Customer details
- `PATCH /api/v1/admin/customers/:id` - Update Customer or reassign Seller ownership

### 4.5 Inventory & Facility Management
- `GET /api/v1/admin/inventory` - Summary across HQ, Warehouses, and Sellers
- `POST /api/v1/admin/inventory/warehouses` - Create a regional Warehouse
- `GET /api/v1/admin/inventory/warehouses` - List all regional Warehouses
- `POST /api/v1/admin/inventory/receipts` - Add inbound stock receipt to HQ
- `POST /api/v1/admin/inventory/transfers` - Transfer stock between any two facilities
- `GET /api/v1/admin/inventory/transactions` - Complete stock movement transaction ledger

### 4.6 Sales Oversight
- `GET /api/v1/admin/sales` - List all sales orders across the platform
- `GET /api/v1/admin/sales/:id` - View detailed sale order with invoice & payment info

### 4.7 Low-Price Approvals
- `GET /api/v1/admin/approvals` - List sales orders pending low-price approval
- `POST /api/v1/admin/approvals/:saleId/approve` - Approve & confirm low-price sale
- `POST /api/v1/admin/approvals/:saleId/reject` - Reject low-price sale with reason

### 4.8 Incentives & Business Settings
- `GET /api/v1/admin/incentives` - Seller-wise commission audit report
- `GET /api/v1/admin/incentives/settings` - Read current `BusinessSettings`
- `PATCH /api/v1/admin/incentives/settings` - Update price floor or incentive rate

### 4.9 Invoices & Billing
- `GET /api/v1/admin/invoices` - List generated sales invoices
- `GET /api/v1/admin/invoices/:id` - Get invoice details, snapshot, and PDF location

### 4.10 Permissions Catalog
- `GET /api/v1/admin/permissions` - Master permissions list
- `PATCH /api/v1/admin/permissions/managers/:id/permissions` - Update Manager permissions

### 4.11 Analytics & Reporting
- `GET /api/v1/admin/reports/sales` - Export sales report (JSON, CSV, XLSX)
- `GET /api/v1/admin/reports/inventory` - Export inventory report (JSON, CSV, XLSX)

### 4.12 Categories (Admin Alias)
- `GET /api/v1/admin/categories` - List categories
- `POST /api/v1/admin/categories` - Create category
- `GET /api/v1/admin/categories/:id` - Get category
- `PATCH /api/v1/admin/categories/:id` - Update category

---

## 5. Manager Endpoints (`/api/v1/manager`)

Guarded by: `requireAuthentication` + `requireRole("MANAGER")`.

### 5.1 Dashboard
- `GET /api/v1/manager/dashboard` - Regional operational metrics

### 5.2 Seller Onboarding
- `GET /api/v1/manager/sellers` - List reporting Sellers (`SELLER_READ`)
- `POST /api/v1/manager/sellers` - Onboard Seller under this Manager (`SELLER_CREATE`)
- `GET /api/v1/manager/sellers/:id` - Get reporting Seller details (`SELLER_READ`)

### 5.3 Customer Management
- `GET /api/v1/manager/customers` - List assigned Customers in regional territory
- `POST /api/v1/manager/customers` - Onboard Customer under a reporting Seller
- `GET /api/v1/manager/customers/:id` - View Customer details
- `PATCH /api/v1/manager/customers/:id` - Update Customer or reassign between reporting sellers

### 5.4 Inventory Monitoring
- `GET /api/v1/manager/inventory` - Inventory summary for reporting sellers

### 5.5 Sales Monitoring
- `GET /api/v1/manager/sales` - List sales for reporting sellers
- `GET /api/v1/manager/sales/:id` - View sale details for reporting seller

---

## 6. Seller Endpoints (`/api/v1/seller`)

Guarded by: `requireAuthentication` + `requireRole("SELLER")`.

### 6.1 Dashboard
- `GET /api/v1/seller/dashboard` - Field metrics (assigned, sold, remaining, incentives, recent 5)

### 6.2 Customer Management
- `GET /api/v1/seller/customers` - List own customer shops
- `POST /api/v1/seller/customers` - Onboard a customer shop (automatically sets sellerId)
- `GET /api/v1/seller/customers/:id` - View own customer shop details
- `PATCH /api/v1/seller/customers/:id` - Update customer shop details

### 6.3 Sales Operations
- `POST /api/v1/seller/sales` - Submit a sales order (atomic confirm or low-price escalation)
- `GET /api/v1/seller/sales` - List personal sales history
- `GET /api/v1/seller/sales/:id` - View personal sale record details
- `PATCH /api/v1/seller/sales/:id/payment` - Collect payment on `PENDING` sale

### 6.4 Inventory Tracking
- `GET /api/v1/seller/inventory` - View current packet balance, assigned, and sold counts
- `GET /api/v1/seller/inventory/transactions` - Personal stock movement transaction ledger

### 6.5 Incentive Tracking
- `GET /api/v1/seller/incentives` - View personal commission earnings and itemized breakdown

### 6.6 Profile
- `GET /api/v1/seller/profile` - View profile, manager info, and stock location
- `PATCH /api/v1/seller/profile` - Update name, phone, or email
