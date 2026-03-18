# ForjaDev Ecosystem Implementation Plan

## Objective

Transform ForjaDev from a secure marketplace MVP into a premium creator ecosystem for
game server resources, starting with Rust and expanding to more games over time.

The goal is not only to match marketplaces like Codefling, but to surpass them in:

- trust
- seller operations
- post-sale support
- discoverability
- platform intelligence

---

## North Star

ForjaDev should become the operating system for server creators and server owners:

- creators publish, update, support and monetize products
- buyers discover, compare, trust, purchase and manage resources
- admins moderate with full visibility and low operational friction
- the platform itself improves conversion, retention and trust over time

---

## Strategic Pillars

### 1. Marketplace Depth
- Rich categories, subcategories and filters
- Better search and ranking
- Stronger product presentation
- Curated discovery surfaces

### 2. Trust and Reputation
- Public seller reputation
- Product quality signals
- Verified reviews
- Clear changelogs, policies and support expectations

### 3. Post-Sale Operations
- Support flows
- Update notifications
- License and download management
- Buyer success tooling

### 4. Creator Monetization
- Deals, coupons and bundles
- Analytics and conversion insights
- Better pricing controls
- Promotion tooling

### 5. Community Layer
- Discussions
- Collections
- Follow and wishlist mechanics
- Lightweight social graph around products and creators

### 6. Platform Intelligence
- Ranking based on quality and trust
- Fraud and abuse detection
- Moderation scoring
- Performance analytics for products and sellers

---

## Current Baseline

ForjaDev already has strong foundations:

- auth SSR
- buyer and seller flows
- product creation and editing
- storage with protected downloads
- orders, licenses and audits
- admin moderation
- production deployment on Railway

This means the next phase is not foundational CRUD. The next phase is ecosystem design.

---

## Target State

The target platform should include these capability areas:

### Discovery
- category pages
- game-specific landing pages
- advanced filters
- featured collections
- trending, popular and recently updated feeds
- search with weighted ranking

### Product Experience
- richer media galleries
- changelog timeline
- FAQ per product
- support policy visibility
- compatibility matrix
- version history and release notes

### Seller Experience
- public seller profile pages
- seller reputation and badges
- analytics dashboard
- support queue
- promotion tools
- payout and revenue visibility

### Buyer Experience
- library management
- wishlist
- follow sellers
- update alerts
- purchase history with support linkage
- personalized recommendations

### Support and Community
- product discussions
- support tickets
- tutorials and setup guides
- moderation-aware community threads
- collections curated by staff and users

### Governance and Safety
- anti-fraud checks
- seller risk scoring
- license abuse detection
- moderation queues with priority signals
- dispute workflows

---

## Implementation Roadmap

## Phase 0 - Platform Hardening

Goal: make the current marketplace production-ready before layering ecosystem complexity.

### Deliverables
- finish remaining verification flows from `docs/verification.md`
- confirm GitHub -> Railway auto-deploy without manual intervention
- rotate any exposed operational tokens
- document production checklist and rollback path
- validate storage upload rules with real files

### Exit Criteria
- all existing flows verified end-to-end
- production deploy repeatable and documented
- no known auth, download or seller blockers

---

## Phase 1 - Discovery Upgrade

Goal: make the catalog feel alive, navigable and commercially strong.

Detailed execution plan:
- `docs/phase_1_discovery_upgrade_plan.md`

### Product Features
- categories and subcategories
- search query parsing
- filters for game, category, pricing, compatibility, rating, updated date
- sort by trending, best rated, latest, price, most downloaded
- featured collections on the homepage
- staff picks and trending modules

### Database Impact
- `categories`
- `product_categories`
- optional `games`
- denormalized popularity metrics on `products`

### UI/Routes
- `/categories/[slug]`
- `/games/[slug]`
- improved `/products`
- new homepage modules

### Exit Criteria
- users can narrow catalog intent in 2-3 clicks
- homepage reflects live platform activity

---

## Phase 2 - Trust Layer

Goal: increase buyer confidence and improve seller quality signaling.

### Product Features
- public seller profile page
- seller badges: verified, top seller, fast support, highly rated
- review aggregates on cards and detail pages
- changelog and release notes surfaced prominently
- FAQ and support expectations per product
- refund/support policy fields

### Database Impact
- `seller_badges`
- `product_faqs`
- `seller_reputation_snapshots`
- optional `product_metrics_daily`

### UI/Routes
- `/seller/[slug]`
- seller card modules
- trust widgets on product page

### Exit Criteria
- every paid product communicates trust, maintenance and support quality clearly

---

## Phase 3 - Post-Sale Support System

Goal: convert downloads into a managed customer lifecycle.

### Product Features
- support tickets per product purchase
- seller support inbox
- buyer support center
- update notifications for owned products
- installation guides and tutorials
- issue status tracking

### Database Impact
- `support_tickets`
- `support_messages`
- `product_guides`
- `user_notifications`

### UI/Routes
- `/support`
- `/support/tickets/[id]`
- seller support queue inside `/seller`

### Exit Criteria
- a buyer can move from purchase to help resolution without leaving the platform

---

## Phase 4 - Monetization Expansion

Goal: give sellers real commercial leverage and improve platform GMV.

### Product Features
- coupons
- bundles
- flash deals
- launch discounts
- featured placements
- seller analytics: views, conversion, revenue, downloads, refunds

### Database Impact
- `coupons`
- `bundle_products`
- `campaigns`
- `product_analytics_daily`

### UI/Routes
- seller promotions area
- homepage deals rail
- campaign widgets on product pages

### Exit Criteria
- sellers can run promotions without admin dependency
- buyers see meaningful commercial offers

---

## Phase 5 - Community Layer

Goal: increase retention and platform defensibility.

### Product Features
- product discussions
- creator announcements
- user collections
- wishlists
- follow sellers
- activity feed

### Database Impact
- `product_discussions`
- `discussion_messages`
- `collections`
- `collection_items`
- `seller_followers`
- `wishlists`

### UI/Routes
- `/collections`
- `/collections/[slug]`
- discussion modules in product pages
- user activity surfaces

### Exit Criteria
- platform has recurring non-transactional engagement

---

## Phase 6 - Identity and Ecosystem Integrations

Goal: reduce friction and align with the real game-server ecosystem.

### Product Features
- Discord login
- Steam login
- seller Discord links
- community identity verification
- optional server/team accounts later

### Database Impact
- provider identity mappings
- optional organization tables for team sellers

### Exit Criteria
- sign-in matches the habits of the target niche

---

## Phase 7 - Admin and Risk Intelligence

Goal: scale moderation and platform safety without scaling chaos.

### Product Features
- risk scoring for products and sellers
- moderation queue prioritization
- fraud alerts
- suspicious license activity detection
- dispute workflows

### Database Impact
- `risk_events`
- `moderation_flags`
- `license_anomalies`
- `disputes`

### Exit Criteria
- admins can act faster with better signal and less manual investigation

---

## Phase 8 - Platform Intelligence

Goal: use data to improve conversion and retention.

### Product Features
- ranking by quality and trust
- personalized recommendations
- "users also bought"
- "similar products"
- seller health scoring

### Data/Infra
- event pipeline for product views, clicks, add-to-cart, purchases, downloads
- analytics jobs for aggregates
- ranking jobs

### Exit Criteria
- discovery quality improves with platform usage

---

## Recommended Build Order

Do not build this in the order of what sounds exciting. Build in the order of leverage:

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 7
8. Phase 6
9. Phase 8

Reason:
- discovery and trust improve conversion fastest
- support improves retention and seller quality
- monetization improves revenue after conversion basics exist
- community only becomes valuable after transactions are healthy
- intelligence is strongest once enough events exist

---

## Success Metrics

### Commercial
- GMV
- conversion rate
- average order value
- repeat purchase rate

### Trust
- review rate
- refund rate
- support response time
- seller reputation score

### Discovery
- search-to-click rate
- product page CTR
- homepage module CTR
- zero-result search rate

### Retention
- wishlist growth
- seller follows
- return sessions
- update-driven re-engagement

### Operations
- moderation SLA
- fraud detection lead time
- dispute resolution time

---

## Risks

### Risk 1: Building community too early
If the catalog and trust layers are weak, community features become empty shells.

### Risk 2: Overbuilding seller tooling before discovery
Sellers do not need ten controls if traffic and conversion are weak.

### Risk 3: Social features without moderation maturity
Discussions and user content increase abuse surface immediately.

### Risk 4: Data ambition without event discipline
Ranking and recommendations fail if instrumentation is inconsistent.

---

## Elite Standard for Execution

Every phase should satisfy these conditions before moving forward:

- schema and RLS reviewed
- UI premium and coherent on desktop and mobile
- metrics instrumented
- admin visibility included
- docs updated
- production verification completed

---

## Immediate Next Step

The best next implementation track for ForjaDev is:

1. Phase 0 hardening closeout
2. Phase 1 discovery upgrade
3. Phase 2 trust layer

That is the shortest path from "secure MVP" to "credible ecosystem platform".
