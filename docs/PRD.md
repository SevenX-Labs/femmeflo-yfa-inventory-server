**Project Type:** Web-based Management System + Seller Application

**Roles:** Super Admin, Manager, Seller

**Development Model:** Role-based access with centralized inventory, sales, customer, incentive and approval management.

---

## 1. Product Objective

The system will allow the business to manage the complete operational cycle:

**HQ Stock → Warehouse → Seller → Customer/Shop → Sale → Payment → Inventory Update → Incentive → Invoice → Reports**

The system must provide different access and functionality based on the user's role.

---

# 2. User Roles

## 2.1 Super Admin

The Super Admin is the highest-level user.

### Super Admin can:

- Manage Managers
- Manage Sellers
- Manage customers/shops
- Manage inventory
- View all sales
- View payment status
- View incentives
- Approve/reject low-price sales
- View invoices
- View reports
- Filter data by:
    - State
    - District
    - Village
    - Manager
    - Seller
    - Category
- Control role-based access/permissions

---

## 2.2 Manager

Manager is responsible primarily for **seller onboarding and customer onboarding**.

### Manager can:

- Login to Manager Dashboard
- Add/onboard Sellers
- View assigned Sellers
- View Seller information
- Onboard customers
- View assigned customers
- View relevant sales
- View relevant inventory
- Monitor Seller activity

### Manager cannot:

- Access unrestricted Super Admin functionality
- Manage other Managers
- Access data outside their assigned permissions/territory

The Super Admin controls the Manager's access.

---

# 3. Seller Module

## 3.1 Seller Login

Seller should be able to log in using their assigned credentials.

### Login

- Email/Phone
- Password
- Login
- Forgot Password

---

# 4. Seller Dashboard

Dashboard should display the Seller's current operational information.

### Dashboard Metrics

- Assigned Packets
- Sold Packets
- Remaining Packets
- Total Incentive

### Recent Sales

Display:

- Customer/Shop
- Packets sold
- Sale amount
- Payment mode
- Date

### Main Sections

- Home
- Customers
- Sales
- Inventory
- Incentive
- More/Profile

---

# 5. Customer / Shop Management

The existing **"Add Shop"** terminology should be changed to **"Add Customer"**.

A customer can represent the shop/customer to whom the Seller sells the packets.

## 5.1 Add Customer

Seller/authorized Manager can add a customer.

### Customer Information

- Customer/Shop name
- Shopkeeper/Customer name
- Contact number
- Category
- State
- District
- Village
- Customer/Shop photo
- Current location

### Photo

Seller should be able to:

- Take photo
- Upload photo

### Current Location

Seller should have:

**Get Current Location**

The system captures the customer's current location.

---

# 6. Category

A **Category** field should be available while adding a customer.

Example:

```
Category
[ Select Category ▼ ]
```

The exact category list should be configurable/finalized by the business.

---

# 7. Record Sale

Seller can record a sale against an existing customer.

## Sale Information

- Customer
- Packets sold
- Per packet cost
- Payment mode
- Total amount

### Payment Modes

```
Cash
Bank
Pending
```

### Total Amount

System calculates:

**Total Amount = Packets Sold × Per Packet Cost**

Example:

```
Packets Sold     = 10
Per Packet Cost  = ₹25

Total Amount     = ₹250
```

The Seller should not manually calculate the total.

---

# 8. Low-Price Sale Approval

The business has a minimum normal selling price of **₹25 per packet**.

If the Seller enters a price **below ₹25**, the sale must require approval.

## Flow

```
Seller enters sale
        ↓
Per packet price < ₹25?
        ↓
       YES
        ↓
Approval Required
        ↓
Admin receives approval request
        ↓
WhatsApp notification/request
        ↓
Admin approves or rejects
```

### If Approved

```
Approved
   ↓
Seller receives notification
   ↓
Sale becomes confirmed
   ↓
Inventory updated
   ↓
Incentive calculated
   ↓
Invoice generated
```

### If Rejected

```
Rejected
   ↓
Seller receives notification
   ↓
Sale remains unconfirmed
   ↓
Inventory is NOT deducted
   ↓
Incentive is NOT calculated
```

---

# 9. Inventory Management

Inventory is one of the core modules.

The system must track stock throughout the distribution chain.

## Stock hierarchy

```
HQ
 ↓
Warehouse
 ↓
Seller
 ↓
Customer / Sale
```

---

# 10. HQ → Warehouse → Seller Inventory

Example:

HQ receives:

**400 packets**

Warehouse receives:

**400 packets**

Seller allocation:

```
Seller 1 → 40 packets
Seller 2 → 40 packets
Seller 3 → 40 packets
```

The system must automatically maintain the available stock at each level.

---

# 11. Seller Inventory

When Seller receives stock:

```
Assigned = 40
Sold = 0
Remaining = 40
```

If Seller sells 20:

```
Assigned = 40
Sold = 20
Remaining = 20
```

If another Seller receives 40 and sells 30:

```
Assigned = 40
Sold = 30
Remaining = 10
```

The remaining quantity must be automatically reflected in the Admin dashboard.

---

# 12. Inventory Transaction Tracking

The system must maintain stock movement history.

Example:

```
HQ
400 packets
   ↓
Warehouse
400 packets
   ↓
Seller 1
40 packets
   ↓
Sold
20 packets
   ↓
Remaining
20 packets
```

Admin should be able to understand:

- How much stock HQ received
- How much was sent to Warehouse
- How much Warehouse distributed
- How much was assigned to each Seller
- How much each Seller sold
- How much each Seller has remaining

Inventory should update automatically after a **confirmed sale**.

---

# 13. Inventory Reconciliation

The system should maintain a consistent stock calculation.

Example:

```
HQ/Initial Stock       400
Seller 1 Assigned       40
Seller 2 Assigned       40
Seller 3 Assigned       40

Seller 1 Sold           20
Seller 2 Sold           30
Seller 3 Sold           15

Seller 1 Remaining      20
Seller 2 Remaining      10
Seller 3 Remaining      25
```

Admin should be able to see the complete stock position.

---

# 14. Payment Status

Admin's sales/stock-related views should show the payment mode/status.

Payment modes:

- Cash
- Bank
- Pending

Example:

| Customer | Seller | Packets | Amount | Payment |
| --- | --- | --- | --- | --- |
| ABC Shop | S001 | 10 | ₹250 | Cash |
| XYZ Shop | S002 | 20 | ₹500 | Bank |
| PQR Shop | S003 | 5 | ₹125 | Pending |

---

# 15. Incentive Management

The Seller receives an incentive based on packet sales.

## Incentive Calculation

The system should calculate the incentive based on:

- Confirmed packets sold
- Incentive per packet

Example:

```
Packets Sold       20
Incentive/Packet   ₹15
----------------------
Total Incentive    ₹300
```

Seller can view:

- Total incentive
- Packets contributing to incentive
- Incentive history

Admin can view incentive information across Sellers.

**The final incentive rate/rules will be provided by the business and should not be hard-coded without confirmation.**

---

# 16. Sales History

Seller should have a Sales History section.

### Filters

- All
- This Month
- Last Month

### Sales information

- Customer
- Packets
- Amount
- Payment mode
- Date
- Sale status

Seller should be able to see their own sales history.

Admin should be able to see overall sales.

Manager should see sales according to their assigned access.

---

# 17. Invoice Management

After a sale is confirmed, the system should generate an invoice.

## Invoice Information

- Invoice number
- Customer/shop
- Seller
- Packets sold
- Per packet cost
- Total amount
- Payment mode
- Date

## Invoice Delivery

Invoice should be sent automatically through:

- Email
- WhatsApp

Target:

**Shopkeeper/Customer**

---

# 18. Manager — Seller Onboarding

Manager should have an option:

**Add Seller**

### Seller information

- Name
- Contact
- Email/required login information
- Assigned location/territory as applicable
- Login access

After onboarding, Seller receives access to the Seller application.

---

# 19. Manager — Customer Onboarding

Manager should also be able to onboard customers.

Customer information follows the same customer structure:

- Customer/Shop name
- Shopkeeper/Customer name
- Contact
- Category
- State
- District
- Village
- Photo
- Location

---

# 20. Super Admin — Manager Management

Super Admin can:

- Add Manager
- Edit Manager
- Activate/Deactivate Manager
- View Manager
- Assign permissions
- View Manager's Sellers
- View Manager's customers
- Monitor Manager activity

---

# 21. Super Admin Dashboard

The Admin dashboard should provide an overall business summary.

### Main Metrics

```
Total Packets Sold
Total Earnings
Total States
Total Shops/Customers
Total Managers
Total Sellers
Total Inventory
Total Incentive
```

---

# 22. Geographic Filtering

Admin dashboard must provide hierarchical geographic filtering.

```
State
  ↓
District
  ↓
Village
```

Additional filters:

```
Manager
Seller
Category
```

Admin should be able to combine these filters to understand sales, inventory and customer information for a particular location.

Example:

```
Maharashtra
    ↓
Thane
    ↓
Diva
    ↓
Manager
    ↓
Seller
    ↓
Customers
    ↓
Sales
```

---

# 23. Admin Sales Management

Admin can view all sales.

### Information

- Customer
- Seller
- Manager
- State
- District
- Village
- Category
- Packets sold
- Per packet cost
- Total amount
- Payment mode
- Sale status
- Date

---

# 24. Admin Approval Center

Admin should have a dedicated area for low-price sale approvals.

### Approval list

```
Customer
Seller
Packets
Price
Total Amount
Date
Status
Action
```

Actions:

```
Approve
Reject
```

Admin should also receive the low-price approval request through the configured WhatsApp workflow.

---

# 25. Notifications

### Seller Notifications

Seller should receive notifications for:

- Low-price sale approved
- Low-price sale rejected
- Relevant system updates

### Admin Notifications

Admin should receive:

- Low-price sale approval request
- Relevant system notifications

---

# 26. Role-Based Access Control

The system must strictly separate permissions.

### Super Admin

**Full system access**

```
Managers
Sellers
Customers
Inventory
Sales
Payments
Incentives
Approvals
Invoices
Reports
Permissions
```

### Manager

```
Seller onboarding
Customer onboarding
Assigned sellers
Assigned customers
Relevant sales
Relevant inventory
```

### Seller

```
Own customers
Own sales
Own inventory
Own incentive
Own history
```

---

# 27. Core Business Rules

### Rule 1 — Inventory

Only a **confirmed sale** reduces Seller inventory.

### Rule 2 — Low-price sale

If:

**Per Packet Cost < ₹25**

then:

**Admin approval is mandatory.**

### Rule 3 — Rejected sale

Rejected sales must not:

- Reduce inventory
- Increase sold quantity
- Generate incentive
- Generate final invoice

### Rule 4 — Incentive

Incentive is calculated based on **confirmed packet sales**.

### Rule 5 — Total amount

```
Packets × Per Packet Cost = Total Amount
```

### Rule 6 — Payment

Every sale must have:

```
Cash / Bank / Pending
```

### Rule 7 — Inventory

Every stock allocation and sale must update the relevant stock position.

### Rule 8 — Permissions

Users can only access data permitted by their role and assigned scope.

---

# 28. Main Modules

```
1. Authentication
2. Role & Permission Management
3. Super Admin Dashboard
4. Manager Management
5. Seller Management
6. Customer/Shop Management
7. Category Management
8. Inventory Management
9. Stock Transfer/Allocation
10. Sales Management
11. Payment Status
12. Low-Price Approval
13. Incentive Management
14. Invoice Generation
15. Email Invoice
16. WhatsApp Invoice/Approval
17. Sales History
18. Geographic Filters
19. Reports
20. Notifications
```

---

# 29. Final Product Structure

```
                    SUPER ADMIN
                         │
        ┌────────────────┼────────────────┐
        │                │                │
     MANAGERS         INVENTORY        REPORTS
        │
        ▼
      SELLERS
        │
        ├───────────────┐
        ▼               ▼
    CUSTOMERS         SALES
                        │
             ┌──────────┼──────────┐
             ▼          ▼          ▼
          PAYMENT    INVENTORY   INCENTIVE
             │          │          │
             └──────────┼──────────┘
                        ▼
                     INVOICE
                   /          \
                EMAIL       WHATSAPP
```

## 30. MVP Scope Summary

The first production version should therefore cover:

**Super Admin**

- Dashboard
- Managers
- Sellers
- Customers
- Inventory
- Sales
- Payments
- Approvals
- Incentives
- Invoices
- Geographic filters
- Reports
- Permissions

**Manager**

- Dashboard
- Seller onboarding
- Customer onboarding
- Seller/customer monitoring
- Assigned sales/inventory visibility

**Seller**

- Login
- Dashboard
- Add Customer
- Photo
- GPS location
- Category
- Record Sale
- Cash/Bank/Pending
- Low-price approval
- Inventory
- Incentive
- Sales History
- Profile

**Automations**

- Low-price approval → Admin WhatsApp
- Admin decision → Seller notification
- Confirmed sale → Inventory update
- Confirmed sale → Incentive calculation
- Confirmed sale → Invoice generation
- Invoice → Email/WhatsApp

This is the **requirement-based PRD scope**. It deliberately does not add unrelated features beyond what you specified.

---

### 31. Tech Stack

- **Frontend:** Next.js + TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **Backend:** Node.js + Express.js + TypeScript
- **API:** REST API — `/api/v1/...`
- **Authentication:** JWT only + bcrypt
- **Authorization:** RBAC — Super Admin / Manager / Seller
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Database Platform:** Supabase
- **File/Image Storage:** Supabase Storage
- **Location:** Browser Geolocation API
- **Forms & Validation:** React Hook Form + Zod
- **Invoice:** Server-side PDF Generation
- **WhatsApp:** Twilio WhatsApp API / MSG91
- **Email:** Resend
- **Charts:** Recharts
- **API Documentation:** Swagger / OpenAPI
- **Deployment:** Vercel + Render + Supabase
- **Version Control:** Git + GitHub