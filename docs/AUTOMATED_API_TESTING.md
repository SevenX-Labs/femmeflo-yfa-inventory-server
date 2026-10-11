# Automated API tests from the Postman guide

Run from the server directory:

```powershell
npm.cmd run test:postman
```

Requires dependencies installed and a reachable `TEST_DATABASE_URL` in the existing `.env`. The database account must be allowed to create schemas. The runner creates a uniquely named schema, applies the checked-in migrations, seeds a test Admin, starts the real Express app on a temporary localhost port, and executes the Postman collection through HTTP. Test accounts, stock and settings stay in that schema. The schema and temporary invoice storage are removed after the run.

The runner reads `postman-manual-testing.postman_collection.json` directly. It orders the 78 examples (75 unique method/path operations) by their dependencies, captures IDs and tokens, and uses separate fixture names for alternative creation routes. It checks expected status and success flags, stock conservation, sale/incentive totals, approval/rejection behavior, export responses, validation, role restrictions, permission revocation, password reset, and deactivation. Additional regression checks exercise same-seller idempotency, cross-seller ownership and payments on rejected sales.

Results are overwritten on each run:

- `POSTMAN_TEST_RESULTS.md`: readable check-by-check results.
- `POSTMAN_TEST_RESULTS.json`: machine-readable results without credentials or tokens.

A nonzero exit means a check failed or a collection example was not executed. The two checks prefixed `SECURITY` and `BUSINESS RULE` assert desired ownership/payment restrictions, beyond the current-behavior examples in the manual guide. Their failures should be treated as defects, not changed to passing expectations.

This suite validates the local application against real PostgreSQL. It does not test a deployed host, concurrent requests, external message delivery, every filter combination, or exact equality of all response fields. An interrupted process may require removal of its generated `inventory_test_<random UUID>` schema; never reset the existing application schema to clean up tests.

The existing authentication/foundation suites can also run separately:

```powershell
node --import tsx --test tests/auth.test.ts tests/foundation.test.ts
```
