# Workflow: User Lifecycle Management

## 1. Overview

This document details the complete end-to-end user provisioning, territorial assignment, credential lifecycle, and deactivation workflows across all three user roles: Super Admin, Manager, and Seller.

---

## 2. End-to-End User Provisioning Sequence

```mermaid
sequenceDiagram
    autonumber
    actor AdminCLI as Dev / Ops Engineer
    actor SuperAdmin as Super Admin
    actor Manager as Regional Manager
    actor Seller as Field Seller
    participant DB as PostgreSQL Database
    
    Note over AdminCLI, DB: Phase 1: Bootstrapping First Super Admin
    AdminCLI->>DB: npm run db:bootstrap-admin
    DB-->>AdminCLI: Super Admin provisioned, HQ created, BusinessSettings initialized
    
    Note over SuperAdmin, DB: Phase 2: Onboarding Regional Manager
    SuperAdmin->>DB: POST /api/v1/admin/managers { name, email, phone, territory, permissions }
    DB-->>SuperAdmin: Manager record created with territory bounds & initial permissions
    
    Note over Manager, DB: Phase 3: Onboarding Field Seller
    alt Onboarded by Regional Manager
        Manager->>DB: POST /api/v1/manager/sellers { name, phone, sub-territory }
        DB-->>Manager: Seller created, bound to Manager, StockLocation auto-created
    else Onboarded by Super Admin
        SuperAdmin->>DB: POST /api/v1/admin/sellers { name, phone, managerId, territory }
        DB-->>SuperAdmin: Seller created, bound to specified Manager, StockLocation auto-created
    end
    
    Note over Seller, DB: Phase 4: First Login & Credential Rotation
    Seller->>DB: POST /api/v1/auth/login { login: phone, password: initialPassword }
    DB-->>Seller: 200 OK + Bearer JWT
    Seller->>DB: PATCH /api/v1/auth/password { currentPassword, newPassword }
    DB-->>Seller: Password updated, tokenVersion incremented
```

---

## 3. Account Deactivation & Session Revocation

When personnel leave the organization or an account is compromised:
1. Super Admin calls `PATCH /api/v1/admin/sellers/:id` or `/api/v1/admin/managers/:id` with `{ "active": false }`.
2. The service executes `database.user.update` with `active: false` and increments `tokenVersion: { increment: 1 }`.
3. Any active JWTs for this user immediately fail signature validation during subsequent requests (`user.tokenVersion !== payload.version` or `!user.active`).
4. Future login attempts are rejected with `401 Unauthorized`.
