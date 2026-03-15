# Database Overview

## Core tables
- profiles
- vendors
- products
- product_versions
- product_files
- categories
- reviews
- orders
- order_items
- downloads
- licenses
- audit_logs

## Moderation
- `products.moderation_status` controls public visibility
- `products.rejection_reason` stores feedback for rejected listings
- `audit_logs` records admin moderation actions

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
