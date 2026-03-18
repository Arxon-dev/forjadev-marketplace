# Phase 1 Discovery Upgrade Plan

## Goal

Upgrade ForjaDev discovery from a basic catalog into a high-conversion marketplace surface.

This phase should make it dramatically easier for buyers to:

- find the right product quickly
- compare products with confidence
- navigate by intent, game and category
- discover new and trending products

This is the highest-leverage ecosystem phase because it improves conversion before we add
heavier systems like support, community or advanced monetization.

---

## Product Outcome

After this phase, ForjaDev should feel closer to a real commercial marketplace, not only a
working catalog.

Users should be able to:

- browse by category
- browse by game
- filter deeply
- sort intelligently
- discover featured, trending and recently updated products
- reach relevant products in 2-3 clicks

---

## Scope

## In Scope

- categories and subcategories
- game taxonomy
- richer filtering
- better sorting
- homepage discovery rails
- category and game landing pages
- product ranking foundations
- lightweight popularity metrics

## Out of Scope

- recommendations
- coupons and deals engine
- seller reputation
- support center
- community discussions

Those belong to later phases.

---

## Current Gaps

Today the platform has:

- a homepage with highlighted products
- a products listing
- product detail pages
- seller and admin workflows

But discovery is still shallow because:

- products are not truly organized into categories/subcategories
- there is no game navigation model
- sorting is limited
- trending/popularity are not surfaced
- homepage modules are not intent-based
- buyers cannot browse the catalog like a marketplace ecosystem

---

## Target User Journeys

### Journey 1: Intent Browsing
- user lands on homepage
- clicks `Plugins` or `Maps`
- filters by `Rust`, `Free`, `Highest rated`
- reaches a shortlist fast

### Journey 2: Problem-Solving Discovery
- user wants wipe progression or admin tools
- uses search and filter combination
- sees best-matching products ranked above generic results

### Journey 3: Exploration
- user browses trending or recently updated products
- discovers new sellers and niche tools

---

## Information Architecture

## Top-Level Taxonomy

### Games
- Rust
- future-ready for more games later

### Categories
- Plugins
- Maps
- Assets
- Tools
- Services

### Optional Subcategories
- Economy
- Raiding
- PvP
- Admin
- Building
- Wipe Systems
- UI
- Performance

Do not hard-code these into UI constants only. Persist them in the database.

---

## Database Design

## New Tables

### `games`
- `id uuid primary key`
- `name text not null unique`
- `slug text not null unique`
- `is_active boolean not null default true`
- `sort_order integer not null default 0`
- `created_at timestamptz not null default now()`

### `categories`
- `id uuid primary key`
- `name text not null`
- `slug text not null unique`
- `description text`
- `parent_id uuid references public.categories(id) on delete set null`
- `is_active boolean not null default true`
- `sort_order integer not null default 0`
- `created_at timestamptz not null default now()`

### `product_categories`
- `product_id uuid not null references public.products(id) on delete cascade`
- `category_id uuid not null references public.categories(id) on delete cascade`
- composite primary key `(product_id, category_id)`

## Product Extensions

Add to `products`:

- `game_id uuid references public.games(id) on delete set null`
- `featured boolean not null default false`
- `search_text text`
- `view_count integer not null default 0`
- `download_count integer not null default 0`
- `purchase_count integer not null default 0`
- `rating_average numeric(3,2) not null default 0`
- `rating_count integer not null default 0`
- `updated_at timestamptz` if not already aligned for ranking

## Notes

- `rating_average` and `rating_count` should be denormalized, not recalculated on every list page.
- popularity fields can be updated asynchronously or transactionally in lightweight form.
- keep RLS readable: taxonomy tables can be public-read.

---

## RLS and Security

### Public Read
- `games`
- `categories`
- `product_categories`

### Seller Write Restrictions
- sellers can assign categories/games only for products they own
- admin can override or clean taxonomy

### Admin Controls
- admin can activate/deactivate categories and games
- admin can reorder taxonomy

---

## Backend Changes

## Listing Queries

Refactor product listing fetches to support:

- free/paid
- game
- category
- subcategory
- rating threshold
- updated date
- trending
- newest
- best rated
- most downloaded

## Ranking Model v1

Use a simple weighted marketplace score:

- approved products only
- recency boost
- rating boost
- purchase/download boost
- featured boost

Example direction:

`score = featured_weight + recency_weight + rating_weight + purchase_weight + download_weight`

Keep this first version simple and inspectable.

## Search v1

Use title + short description + taxonomy fields for structured querying.

If staying fully in Postgres for now:

- use `ilike` plus weighted fields for v1
- prepare `search_text` for later full-text search

Do not overengineer external search yet unless scale proves it necessary.

---

## UI and Route Plan

## New Routes

### `/categories/[slug]`
Category landing page with:
- category intro
- subcategories
- filtered product grid

### `/games/[slug]`
Game landing page with:
- game hero
- top categories for that game
- trending products
- recent releases

## Route Upgrades

### `/`
Homepage should include:
- featured products
- trending now
- recently updated
- free to start
- browse by category
- browse by game

### `/products`
Upgrade filters and sort options:
- search
- pricing
- game
- category
- subcategory
- compatibility
- rating
- sort

### `/products/[slug]`
Add discovery support:
- related products
- more from seller
- category/game breadcrumbs

---

## Component Plan

## New Components

### Discovery Navigation
- `src/components/discovery/category-grid.tsx`
- `src/components/discovery/game-grid.tsx`
- `src/components/discovery/discovery-rail.tsx`

### Filters and Sorting
- `src/components/marketplace/product-filters-advanced.tsx`
- `src/components/marketplace/sort-select.tsx`
- `src/components/marketplace/active-filters.tsx`

### Metadata Display
- `src/components/marketplace/category-badge.tsx`
- `src/components/marketplace/rating-pill.tsx`
- `src/components/marketplace/product-stats.tsx`

### Homepage Modules
- `src/components/home/featured-rail.tsx`
- `src/components/home/trending-rail.tsx`
- `src/components/home/recently-updated-rail.tsx`
- `src/components/home/browse-categories.tsx`

## Existing Components to Upgrade

- `product-card`
- `product-filters`
- homepage sections
- product detail sidebar/header

---

## Analytics and Event Tracking

This phase should start event discipline, even if lightweight.

## Events to Capture

- product list impression
- product card click
- filter applied
- search executed
- category visited
- game visited
- product detail opened

## Why Now

Discovery quality cannot improve later without event data.

At minimum, record enough to support:

- CTR by homepage rail
- CTR by category
- search success rate
- zero-result rate

---

## Delivery Sequence

## Step 1 - Taxonomy Foundation
- create `games`, `categories`, `product_categories`
- seed Rust and initial categories
- add `game_id` and discovery metric fields to `products`
- update types and docs

## Step 2 - Seller Taxonomy Assignment
- allow seller product form to assign game and categories
- validate ownership and moderation-safe updates

## Step 3 - Listing Query Upgrade
- extend `/products` server query
- support advanced filters and sort
- keep performance acceptable with indexes

## Step 4 - Homepage Discovery Modules
- featured
- trending
- recently updated
- browse by category

## Step 5 - Category and Game Pages
- add `/categories/[slug]`
- add `/games/[slug]`

## Step 6 - Related Products and Breadcrumbs
- improve product detail discovery loops

## Step 7 - Instrumentation and Review
- track discovery events
- inspect CTR and zero-result behavior

---

## Indexing Recommendations

Create indexes for:

- `products(moderation_status, created_at desc)`
- `products(game_id, moderation_status)`
- `products(featured, moderation_status)`
- `product_categories(category_id, product_id)`
- `categories(parent_id, sort_order)`
- `games(sort_order, is_active)`

If search grows heavier, add full-text indexes later.

---

## Verification Plan

### Data Verification
- categories seed correctly
- products can be assigned to multiple categories
- products render correct game/category metadata

### Functional Verification
- `/products` filters combine correctly
- sort modes return expected ordering
- category page shows only relevant products
- game page shows only relevant products
- homepage rails show distinct logic

### UX Verification
- filter state remains understandable
- mobile filter UX is usable
- buyers can reach a target product faster than current baseline

### Technical Verification
- lint passes
- build passes
- RLS blocks invalid seller taxonomy edits
- no regression in product creation/editing

---

## Definition of Done

Phase 1 is complete only when:

- taxonomy is persisted in the database
- sellers can assign products correctly
- discovery pages exist and are coherent
- homepage discovery feels curated, not generic
- filters and sort are reliable
- docs are updated
- production verification is completed

---

## Elite Standard

This phase must not become a cosmetic filter panel.

The real standard is:

- structurally extensible
- commercially useful
- operationally manageable
- fast enough for production
- visually premium

If it does not materially improve product discovery and conversion, it is not done.
