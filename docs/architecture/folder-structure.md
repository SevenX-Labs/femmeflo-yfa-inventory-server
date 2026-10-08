# Codebase Folder Structure

## 1. Top-Level Repository Overview

The repository is organized as a modular TypeScript backend application with clear separation of routing, controllers, business services, configuration, and data models.

```text
femmeflo-yfa-inventory-server/
├── docs/                             # Comprehensive system and technical documentation
│   ├── architecture/                 # Architecture, database, folder, and auth design docs
│   ├── roles/                        # Role-based guides, permissions, and module breakdowns
│   ├── shared/                       # Shared platform features (auth, rbac, exports, etc.)
│   ├── api/                          # Master API overview and endpoints catalog
│   ├── workflows/                    # End-to-end business and operational workflows
│   ├── openapi.json                  # OpenAPI 3.0 specification
│   ├── API.md                        # Generated markdown API documentation
│   ├── DATABASE.md                   # Core database schema reference
│   ├── PRD.md                        # Product Requirements Document
│   ├── IMPLEMENTATION.md             # Development schedule and implementation notes
│   ├── POSTMAN_MANUAL_TESTING.md     # Step-by-step Postman testing guide
│   └── *.postman_collection.json     # Postman test collections
│
├── prisma/                           # Database schema and migration management
│   ├── migrations/                   # Checked-in SQL migrations
│   ├── schema.prisma                 # Declarative Prisma schema definition
│   └── seed.ts                       # Database seeding script
│
├── public/                           # Static assets and persistent file storage
│   └── storage/                      # Persistent runtime directory
│       └── invoices/                 # Auto-generated invoice PDFs (YYYY/MM/*.pdf)
│
├── scripts/                          # Administrative and automation CLI tools
│   ├── bootstrap-admin.ts            # CLI script to bootstrap the first Super Admin
│   ├── generate-api-docs.ts          # Generates API.md and openapi.json from routes
│   └── test-connection.ts            # Diagnostic database connection verification
│
├── src/                              # Main application source code
│   ├── config/                       # Runtime configuration and initializers
│   │   ├── database.ts               # Prisma client factory and connection manager
│   │   ├── env.ts                    # Zod-validated environment variable loader
│   │   └── swagger.ts                # Swagger / OpenAPI documentation configuration
│   │
│   ├── constants/                    # Application-wide constants
│   │   └── permissions.ts            # Master permissions list (ALL_PERMISSIONS)
│   │
│   ├── controller/                   # HTTP Request handlers and validation
│   │   ├── admin/                    # Super Admin controllers
│   │   │   ├── approval.controller.ts
│   │   │   ├── dashboard.controller.ts
│   │   │   ├── incentive.controller.ts
│   │   │   ├── inventory.controller.ts
│   │   │   ├── invoice.controller.ts
│   │   │   ├── manager.controller.ts
│   │   │   ├── permission.controller.ts
│   │   │   ├── report.controller.ts
│   │   │   ├── sales.controller.ts
│   │   │   └── seller.controller.ts
│   │   │
│   │   ├── manager/                  # Manager controllers
│   │   │   ├── dashboard.controller.ts
│   │   │   ├── inventory.controller.ts
│   │   │   ├── sales.controller.ts
│   │   │   └── seller.controller.ts
│   │   │
│   │   ├── seller/                   # Seller controllers
│   │   │   ├── dashboard.controller.ts
│   │   │   ├── incentive.controller.ts
│   │   │   ├── inventory.controller.ts
│   │   │   ├── profile.controller.ts
│   │   │   └── sales.controller.ts
│   │   │
│   │   ├── auth/                     # Authentication controllers
│   │   │   └── auth.controller.ts
│   │   │
│   │   ├── category.controller.ts    # Category controller
│   │   ├── category.validation.ts    # Category Zod schemas
│   │   ├── customer.controller.ts    # Unified customer controller (role-aware)
│   │   ├── customer.validation.ts    # Customer Zod schemas
│   │   ├── dashboard.validation.ts   # Dashboard filter Zod schemas
│   │   ├── incentive.validation.ts   # Incentive settings Zod schemas
│   │   ├── inventory.validation.ts   # Inventory receipt, warehouse, transfer Zod schemas
│   │   ├── payment.validation.ts     # Payment collection Zod schemas
│   │   ├── report.validation.ts      # Reporting query Zod schemas
│   │   ├── sales.validation.ts       # Sales creation and listing Zod schemas
│   │   └── user.validation.ts        # User creation, update, listing Zod schemas
│   │
│   ├── generated/                    # Code-generated assets (Prisma client)
│   │   └── prisma/                   # Output of `prisma generate`
│   │
│   ├── middleware/                   # Express HTTP middlewares
│   │   ├── auth.middleware.ts        # Bearer JWT verification and user resolution
│   │   ├── error.middleware.ts       # Global error handler and 404 handler
│   │   ├── rbac.middleware.ts        # Role and permission enforcement guards
│   │   └── validation.ts             # Input parsing helper and reusable Zod primitives
│   │
│   ├── routes/                       # Express router definitions and route mapping
│   │   ├── admin/                    # Super Admin route definitions
│   │   │   ├── approval.routes.ts
│   │   │   ├── customer.routes.ts
│   │   │   ├── dashboard.routes.ts
│   │   │   ├── incentive.routes.ts
│   │   │   ├── inventory.routes.ts
│   │   │   ├── invoice.routes.ts
│   │   │   ├── manager.routes.ts
│   │   │   ├── permission.routes.ts
│   │   │   ├── report.routes.ts
│   │   │   ├── sales.routes.ts
│   │   │   └── seller.routes.ts
│   │   │
│   │   ├── manager/                  # Manager route definitions
│   │   │   ├── customer.routes.ts
│   │   │   ├── dashboard.routes.ts
│   │   │   ├── inventory.routes.ts
│   │   │   ├── sales.routes.ts
│   │   │   └── seller.routes.ts
│   │   │
│   │   ├── seller/                   # Seller route definitions
│   │   │   ├── customer.routes.ts
│   │   │   ├── dashboard.routes.ts
│   │   │   ├── incentive.routes.ts
│   │   │   ├── inventory.routes.ts
│   │   │   ├── profile.routes.ts
│   │   │   └── sales.routes.ts
│   │   │
│   │   ├── auth/                     # Authentication routes
│   │   │   └── auth.routes.ts
│   │   │
│   │   ├── category.routes.ts        # Product category routes
│   │   └── user.routes.ts            # Master routing aggregator and RBAC mounting
│   │
│   ├── services/                     # Core business logic and database interactions
│   │   ├── admin/                    # Super Admin business logic
│   │   │   ├── approval.service.ts
│   │   │   ├── dashboard.service.ts
│   │   │   ├── incentive.service.ts
│   │   │   ├── inventory.service.ts
│   │   │   ├── invoice.service.ts
│   │   │   ├── manager.service.ts
│   │   │   ├── permission.service.ts
│   │   │   ├── report.service.ts
│   │   │   ├── sales.service.ts
│   │   │   └── seller.service.ts
│   │   │
│   │   ├── manager/                  # Manager business logic
│   │   │   ├── dashboard.service.ts
│   │   │   ├── inventory.service.ts
│   │   │   ├── sales.service.ts
│   │   │   └── seller.service.ts
│   │   │
│   │   ├── seller/                   # Seller business logic
│   │   │   ├── dashboard.service.ts
│   │   │   ├── incentive.service.ts
│   │   │   ├── inventory.service.ts
│   │   │   ├── profile.service.ts
│   │   │   └── sales.service.ts
│   │   │
│   │   ├── auth/                     # Authentication business logic
│   │   │   ├── auth.service.ts       # Bcrypt, JWT issuing/verification, password reset
│   │   │   └── auth.types.ts         # User payload and database select projections
│   │   │
│   │   ├── category.service.ts       # Category CRUD logic
│   │   ├── customer.service.ts       # Multi-role customer scoping and persistence
│   │   ├── pdf.service.ts            # PDFKit invoice rendering and disk persistence
│   │   └── user.service.ts           # User CRUD, territory validation, assigned scoping
│   │
│   ├── utils/                        # Shared utility helpers
│   │   └── export.utils.ts           # CSV and ExcelJS streaming/buffer generators
│   │
│   └── app.ts                        # Express application factory and top-level pipeline
│
├── tests/                            # Automated test suite
│   ├── integration/                  # End-to-end integration tests using test DB
│   └── unit/                         # Unit tests and mocks
│
├── server.ts                         # Application entrypoint and process supervisor
├── package.json                      # Dependencies and npm scripts
└── tsconfig.json                     # TypeScript compilation options
```

---

## 2. Directory Responsibilities and Conventions

### 2.1 `src/routes/`
- Every route file defines a factory function accepting dependencies (e.g. `createAdminInventoryRoutes(database: PrismaClient)`).
- Route files do **not** contain SQL or direct business logic. They connect HTTP paths and methods to validation middlewares and controller methods.
- The master routing switchboard is located in [user.routes.ts](file:///c:/Users/Hitesh/Desktop/Inventory-Project/femmeflo-yfa-inventory-server/src/routes/user.routes.ts), where roles (`SUPER_ADMIN`, `MANAGER`, `SELLER`) are strictly guarded using `requireRole`.

### 2.2 `src/controller/`
- Controllers are responsible for parsing incoming request payloads and query strings via `parseInput(schema, request.body)` or `parseInput(schema, request.query)`.
- If validation fails, `parseInput` throws an `HttpError(400)` before any service method is executed.
- Controllers serialize successful service outputs into the standard application response envelope:
  ```json
  {
    "success": true,
    "message": "Human-readable description",
    "data": { ... }
  }
  ```

### 2.3 `src/services/`
- Contains 100% of the domain rules, database interactions, territory checks, and transaction boundaries.
- Services throw typed `HttpError(status, message)` instances on business rule violations (e.g., `404 Not Found`, `409 Conflict`, `403 Forbidden`).
- All services receive the Prisma database client through dependency injection, facilitating unit testing and transaction re-use.

### 2.4 `src/middleware/`
- `auth.middleware.ts`: Extracts `Authorization: Bearer <token>`, validates token signature, checks token version against the user database record, and attaches the sanitized `PublicUser` to `response.locals.authUser`.
- `rbac.middleware.ts`: Inspects `response.locals.authUser` and rejects unauthorized requests with `403 Forbidden` if role or permissions do not match.
- `error.middleware.ts`: Intercepts unhandled errors, formats Prisma and Zod errors, and returns consistent JSON errors without leaking stack traces in production.
