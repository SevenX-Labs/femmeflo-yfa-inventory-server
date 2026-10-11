# Automated Postman documentation test results

Executed: 2026-10-08T11:12:03.938Z

Real HTTP requests against the application and a disposable PostgreSQL schema with all migrations. Existing application records were not modified.

Collection examples executed: 78/78. Checks: 118; passed: 116; failed: 2.

Rerun: `npm.cmd run test:postman` (requires TEST_DATABASE_URL in .env).

Checks assert collection HTTP status/success, the main flow stock and financial totals, exports, validation, roles, permissions, and credential invalidation. This does not certify concurrency, deployment infrastructure, or every possible input/filter combination.

| Check | Expected | Actual | Result | Detail |
| --- | --- | --- | --- | --- |
| Check HTTP health | 200 | 200 | PASS |  |
| Check database readiness | 200 | 200 | PASS |  |
| Login as admin | 200 | 200 | PASS |  |
| Create Manager | 201 | 201 | PASS |  |
| Create Seller | 201 | 201 | PASS |  |
| Login as manager | 200 | 200 | PASS |  |
| Login as seller | 200 | 200 | PASS |  |
| Create category | 201 | 201 | PASS |  |
| Create customer as seller | 201 | 201 | PASS |  |
| Get own stock | 200 | 200 | PASS |  |
| Receive 100 packets at HQ | 201 | 201 | PASS |  |
| Transfer 50 packets to seller | 200 | 200 | PASS |  |
| Set price and incentive | 200 | 200 | PASS |  |
| Receipt and transfer conserve total stock | Invariant | — | PASS |  |
| Create confirmed unpaid sale | 201 | 201 | PASS |  |
| Confirmed sale totals and stock | Invariant | — | PASS |  |
| Collect full pending payment | 200 | 200 | PASS |  |
| Payment does not deduct stock again | Invariant | — | PASS |  |
| Create low-price sale for approval | 201 | 201 | PASS |  |
| Pending approval does not deduct stock | Invariant | — | PASS |  |
| List pending approvals | 200 | 200 | PASS |  |
| Approve low-price sale | 200 | 200 | PASS |  |
| Create separate rejection fixture | 201 | 201 | PASS |  |
| Reject a separate low-price sale | 200 | 200 | PASS |  |
| Main flow: stock 35, revenue 35000, incentive 3000, two invoices | Invariant | — | PASS |  |
| Get current account | 200 | 200 | PASS |  |
| List managers | 200 | 200 | PASS |  |
| Get Manager | 200 | 200 | PASS |  |
| Update Manager | 200 | 200 | PASS |  |
| List sellers | 200 | 200 | PASS |  |
| Get Seller | 200 | 200 | PASS |  |
| Update Seller | 200 | 200 | PASS |  |
| List permission names | 200 | 200 | PASS |  |
| Replace Manager permissions | 200 | 200 | PASS |  |
| Replace Manager permissions | 200 | 200 | PASS |  |
| List assigned sellers | 200 | 200 | PASS |  |
| Get assigned seller | 200 | 200 | PASS |  |
| Create seller as Manager | 201 | 201 | PASS |  |
| List categories | 200 | 200 | PASS |  |
| Get category | 200 | 200 | PASS |  |
| Update category | 200 | 200 | PASS |  |
| Create category | 201 | 201 | PASS |  |
| List categories | 200 | 200 | PASS |  |
| Get category | 200 | 200 | PASS |  |
| Update category | 200 | 200 | PASS |  |
| List customers as seller | 200 | 200 | PASS |  |
| Get customer as seller | 200 | 200 | PASS |  |
| Update customer as seller | 200 | 200 | PASS |  |
| Create customer as manager | 201 | 201 | PASS |  |
| List customers as manager | 200 | 200 | PASS |  |
| Get customer as manager | 200 | 200 | PASS |  |
| Update customer as manager | 200 | 200 | PASS |  |
| Create customer as admin | 201 | 201 | PASS |  |
| List customers as admin | 200 | 200 | PASS |  |
| Get customer as admin | 200 | 200 | PASS |  |
| Update customer as admin | 200 | 200 | PASS |  |
| Get stock summary | 200 | 200 | PASS |  |
| Create warehouse | 201 | 201 | PASS |  |
| List warehouses | 200 | 200 | PASS |  |
| List all stock movements | 200 | 200 | PASS |  |
| List own movements | 200 | 200 | PASS |  |
| Get assigned sellers stock | 200 | 200 | PASS |  |
| Read business settings | 200 | 200 | PASS |  |
| List sales as seller | 200 | 200 | PASS |  |
| Get sale as seller | 200 | 200 | PASS |  |
| List sales as manager | 200 | 200 | PASS |  |
| Get sale as manager | 200 | 200 | PASS |  |
| List sales as admin | 200 | 200 | PASS |  |
| Get sale as admin | 200 | 200 | PASS |  |
| List invoices | 200 | 200 | PASS |  |
| Get invoice | 200 | 200 | PASS |  |
| Get own incentives | 200 | 200 | PASS |  |
| Get all seller incentives | 200 | 200 | PASS |  |
| Get seller dashboard | 200 | 200 | PASS |  |
| Get Manager dashboard | 200 | 200 | PASS |  |
| Get Admin dashboard | 200 | 200 | PASS |  |
| Get dashboard filters | 200 | 200 | PASS |  |
| Get seller profile | 200 | 200 | PASS |  |
| Update own profile | 200 | 200 | PASS |  |
| Get sales report | 200 | 200 | PASS |  |
| Get inventory report | 200 | 200 | PASS |  |
| Missing token | 401 | 401 | PASS |  |
| Wrong role | 403 | 403 | PASS |  |
| Malformed UUID | 400 | 400 | PASS |  |
| Unknown query field | 400 | 400 | PASS |  |
| Invalid pagination | 400 | 400 | PASS |  |
| Zero receipt | 400 | 400 | PASS |  |
| Self transfer | 400 | 400 | PASS |  |
| Insufficient transfer stock | 409 | 409 | PASS |  |
| Repeat approval | 409 | 409 | PASS |  |
| Repeat payment | 409 | 409 | PASS |  |
| Invalid payment mode | 400 | 400 | PASS |  |
| Duplicate category | 409 | 409 | PASS |  |
| Unknown route | 404 | 404 | PASS |  |
| sales export csv | 200 | 200 | PASS |  |
| sales export xlsx | 200 | 200 | PASS |  |
| inventory export csv | 200 | 200 | PASS |  |
| inventory export xlsx | 200 | 200 | PASS |  |
| Revoke manager permissions | 200 | 200 | PASS |  |
| Revoked permission takes effect | 403 | 403 | PASS |  |
| Restore manager permissions | 200 | 200 | PASS |  |
| Idempotent sale fixture | 201 | 201 | PASS |  |
| Same seller idempotent replay | 201 | 201 | PASS |  |
| Idempotent replay does not deduct stock | Invariant | — | PASS |  |
| Second seller login for ownership tests | 200 | 200 | PASS |  |
| Other seller cannot read sale | 404 | 404 | PASS |  |
| Second seller customer fixture | 201 | 201 | PASS |  |
| SECURITY: other seller must not obtain sale via requestKey | 403 | 201 | FAIL | Sale confirmed successfully  201 !== 403  |
| BUSINESS RULE: rejected sale must not accept payment | 409 | 200 | FAIL | Pending payment collected successfully  200 !== 409  |
| Change seller password | 200 | 200 | PASS |  |
| Password change invalidates token | 401 | 401 | PASS |  |
| Request seller password reset | 200 | 200 | PASS |  |
| Reset seller password | 200 | 200 | PASS |  |
| Reset token cannot be reused | 400 | 400 | PASS |  |
| Login as seller | 200 | 200 | PASS |  |
| Deactivate test seller | 200 | 200 | PASS |  |
| Deactivation invalidates token | 401 | 401 | PASS |  |
| Deactivated login rejected | 401 | 401 | PASS |  |

Untested examples: None.
