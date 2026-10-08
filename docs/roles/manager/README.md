# Manager Role Specification

## 1. Role Overview & Responsibilities

The **Manager** (`MANAGER`) represents regional operations supervision within the FemmeFlo ecosystem. Managers bridge central executive leadership (Super Admin) and local on-the-ground sales teams (Sellers).

### Key Responsibilities:
- **Seller Recruitment & Onboarding**: Recruit, onboard, and manage field Sellers operating strictly within the Manager's assigned geographic territory (`state`, `district`, `village`).
- **Customer / Retail Shop Onboarding**: Onboard customer shops directly or assist assigned sellers, ensuring shops are linked to active sellers within the regional territory.
- **Regional Inventory Monitoring**: Oversee physical stock allocated to assigned field sellers, comparing transferred packets against confirmed sales and real-time field stock.
- **Sales Oversight**: Monitor sales velocity, order volumes, revenue, and collection statuses (`CASH`, `BANK`, `PENDING`) for all sellers reporting to the Manager.
- **Territory Integrity**: Ensure business operations do not cross boundary constraints established by the Super Admin.

### Role Constraints:
- Cannot manage or inspect other Managers.
- Cannot view, modify, or transfer stock at Headquarters (HQ) or central warehouses.
- Cannot approve low-price sales (exclusive to Super Admin).
- Cannot access data or entities outside their assigned geographic territory or reporting hierarchy.

---

## 2. Accessible Routes & Endpoints Matrix

All endpoints require authentication with a Bearer JWT holding `role: "MANAGER"`.

| Module | Route / Path | Methods | Required Permission | Documentation |
| --- | --- | --- | --- | --- |
| **Authentication** | `/api/v1/auth/*` | POST, GET, PATCH | None (Role authenticated) | [Manager Auth](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/auth.md) |
| **Regional Dashboard** | `/api/v1/manager/dashboard` | GET | None (Role authenticated) | [Dashboard](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/dashboard.md) |
| **Seller Onboarding** | `/api/v1/manager/sellers` | GET, POST | `SELLER_READ`, `SELLER_CREATE` | [Seller Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/modules/seller-onboarding.md) |
| **Seller Details** | `/api/v1/manager/sellers/:id` | GET | `SELLER_READ` | [Seller Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/modules/seller-onboarding.md) |
| **Customer Onboarding** | `/api/v1/manager/customers` | GET, POST | None (Role authenticated) | [Customer Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/modules/customer-onboarding.md) |
| **Customer Details** | `/api/v1/manager/customers/:id` | GET, PATCH | None (Role authenticated) | [Customer Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/modules/customer-onboarding.md) |
| **Stock Monitoring** | `/api/v1/manager/inventory` | GET | None (Role authenticated) | [Inventory Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/modules/inventory-monitoring.md) |
| **Sales Monitoring** | `/api/v1/manager/sales` | GET | None (Role authenticated) | [Sales Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/modules/sales-monitoring.md) |
| **Sale Details** | `/api/v1/manager/sales/:id` | GET | None (Role authenticated) | [Sales Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/modules/sales-monitoring.md) |

---

## 3. Manager Documentation Directory

1. [Authentication & Session Flow](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/auth.md)
2. [Regional Dashboard Specification](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/dashboard.md)
3. [Permissions & Territory Scoping](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/permissions.md)
4. Modules:
   - [Seller Onboarding & Hierarchy](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/modules/seller-onboarding.md)
   - [Customer Onboarding & Management](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/modules/customer-onboarding.md)
   - [Regional Inventory Monitoring](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/modules/inventory-monitoring.md)
   - [Regional Sales Monitoring](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/manager/modules/sales-monitoring.md)
