# API test findings — 8 October 2026

All 75 mounted API operations were matched to the Postman collection. All 78 collection examples passed in the final run. Of 118 total checks, 116 passed and two additional regression checks failed. The existing authentication and foundation suites also passed 24/24 tests.

Tests used real HTTP requests to the local Express application and real PostgreSQL with a disposable schema containing the checked-in migrations. Existing application records were not changed. Final-run schema and temporary invoice files were removed. API implementation code was not changed.

## High: cross-seller sale disclosure through requestKey

Endpoint: `POST /api/v1/seller/sales`.

1. Seller A creates a sale with a unique `requestKey`.
2. Seller B creates their own valid customer.
3. Seller B submits a sale for that customer, reusing Seller A's key.
4. Actual: HTTP 201 and the existing sale are returned. Expected: reject access to the other seller's sale (the regression check expects HTTP 403).

The service validates the submitted customer's ownership, but then looks up `requestKey` globally and returns the matching sale without checking its seller. See `src/services/seller/sales.service.ts:46`. A caller needs an existing key to exploit this. Normal cross-seller GET access correctly returned 404, and same-seller replay correctly avoided a second stock deduction.

## High: rejected sales accept payment

Endpoint: `PATCH /api/v1/seller/sales/:id/payment`.

1. Create a low-price sale with PENDING payment.
2. Reject it through the Admin approval endpoint.
3. Collect CASH payment on the rejected sale.
4. Actual: HTTP 200, "Pending payment collected successfully". Expected: HTTP 409 and no collection for a rejected sale.

The payment service checks ownership and payment mode but does not require CONFIRMED status. See `src/services/seller/sales.service.ts:266`.

## Intermittent: stock transfer returned HTTP 500

One intermediate run returned HTTP 500 for a valid HQ-to-seller transfer. Its dependent stock/sale checks failed and remaining examples could not run. The same transfer passed earlier runs and the final run. The response and server log did not expose the underlying exception, so the cause is unconfirmed. Evidence is retained in `POSTMAN_TEST_INTERRUPTED_RUN.json`; do not treat this as a reproducibly fixed issue.

## Evidence and rerun

- `POST
- MAN_TEST_RESULTS.md` and `.json`: final 118-check run, including expected/actual statuses.
- `AUTOMATED_API_TESTING.md`: setup, scope and limitations.
- `npm.cmd run test:postman`: reruns the suite; currently exits nonzero for the two confirmed defects.

The suite checks status/success for every collection example plus targeted financial, stock, export and access-control assertions. It does not certify all response fields, every filter combination, concurrency or the deployed environment.
