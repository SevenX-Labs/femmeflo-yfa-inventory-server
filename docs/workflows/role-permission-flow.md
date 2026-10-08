# Workflow: End-to-End Operational Supply Chain & Sales Cycle

## 1. Overview of the Complete Operational Cycle

The FemmeFlo system automates the complete operational lifecycle from bulk manufacturing receipt to retail payment collection:

```text
1. HQ Stock Receipt
       ↓
2. Warehouse Staging Transfer
       ↓
3. Seller Field Stock Transfer
       ↓
4. Customer / Shop Onboarding
       ↓
5. Field Sale Execution (Standard vs. Low-Price)
       ↓
6. (If Low-Price) Super Admin Approval
       ↓
7. Automated Inventory Deduction & Movement Record
       ↓
8. Invoice Snapshot Creation & PDF Generation
       ↓
9. Payment Collection (CASH, BANK, or PENDING Resolution)
       ↓
10. Seller Incentive Credited
       ↓
11. Executive Analytics & Reports Updated
```

---

## 2. End-to-End Swimlane Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Super Admin
    actor Manager as Regional Manager
    actor Seller as Field Seller
    actor Shop as Customer / Shop
    participant API as Express API Server
    participant DB as PostgreSQL Database
    participant Disk as Local File Storage

    Note over Admin, Disk: 1. Stock Receipt at HQ
    Admin->>API: POST /api/v1/admin/inventory/receipts { quantity: 10000 }
    API->>DB: Increment HQ balance; Insert StockMovement(RECEIPT)
    DB-->>Admin: HQ Stock = 10,000 packets

    Note over Admin, Disk: 2. Transfer to Regional Transit Warehouse
    Admin->>API: POST /api/v1/admin/inventory/transfers { source: HQ, dest: Warehouse, quantity: 4000 }
    API->>DB: Atomic Tx: HQ -= 4000; Warehouse += 4000; StockMovement(TRANSFER)
    DB-->>Admin: HQ = 6,000; Warehouse = 4,000

    Note over Admin, Disk: 3. Transfer from Warehouse to Field Seller
    Admin->>API: POST /api/v1/admin/inventory/transfers { source: Warehouse, dest: SellerLoc, quantity: 500 }
    API->>DB: Atomic Tx: Warehouse -= 500; SellerLoc += 500; StockMovement(TRANSFER)
    DB-->>Admin: SellerLoc balance = 500

    Note over Seller, Shop: 4. Customer Onboarding
    Seller->>API: POST /api/v1/seller/customers { shopName, contact, phone, category, territory, GPS }
    API->>DB: Insert Customer record bound to Seller ID
    DB-->>Seller: Customer created

    Note over Seller, Shop: 5. Direct Sale Recorded
    alt Standard Sale (unitPricePaise >= 2500)
        Seller->>API: POST /api/v1/seller/sales { customerId, quantity: 50, unitPricePaise: 2500, paymentMode: CASH }
        API->>DB: Atomic Tx: SellerLoc -= 50; StockMovement(SALE); Sale(CONFIRMED); Invoice; PaymentRecord
        API->>Disk: Async PDFKit renders /storage/invoices/2026/04/INV-xxx.pdf
        DB-->>Seller: Sale confirmed immediately + Invoice reference
    else Low-Price Sale (unitPricePaise < 2500)
        Seller->>API: POST /api/v1/seller/sales { customerId, quantity: 50, unitPricePaise: 2200, paymentMode: CASH }
        API->>DB: Insert Sale(status: PENDING_APPROVAL); Notify Super Admins
        DB-->>Seller: Sale recorded as PENDING_APPROVAL (No stock deducted)
        
        Admin->>API: POST /api/v1/admin/approvals/:id/approve
        API->>DB: Atomic Tx: SellerLoc -= 50; StockMovement(SALE); Sale(CONFIRMED); Invoice; Notify Seller
        API->>Disk: Async PDFKit renders invoice PDF
        DB-->>Admin: Sale approved
    end

    Note over Seller, Shop: 6. Payment Resolution & Incentive
    alt If Payment was PENDING at sale
        Seller->>API: PATCH /api/v1/seller/sales/:id/payment { mode: "CASH" }
        API->>DB: Sale.paymentMode = CASH; Insert PaymentRecord
        DB-->>Seller: Payment collected
    end
    
    Seller->>API: GET /api/v1/seller/incentives
    DB-->>Seller: Incentive credited (50 packets * ₹2.00 = ₹100.00)

    Note over Admin, Manager: 7. Analytics & Dashboard Inspection
    Admin->>API: GET /api/v1/admin/dashboard
    DB-->>Admin: KPI metrics updated in real-time
    Admin->>API: GET /api/v1/admin/reports/sales?format=xlsx
    API-->>Admin: Binary Excel workbook with sale details
```
