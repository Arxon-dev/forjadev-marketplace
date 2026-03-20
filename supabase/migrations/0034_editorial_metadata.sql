-- Phase 9.1: editorial metadata for admin-managed help center and policy content.

alter table public.help_center_articles
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists review_notes text,
  add column if not exists last_reviewed_at timestamptz;

alter table public.marketplace_policy_pages
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists review_notes text,
  add column if not exists last_reviewed_at timestamptz;

create index if not exists idx_help_center_articles_status_updated
  on public.help_center_articles (status, updated_at desc);

create index if not exists idx_marketplace_policy_pages_status_updated
  on public.marketplace_policy_pages (status, updated_at desc);
