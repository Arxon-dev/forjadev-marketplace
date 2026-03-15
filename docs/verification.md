# Verification

## Quick smoke check

Run:

```bash
npm run smoke:marketplace
```

This verifies against the configured Supabase project that:

- approved products remain publicly queryable
- `create_checkout_order` exists and still rejects unauthenticated execution
- `audit_logs` is readable with service-role access
- `licenses` remains reachable for operational inspection

## Recommended manual flow

1. Register a fresh buyer and confirm `profiles` is created automatically.
2. Open an approved free product and verify download works.
3. Open an approved paid product and verify checkout creates an order and license.
4. Revisit the product page and confirm download is enabled after purchase.
5. Revoke the license from `/admin/licenses` and confirm the product download becomes blocked.
6. Review `/admin/audit` and confirm moderation, checkout and download events appear.

## Safe lifecycle verification

Run:

```bash
npm run verify:checkout-lifecycle
```

Behavior:

- by default it stays in safe mode and refuses to create remote users or orders
- if a QA buyer and completed purchase already exist, it validates profile, order, license visibility and duplicate-checkout protection
- to allow creating the QA buyer or the first QA order intentionally, run with `MARKETPLACE_QA_ALLOW_WRITE=1`
- this lifecycle script hits the Supabase RPC directly, and checkout audit logging is now expected from the database function itself

## Download and License lifecycle

Run:

```bash
npm run verify:download-license-lifecycle
```

This verification:

- signs in with the configured QA buyer
- locates an active paid license
- validates that download access is currently allowed
- revokes the license and confirms access becomes blocked
- reactivates the license and confirms access is restored
