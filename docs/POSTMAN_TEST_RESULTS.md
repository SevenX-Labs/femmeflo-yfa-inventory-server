# Automated Postman documentation test results

Executed: 2026-11-23T16:23:33.953Z

Real HTTP requests against the application and a disposable PostgreSQL schema with all migrations. Existing application records were not modified.

Collection examples executed: 0/78. Checks: 1; passed: 0; failed: 1.

Rerun: `npm.cmd run test:postman` (requires TEST_DATABASE_URL in .env).

Checks assert collection HTTP status/success, the main flow stock and financial totals, exports, validation, roles, permissions, and credential invalidation. This does not certify concurrency, deployment infrastructure, or every possible input/filter combination.

| Check | Expected | Actual | Result | Detail |
| --- | --- | --- | --- | --- |
| Runner/setup | Invariant | — | FAIL | connect ENETUNREACH 2406:da1a:b00:1301:d99f:f53d:8653:5582:5432 - Local (:::0) |

Untested examples: Check HTTP health, Check database readiness, Login as admin, Login as manager, Login as seller, Get current account, Create Manager, List managers, Get Manager, Update Manager, Create Seller, List sellers, Get Seller, Update Seller, List permission names, Replace Manager permissions, Replace Manager permissions, List assigned sellers, Get assigned seller, Create seller as Manager, Create category, List categories, Get category, Update category, Create category, List categories, Get category, Update category, Create customer as seller, List customers as seller, Get customer as seller, Update customer as seller, Create customer as manager, List customers as manager, Get customer as manager, Update customer as manager, Create customer as admin, List customers as admin, Get customer as admin, Update customer as admin, Get stock summary, Create warehouse, List warehouses, Receive 100 packets at HQ, Transfer 50 packets to seller, List all stock movements, Get own stock, List own movements, Get assigned sellers stock, Read business settings, Set price and incentive, Create confirmed unpaid sale, Create low-price sale for approval, List sales as seller, Get sale as seller, List sales as manager, Get sale as manager, List sales as admin, Get sale as admin, Collect full pending payment, List pending approvals, Approve low-price sale, Reject a separate low-price sale, List invoices, Get invoice, Get own incentives, Get all seller incentives, Get seller dashboard, Get Manager dashboard, Get Admin dashboard, Get dashboard filters, Get seller profile, Update own profile, Get sales report, Get inventory report, Change seller password, Request seller password reset, Reset seller password.
