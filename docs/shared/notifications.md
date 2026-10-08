# Shared Platform Feature: Notifications & Delivery

## 1. Overview

The notification subsystem delivers operational alerts across the enterprise. It currently supports database-driven in-app notifications and provides schema tables to support multi-channel external dispatches (Email, WhatsApp).

---

## 2. Notification Event Triggers

| Event Trigger | Recipient(s) | Notification `kind` | Example Message | Status |
| --- | --- | --- | --- | --- |
| **Low-Price Sale Submitted** | All active Super Admins | `LOW_PRICE_APPROVAL_REQUEST` | `"Low-price sale approval request from Amit Patil: 100 packets @ ₹22.00/packet"` | **Implemented** |
| **Low-Price Sale Approved** | Submitting Seller | `LOW_PRICE_SALE_APPROVED` | `"Your low-price sale of 100 packets to Sai Krupa General Store was approved by Admin."` | **Implemented** |
| **Low-Price Sale Rejected** | Submitting Seller | `LOW_PRICE_SALE_REJECTED` | `"Your low-price sale of 100 packets to Sai Krupa General Store was rejected by Admin. Reason: ..."` | **Implemented** |

---

## 3. Database Models

### 3.1 `Notification`
Tracks the internal notification entity:
- `recipientId`: Target user UUID.
- `saleId`: Associated sale order (nullable).
- `kind`: Event identifier string.
- `message`: Text content.
- `readAt`: Timestamp when viewed (nullable).

### 3.2 `Delivery` (External Channels)
Tracks remote third-party dispatch status:
- `invoiceId` or `notificationId`: Parent resource reference.
- `channel`: `EMAIL` or `WHATSAPP`.
- `status`: `PENDING`, `SENT`, or `FAILED`.
- `attempts`: Retry counter.
- `nextAttemptAt`: Backoff timestamp.
- `providerRef`: External vendor message ID.

---

## 4. Current State vs. Planned Features

- **In-App Notifications (Database)**: **Implemented**. Created automatically during sale creation, approval, and rejection in [sales.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/seller/sales.service.ts) and [approval.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/admin/approval.service.ts).
- **External Email (Resend) Dispatcher**: **Needs Verification / Planned Implementation**. Schema models and enums exist in `prisma/schema.prisma`; external delivery background workers and environment API credentials are scheduled in subsequent phases.
- **WhatsApp Cloud API Dispatcher**: **Needs Verification / Planned Implementation**. Schema supports channel `WHATSAPP`; background webhook and provider integration scheduled in subsequent phases.
