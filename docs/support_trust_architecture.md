# Support, Trust And Post-Sale Architecture

## Goal
Close the functional architecture for the public trust layer before building public help center pages.

## Public page map

### Primary navigation
- `/help`
  - public landing for support, documentation and trust entry points
- `/products/[slug]`
  - product-specific support, refund and update expectations

### Footer navigation
- `/help`
- `/help/[categorySlug]`
- `/help/article/[slug]`
- `/policies`
- `/policies/[policyKey]`

### Product page surfaces
- support policy
- refund policy
- update policy
- FAQs
- guides/tutorials
- discussions
- trust signals for seller

### Authenticated user surfaces
- `/orders`
  - purchase history, support entry, dispute entry and buyer-facing post-sale clarity
- `/licenses`
  - ownership library, license state, refund impact, access continuity and historical transparency after refund
- `/support`
  - buyer resolution center, seller ticket queue and next-step clarity without splitting the post-sale meaning across routes
- `/disputes`
  - buyer/admin dispute casework, administrative escalation status, refund outcome and clear expectation-setting for the buyer
- `/seller/products/[id]`
  - seller post-sale continuity, compact trust visibility and product-level reaction signals

## Required public page blocks

### `/help`
- hero with support and trust positioning
- category grid
- featured help articles
- policy shortcuts
- split between buyer help and seller help
- escalation rules: seller support vs marketplace dispute

### `/help/[categorySlug]`
- category header
- article list
- related policy links
- related product or account flows when applicable

### `/help/article/[slug]`
- title, summary and editorial body
- metadata: audience, last review date, related category
- optional related product
- related policies
- escalation CTA

### `/policies`
- policy index
- grouped by buyer, seller and shared policies
- short summaries

### `/policies/[policyKey]`
- full policy content
- last reviewed metadata
- related operational surfaces: orders, licenses, support, disputes

## Public vs private boundaries

### Public
- editorial help content
- marketplace-wide policies
- product support/refund/update policies
- product FAQs and guides
- seller trust signals: badges, identity verification, ratings, purchase/download history aggregates

### Private
- ticket messages
- order-level details
- license keys
- dispute evidence and internal moderation notes
- internal SLA dashboards

## Data model

### Existing tables reused
- `products`
- `product_faqs`
- `product_guides`
- `support_tickets`
- `support_messages`
- `orders`
- `order_items`
- `licenses`
- `downloads`
- `disputes`
- `seller_reputation_snapshots`
- `seller_badges`
- `user_provider_identities`

### New tables
- `help_center_categories`
- `help_center_articles`
- `marketplace_policy_pages`

## Relationship model
- product pages remain the source of seller-specific support, refund and update promises
- help center articles provide reusable public documentation across products and account flows
- policy pages define marketplace-wide rules that support tickets and disputes must follow
- refund outcomes must be reflected consistently across orders, licenses, support and disputes instead of living only in policy copy
- orders link buyers to support and disputes
- licenses and downloads clarify access state after purchase
- support now acts as the buyer-side resolution layer between ownership, active incidents and possible administrative escalation
- buyer-facing post-sale surfaces now reuse a shared clarity layer so the current state, next action and expected outcome stay legible across orders, licenses, support and disputes
- admin dispute resolution now includes explicit post-sale guardrails before refund outcomes are granted
- seller product operations now expose compact post-sale visibility so the seller can react to support, disputes, refunds and revoked access without needing a separate analytics stack
- seller trust data explains whether a buyer should feel confident opening a ticket or buying

## Editorial ownership
- only admins manage help center categories, articles and policy pages
- sellers manage only product-specific support/refund/update guidance plus FAQs and guides

## Release order
1. data layer and route architecture
2. shared retrieval layer
3. public page shells
4. navigation and footer exposure
5. contextual links from product, orders, licenses and support
