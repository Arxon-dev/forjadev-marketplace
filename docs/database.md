# Database Overview

## Core tables
- profiles
- vendors
- seller_reputation_snapshots
- seller_badges
- games
- products
- product_categories
- product_versions
- product_faqs
- product_guides
- product_files
- categories
- reviews
- orders
- order_items
- downloads
- support_tickets
- support_messages
- user_notifications
- licenses
- audit_logs
- marketplace_events

## Moderation
- `products.moderation_status` controls public visibility
- `products.rejection_reason` stores feedback for rejected listings
- `audit_logs` records admin moderation actions

## Discovery and taxonomy
- `games` defines the primary game taxonomy for the catalog
- `categories` now supports parent-child hierarchy, activation and sort order
- `product_categories` allows products to belong to multiple categories while preserving the legacy `products.category_id` link during migration
- `products` now stores discovery metadata such as `featured`, `search_text`, `view_count`, `download_count`, `purchase_count`, `rating_average` and `rating_count`
- `products.support_policy`, `products.refund_policy` and `products.update_policy` expose trust and support expectations directly on the product page
- `product_faqs` stores public FAQ entries per product and is editable only by the owning seller
- `product_guides` stores installation guides, setup notes and post-sale tutorials attached to each product
- `marketplace_events` captures lightweight discovery analytics such as impressions, clicks, searches, filter usage and visits to game/category/product pages
- `seller_reputation_snapshots` persists public seller trust metrics such as approved products, downloads, purchases, ratings and reputation score
- `seller_badges` stores public seller badges derived from the reputation snapshot and curated for marketplace trust surfaces
- product metrics and seller trust snapshots are automatically refreshed by database triggers when products, reviews, downloads, order items or order status change
- `support_tickets` stores buyer-seller support threads scoped to a product and seller
- `support_messages` stores the conversation history for each ticket and automatically updates ticket activity timestamps
- `user_notifications` stores internal inbox-style notifications for buyers, sellers and admins, including support activity and linked entities
- published product releases generate buyer notifications automatically when a new product file is attached to a version for an approved product

## Security notes
- RLS on all user-owned tables
- public catalogue data separated from restricted data where helpful
- secure file access checks for downloads
- licenses only visible to the owning user
- license inserts must match the buyer's own `order_item` and its `product_id`
- checkout creation runs through a transactional database function to avoid partial orders and duplicate purchases under race conditions
- checkout audit logging is emitted inside the transactional database function so RPC callers and Next.js callers behave consistently
- critical actions such as moderation, checkout completion and download generation are recorded in `audit_logs`
- auth profile creation is backed by both an `auth.users` trigger and an `ensure_profile_exists()` repair function for resilience
- seller analytics policies allow sellers to read downloads, order_items, orders and licenses for their own products only
