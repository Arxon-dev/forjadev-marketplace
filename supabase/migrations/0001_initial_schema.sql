create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  username text unique,
  display_name text,
  avatar_url text,
  role text not null default 'buyer' check (role in ('buyer','seller','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  store_name text not null,
  slug text not null unique,
  bio text,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  slug text not null unique,
  short_description text,
  description text,
  price_cents integer not null default 0,
  currency text not null default 'EUR',
  is_free boolean not null default true,
  moderation_status text not null default 'draft' check (moderation_status in ('draft','pending','approved','rejected','hidden')),
  compatibility text,
  featured_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  version text not null,
  changelog text,
  created_at timestamptz not null default now()
);

create table if not exists public.product_files (
  id uuid primary key default gen_random_uuid(),
  product_version_id uuid not null references public.product_versions(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size_bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  total_cents integer not null default 0,
  currency text not null default 'EUR',
  status text not null default 'completed' check (status in ('pending','completed','failed','refunded')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  price_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  downloaded_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.vendors enable row level security;
alter table public.products enable row level security;
alter table public.product_versions enable row level security;
alter table public.product_files enable row level security;
alter table public.reviews enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.downloads enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_own" on public.profiles
for select to authenticated
using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
for update to authenticated
using (auth.uid() = id);

create policy "vendors_select_public" on public.vendors
for select to authenticated, anon
using (true);

create policy "vendors_insert_own" on public.vendors
for insert to authenticated
with check (user_id = auth.uid());

create policy "vendors_update_own" on public.vendors
for update to authenticated
using (user_id = auth.uid());

create policy "products_select_public_approved" on public.products
for select to authenticated, anon
using (moderation_status = 'approved');

create policy "products_insert_seller" on public.products
for insert to authenticated
with check (
  exists (
    select 1 from public.vendors v
    where v.id = vendor_id and v.user_id = auth.uid()
  )
);

create policy "products_update_own" on public.products
for update to authenticated
using (
  exists (
    select 1 from public.vendors v
    where v.id = vendor_id and v.user_id = auth.uid()
  )
);

create policy "product_versions_select_public_via_product" on public.product_versions
for select to authenticated, anon
using (
  exists (
    select 1 from public.products p
    where p.id = product_id and p.moderation_status = 'approved'
  )
);

create policy "product_files_no_public_select" on public.product_files
for select to authenticated
using (false);

create policy "reviews_select_public" on public.reviews
for select to authenticated, anon
using (true);

create policy "reviews_insert_authenticated" on public.reviews
for insert to authenticated
with check (user_id = auth.uid());

create policy "orders_select_own" on public.orders
for select to authenticated
using (user_id = auth.uid());

create policy "order_items_select_own" on public.order_items
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.user_id = auth.uid()
  )
);

create policy "downloads_select_own" on public.downloads
for select to authenticated
using (user_id = auth.uid());

create policy "audit_logs_none" on public.audit_logs
for select to authenticated
using (false);
