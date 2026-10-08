# Shared Platform Feature: Authentication System

## 1. Overview

The platform uses a centralized, uniform authentication layer shared across all three active roles: `SUPER_ADMIN`, `MANAGER`, and `SELLER`.

---

## 2. Shared Specifications

| Mechanism | Configuration / Rule | Source Reference |
| --- | --- | --- |
| **Endpoint Base** | `/api/v1/auth/*` | [auth.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/auth/auth.routes.ts) |
| **Token Standard** | RFC 7519 JSON Web Token (`HS256`) | [auth.service.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/auth/auth.service.ts) |
| **Issuer (`iss`)** | `femmeflo-inventory-api` | [auth.service.ts:L9](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/auth/auth.service.ts#L9) |
| **Audience (`aud`)** | `femmeflo-inventory-frontend` | [auth.service.ts:L10](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/auth/auth.service.ts#L10) |
| **Token Expiry** | Configurable via `JWT_EXPIRES_IN`: `15m`, `1h`, `8h`, `1d` (default `1h`) | [env.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/config/env.ts) |
| **Password Algorithm** | Bcrypt with 12 salt rounds, max 72 UTF-8 bytes | [auth.service.ts:L1](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/auth/auth.service.ts#L1) |
| **Rate Limiter** | 20 requests per 15 minutes window on `/login`, `/forgot-password`, `/reset-password` | [auth.routes.ts:L11-L14](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/auth/auth.routes.ts#L11-L14) |
| **Timing Attack Guard** | Compares against `dummyHash` when user is missing | [auth.service.ts:L12](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/auth/auth.service.ts#L12) |
| **Session Invalidation** | `tokenVersion` increments on password change or admin deactivation | [auth.service.ts:L63](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/services/auth/auth.service.ts#L63) |

---

## 3. Endpoints

| Method | Path | Summary | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/login` | User login | Accepts email or phone + password. Returns Bearer token and user profile. |
| `GET` | `/api/v1/auth/me` | Current user | Returns authenticated user profile from database. |
| `PATCH` | `/api/v1/auth/password` | Change password | Validates current password, updates to new password, increments token version. |
| `POST` | `/api/v1/auth/forgot-password` | Request password reset | Issues SHA-256 hashed one-time token valid for 20 minutes. |
| `POST` | `/api/v1/auth/reset-password` | Complete password reset | Consumes reset token and sets new password. |

---

## 4. Role Comparison Matrix for Auth

| Aspect | Super Admin | Manager | Seller |
| --- | --- | --- | --- |
| **Account Creation** | CLI bootstrap script (`npm run db:bootstrap-admin`) | Super Admin via `/admin/managers` | Super Admin (`/admin/sellers`) or Manager (`/manager/sellers`) |
| **Primary Login Identifier** | Email | Email or Phone | Phone or Email |
| **Token Version Checks** | Yes | Yes | Yes |
| **Password Change** | Yes | Yes | Yes |
| **Self-Recovery (Forgot/Reset)** | Yes | Yes | Yes |
