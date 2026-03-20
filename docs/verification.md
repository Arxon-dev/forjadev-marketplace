# Verification

## Current source of truth

This document tracks the verification entry points that are currently expected to pass against the real marketplace implementation.

For seller product operations and editorial guardrails, also see:

- `docs/seller_product_operations.md`
- `docs/editorial_guardrails.md`

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

## Functional verification scripts

Run these scripts when validating the corresponding capability area:

```bash
npm run verify:checkout-lifecycle
npm run verify:download-license-lifecycle
npm run verify:buyer-postpurchase-hub
npm run verify:release-lifecycle
npm run verify:product-promotions-workspace
npm run verify:editorial-guardrails
```

Coverage summary:

- `verify:checkout-lifecycle`
  - checkout creation
  - duplicate-checkout protection
  - order and license issuance
- `verify:download-license-lifecycle`
  - buyer download access
  - revocation blocking
  - license reactivation recovery
- `verify:buyer-postpurchase-hub`
  - `/orders` as buyer post-purchase hub
  - highlighted order confirmation
  - redownload support
  - blocked access for revoked or missing ownership
- `verify:release-lifecycle`
  - seller release lifecycle transitions
  - buyer download pinned to `active`
  - admin approve/reject on `pending`
- `verify:product-promotions-workspace`
  - seller ownership on product promotions
  - product campaigns and coupons inside the workspace
- `verify:editorial-guardrails`
  - admin-only previews
  - published-only public visibility
  - slug protection rules

## Recommended manual flow

1. Register a fresh buyer and confirm `profiles` is created automatically.
2. Open an approved free product and verify download works.
3. Open an approved paid product and verify checkout creates an order and license.
4. Revisit the product page and confirm download is enabled after purchase.
5. Revoke the license from `/admin/licenses` and confirm the product download becomes blocked.
6. Review `/admin/audit` and confirm moderation, checkout and download events appear.

## Recommended buyer manual flow

1. Complete a purchase from an approved paid product.
2. Confirm the redirect lands on `/orders?highlightOrder=...`.
3. Verify the purchased product appears with:
   - access state
   - license state
   - download or redownload action
   - support and dispute continuity
4. Download the product successfully.
5. Revisit `/orders` and confirm redownload remains available.
6. Revoke the license from `/admin/licenses` and confirm `/orders` explains the block clearly.

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
