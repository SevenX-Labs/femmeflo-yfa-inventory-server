# Femmeflo Inventory Backend

Backend for the Seller, Manager and Super Admin management system. Implemented so far: PostgreSQL schema/migrations, JWT login, current user, password changes, role/permission middleware, Manager management and Seller onboarding. Customer, stock-operation, sales and external-integration APIs remain in the implementation plan.

## Stack and requirements

Node.js 22.12+ on the 22.x line (or Node 24+), npm, TypeScript, Express 5, Prisma 7 and PostgreSQL/Supabase. Zod validates environment configuration. tsx runs development TypeScript with the repository's existing ES module configuration.

## Install and run

From this repository directory:

```powershell
npm ci
# Copy only if you do not already have a local .env:
Copy-Item .env.example .env
npm run dev
```

Do not overwrite a populated environment file. Without DATABASE_URL and JWT_SECRET in development, the HTTP server starts with authentication unavailable (503). Production requires both. Open http://localhost:5000/api/v1/health; use /api/v1/ready for a live database connection check.

Production build/start commands (remaining PRD modules still need implementation):

```powershell
npm run build
npm start
```

## Environment variables

| Name | Default / purpose |
| --- | --- |
| NODE_ENV | development; accepts development, test or production |
| PORT | 5000; integer 1–65535 |
| CORS_ORIGINS | http://localhost:3000; comma-separated frontend origins without paths or trailing slashes |
| DATABASE_URL | Server-only PostgreSQL URL for Prisma runtime; use a development Supabase project |
| DIRECT_DATABASE_URL | Optional direct/session URL for migrations; defaults to DATABASE_URL |
| JWT_SECRET | Required with DATABASE_URL and in production; random secret of at least 32 characters |
| JWT_EXPIRES_IN | 1h by default; allowed values: 15m, 1h, 8h, 1d |
| ADMIN_NAME | Initial Admin name, used only by the bootstrap command |
| ADMIN_EMAIL | Initial Admin email, normalized to lowercase |
| ADMIN_PASSWORD | Initial Admin password: at least 12 characters, at most 72 UTF-8 bytes; remove after bootstrap |
| TEST_DATABASE_URL | Development direct/session URL for integration tests; tests create and remove their own unique schema |

Generate a JWT secret locally, then put it in .env:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Supabase Storage, Resend and WhatsApp settings will be documented when those modules are implemented. Never commit real credentials. .env remains local and ignored; .env.example is the safe shared template.

## Database setup

1. Create/use a **development** Supabase PostgreSQL project and copy its PostgreSQL connection string into DATABASE_URL. The Supabase project HTTP URL or API key is not a PostgreSQL connection string.
2. If the runtime URL uses a transaction pooler, set DIRECT_DATABASE_URL to a direct or session-pooler URL for migrations. Use a connection reachable from your network; a session pooler may help when direct IPv6 is unavailable. Keep TLS verification enabled.
3. Set JWT_SECRET and the three ADMIN_ values locally.
4. Run:

```powershell
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:bootstrap-admin
npm run dev
```

`db:migrate` applies the checked-in migrations. Do not run it against an unrelated existing database. No reset command is needed. Bootstrap creates the first Super Admin, singleton business settings (incentive remains unset) and an empty HQ. It refuses to replace an existing Admin. Remove ADMIN_PASSWORD from .env afterward.

The migrations enable row-level security without browser policies: use the server-only PostgreSQL table-owner connection. The frontend calls Express with its JWT; it must not query these tables with Supabase anon credentials. [Database design](docs/DATABASE.md) explains the tables and checks. A successful /ready only checks connectivity, not whether all migrations exist.

## Checks

```powershell
npm run typecheck
npm test
npm run build
```

Default tests use Node's test runner and real HTTP requests. Authentication tests use real bcrypt/JWT but stub database persistence; these do not prove PostgreSQL integration. Type checking includes tests and the bootstrap script. No lint configuration currently exists.

For real SQL, transaction, onboarding and scope tests, put a development direct/session URL in TEST_DATABASE_URL, then run:

```powershell
npm run test:integration
```

The integration suite applies migrations inside a unique inventory_test_<random> schema, runs HTTP requests, and removes only that schema. It requires permission to create schemas. It does not drop or reset public tables. Without TEST_DATABASE_URL, this command fails with a setup instruction instead of silently skipping tests.

## API documentation

- [Postman manual testing guide](docs/POSTMAN_MANUAL_TESTING.md) — current mounted routes, required bodies, expected responses, test sequence and negative cases
- [Manual testing Postman collection](docs/postman-manual-testing.postman_collection.json) — import and send requests individually using the guide
- [Implemented API](docs/API.md)
- [OpenAPI document](docs/openapi.json) — import into an OpenAPI-compatible API client; regenerate API.md and OpenAPI with `npm run docs:api`
- [PRD](docs/PRD.md)
- [Requirements, proposed schema, endpoint plan and five-day schedule](docs/IMPLEMENTATION.md)

## Folder structure

```text
server.ts                 Starts/stops the HTTP server
src/app.ts                Express middleware and route mounting
src/config/               Environment and future database configuration
src/routes/               Auth and role-specific route files
src/controller/           HTTP request/response handlers
src/services/             Business rules and database operations
src/middleware/           Error handling and future auth/permission checks
prisma/                   Schema, migrations and initial Admin bootstrap
tests/                    Automated tests
docs/                     PRD, implementation plan and API reference
```

Empty mentor-created feature files are preserved for later PRD modules. See API.md for the routes that actually exist.

## Authentication

POST /api/v1/auth/login accepts assigned email/phone and password. Send the returned JWT as Authorization: Bearer <token>. GET /api/v1/auth/me loads the current account. PATCH /api/v1/auth/password changes the password and invalidates old tokens. All protected requests check active status and current database permissions. No public signup, refresh token or password recovery endpoint exists yet.

Super Admin creates Managers and assigns permissions. Managers need SELLER_CREATE to onboard a Seller and SELLER_READ to list/view assigned Sellers. Seller creation creates an empty stock account in the same transaction. Managers can only access assigned Sellers inside their configured territory. Deactivating a Manager disables that Manager's access; it does not automatically deactivate assigned Sellers.

## Common problems

- Port already in use: set PORT to another available port in .env.
- Invalid environment configuration: check the variable named by the startup error. CORS origins must look like http://localhost:3000, not include a path/trailing slash.
- PowerShell blocks npm.ps1: run npm.cmd instead of npm.
- Database not configured in health: set DATABASE_URL and JWT_SECRET. /ready returns 503 until a connection is available.
- Startup fails with a configured database: check PostgreSQL credentials, network reachability and connection mode. Private connection errors are not returned to clients.
- Missing-table error on login: apply migrations before bootstrapping or logging in.
- Git commands produce no output on this workstation: an extensionless C:\Users\Hitesh\git shadows Git. Use git.exe or C:\Program Files\Git\cmd\git.exe. The project does not modify your system PATH.
