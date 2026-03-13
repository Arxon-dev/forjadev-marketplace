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
- audit_logs

## Security notes
- RLS on all user-owned tables
- public catalogue data separated from restricted data where helpful
- secure file access checks for downloads
