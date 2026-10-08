# Seller Role Specification

## 1. Role Overview & Responsibilities

The **Seller** (`SELLER`) is the frontline commercial representative in the FemmeFlo distribution model. Sellers operate in designated field localities, physically transporting packets, visiting retail shops/merchants, onboarding customer accounts, recording direct sales, and collecting payments.

### Core Responsibilities:
- **Customer Onboarding**: Visit local shops, capture business details, phone number, category, GPS coordinates, and storefront photos.
- **Direct Sales Execution**: Record sales orders with packets and unit price. Collect payment in `CASH`, receive `BANK` transfer, or log as `PENDING`.
- **Low-Price Sale Escalation**: If selling below the standard price floor (₹25.00), automatically escalate to the Super Admin for formal approval.
- **Physical Inventory Accountability**: Track personal packet balances, inbound transfer receipts, and outbound sales deductions.
- **Payment Collection**: Collect outstanding payments on credit sales and mark them resolved.
- **Earnings & Commission Tracking**: Monitor personal confirmed sales incentives calculated per confirmed packet.
- **Profile Self-Service**: Maintain personal contact details and review assigned manager and stock point.

---

## 2. Accessible Routes & Endpoints Matrix

All endpoints require authentication with a Bearer JWT holding `role: "SELLER"`.

| Module | Route / Path | Methods | Documentation |
| --- | --- | --- | --- |
| **Authentication** | `/api/v1/auth/*` | POST, GET, PATCH | [Seller Auth](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/auth.md) |
| **Operational Dashboard** | `/api/v1/seller/dashboard` | GET | [Dashboard](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/dashboard.md) |
| **Customer Management** | `/api/v1/seller/customers` | GET, POST | [Customer Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/modules/customer-management.md) |
| **Customer Details** | `/api/v1/seller/customers/:id` | GET, PATCH | [Customer Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/modules/customer-management.md) |
| **Sales Operations** | `/api/v1/seller/sales` | GET, POST | [Sales Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/modules/sales-operations.md) |
| **Sale Details** | `/api/v1/seller/sales/:id` | GET | [Sales Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/modules/sales-operations.md) |
| **Payment Collection** | `/api/v1/seller/sales/:id/payment` | PATCH | [Sales Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/modules/sales-operations.md) |
| **Personal Inventory** | `/api/v1/seller/inventory` | GET | [Inventory Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/modules/inventory-tracking.md) |
| **Stock Transactions** | `/api/v1/seller/inventory/transactions` | GET | [Inventory Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/modules/inventory-tracking.md) |
| **Incentive Earnings** | `/api/v1/seller/incentives` | GET | [Incentive Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/modules/incentive-tracking.md) |
| **Seller Profile** | `/api/v1/seller/profile` | GET, PATCH | [Profile Module](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/modules/profile-management.md) |

---

## 3. Seller Documentation Directory

1. [Authentication & Mobile Session Flow](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/auth.md)
2. [Field Dashboard Specification](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/dashboard.md)
3. [Permissions & Self-Scoping](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/permissions.md)
4. Modules:
   - [Customer Management](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/modules/customer-management.md)
   - [Sales Operations & Payment Collection](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/modules/sales-operations.md)
   - [Inventory & Transaction Ledger](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/modules/inventory-tracking.md)
   - [Incentive Tracking](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/modules/incentive-tracking.md)
   - [Profile Management](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/docs/roles/seller/modules/profile-management.md)
