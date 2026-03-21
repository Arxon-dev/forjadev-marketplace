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
npm run verify:buyer-library-licenses
npm run verify:buyer-resolution-flow
npm run verify:buyer-postsale-transparency
npm run verify:admin-risk-dispute-tooling
npm run verify:discovery-navigation-spine
npm run verify:editorial-help-commerce-integration
npm run verify:frontend-premium-shopping-journey
npm run verify:marketplace-quality-signals
npm run verify:bundles-commercial-block
npm run verify:campaigns-merchandising-block
npm run verify:product-discussions-trust-layer
npm run verify:product-health-intelligence
npm run verify:collections-feed-engagement-loop
npm run verify:account-control-center
npm run verify:seo-catalog-taxonomy
npm run verify:disputes-casework
npm run verify:refunds-postsale-resolution
npm run verify:postsale-risk-guardrails
npm run verify:seller-postsale-visibility
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
- `verify:buyer-library-licenses`
  - `/licenses` as buyer ownership and access center
  - active versus revoked license clarity
  - redownload continuity
  - empty state for buyers without purchases
- `verify:buyer-resolution-flow`
  - `/support` as buyer resolution center
  - ticket continuity with orders, licenses and disputes
  - escalation visibility and blocking for non-owned products
- `verify:buyer-postsale-transparency`
  - shared buyer-facing post-sale clarity across `/orders`, `/licenses`, `/support` and `/disputes`
  - next-action and expectation messaging without reworking post-sale business logic
  - transparency hardening without exposing buyer-internal identifiers
- `verify:admin-risk-dispute-tooling`
  - admin triage queue inside `/admin/risk`
  - visible priority ordering for active disputes
  - continuity of that priority inside `/admin/disputes/[disputeId]`
- `verify:discovery-navigation-spine`
  - shared discovery spine across `/products`, `/categories`, `/categories/[slug]`, `/games` and `/games/[slug]`
  - public navigation continuity from catalog browsing to product detail
  - stable browse structure that can support later SEO work
- `verify:editorial-help-commerce-integration`
  - product-detail integration between public help content, marketplace policies and the buying decision
  - continuity from product detail into `/help/article/[slug]` and `/policies/[policyKey]`
  - continuity back from the related help article into `/products/[slug]`
- `verify:frontend-premium-shopping-journey`
  - shared premium framing across home, catalog, category, game and product-detail public surfaces
  - stronger commercial hierarchy without changing marketplace business logic
  - continuity of premium cards and browse stages from discovery into the product page
- `verify:marketplace-quality-signals`
  - shared pre-purchase trust snapshot across catalog, category, game and product-detail surfaces
  - visible seller context, maintenance recency and policy clarity without introducing heavy scoring
  - continuity of those signals from discovery into the product page
- `verify:bundles-commercial-block`
  - public `/bundles` listing as a first-class commercial browse surface
  - continuity from bundle listing into `/bundles/[slug]` and `/checkout/bundles/[bundleId]`
  - header navigation and bundle detail clarity without reworking seller or pricing logic
- `verify:campaigns-merchandising-block`
  - public `/deals` as a first-class campaigns and merchandising surface
  - visible promotional value across placements, product deals and bundle deals
  - continuity from the merchandising landing into product and bundle detail
- `verify:product-discussions-trust-layer`
  - product discussions as a visible trust layer inside product detail and thread detail
  - seller-response visibility, thread status clarity and continuity with the shopping journey
  - useful conversation context without opening a broad social layer
- `verify:product-health-intelligence`
  - shared seller/admin intelligence snapshot for a product
  - actionable reading that combines traction, conversion and post-sale friction
  - continuity with existing seller workspace and admin review surfaces
- `verify:collections-feed-engagement-loop`
  - `/feed` as a return destination built from wishlist, followed sellers and public collections
  - relevant collection matches that connect saved intent with fresh discovery
  - empty-state activation when the buyer has not yet seeded the loop
- `verify:account-control-center`
  - `/account` as a dedicated user control center instead of read-only account fragments inside `/dashboard`
  - editable profile identity plus linked-identity visibility
  - continuity to orders, licenses, feed and collections through account shortcuts
- `verify:seo-catalog-taxonomy`
  - route-level metadata for `/`, `/products`, `/categories`, `/categories/[slug]`, `/games`, `/games/[slug]` and `/products/[slug]`
  - canonical and robots policy for base catalog versus filtered query states
  - SEO-safe continuity between public discovery routes and product landings
- `verify:disputes-casework`
  - `/disputes` as buyer dispute workspace
  - dispute detail continuity with orders, licenses and support tickets
  - admin dispute detail and state transitions
- `verify:refunds-postsale-resolution`
  - refund posture visibility in `/orders` and buyer support tickets
  - admin refund outcome from dispute detail
  - alignment between refunded order, revoked license and resolved dispute
- `verify:postsale-risk-guardrails`
  - admin dispute guardrails for repeat refunds, revoked licenses and anomalies
  - refund blocked until the case is in `reviewing`
  - risk event creation when a refund is issued under relevant post-sale signals
- `verify:seller-postsale-visibility`
  - seller product-level post-sale continuity in workspace and support routes
  - visibility of disputes, refunds, revoked licenses and risk signals without exposing buyer-private evidence
  - ownership guardrails and stable-state empty messaging
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

## Recommended buyer library flow

1. Open `/licenses` with a buyer that owns at least one active product.
2. Verify the page explains:
   - owned product
   - license status
   - real access state
   - last download or redownload state
3. Confirm blocked products explain whether the cause is revocation or missing access.
4. Confirm continuity to:
   - `/orders`
   - `/support`
   - `/products/[slug]`

## Recommended buyer resolution flow

1. Open `/support` with a buyer that owns at least one purchased product.
2. Confirm the ticket queue shows:
   - ticket status
   - next action
   - last activity
   - related order and license state
3. Open a ticket detail and confirm it links back to:
   - `/orders`
   - `/disputes`
   - `/products/[slug]`
4. Confirm that a buyer without ownership cannot open support for a locked product.
5. Confirm that an active dispute is visible from both the support queue and the ticket detail.

## Recommended disputes casework flow

1. Open `/disputes` with a buyer that already opened an active dispute.
2. Verify the queue explains:
   - current status
   - next action
   - linked order
   - linked support continuity
3. Open `/disputes/[disputeId]` and confirm the detail page shows:
   - product
   - order
   - license
   - support ticket continuity
   - timeline from audit
4. Open `/admin/disputes/[disputeId]` with an admin and confirm the case can be reviewed and updated.

## Recommended refunds post-sale flow

1. Open `/orders` for a buyer with a completed purchase and confirm each item explains the current refund posture.
2. Open a related support ticket and confirm the ticket detail shows:
   - result label
   - next action
   - link to the refund policy
3. Escalate to `/disputes/[disputeId]` and confirm the buyer sees whether the refund is under review, rejected or already issued.
4. Open `/admin/disputes/[disputeId]` as admin and confirm the case can:
   - move to reviewing
   - issue a refund from the dispute
5. Confirm the refund outcome aligns all affected surfaces:
   - order status becomes `refunded`
   - license becomes `revoked`
   - dispute becomes `resolved`
   - `/licenses` still explains the product as owned historically but blocked after refund

## Recommended post-sale guardrails flow

1. Open `/admin/disputes/[disputeId]` on a case with previous refunds, revoked licenses or anomalies.
2. Confirm the page shows:
   - guardrails summary
   - counts for refunds, disputes and revoked licenses
   - actionable risk signals before resolving
3. Try to issue a refund while the dispute is still `open` and confirm it is blocked.
4. Move the dispute to `reviewing` and then issue the refund.
5. Confirm `/admin/risk` receives a new open event when the refund was issued under relevant post-sale signals.

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
