-- Phase 5 foundation: wishlists and seller follows.

create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint wishlists_user_product_unique unique (user_id, product_id)
);

create table if not exists public.seller_followers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint seller_followers_user_vendor_unique unique (user_id, vendor_id)
);

alter table public.wishlists enable row level security;
alter table public.seller_followers enable row level security;

drop policy if exists "wishlists_select_own_or_admin" on public.wishlists;
create policy "wishlists_select_own_or_admin" on public.wishlists
for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "wishlists_insert_own" on public.wishlists;
create policy "wishlists_insert_own" on public.wishlists
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.products pr
    where pr.id = product_id
      and pr.moderation_status = 'approved'
  )
);

drop policy if exists "wishlists_delete_own" on public.wishlists;
create policy "wishlists_delete_own" on public.wishlists
for delete to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "seller_followers_select_related" on public.seller_followers;
create policy "seller_followers_select_related" on public.seller_followers
for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.vendors v
    where v.id = vendor_id
      and v.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "seller_followers_insert_own" on public.seller_followers;
create policy "seller_followers_insert_own" on public.seller_followers
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.vendors v
    where v.id = vendor_id
      and v.user_id <> auth.uid()
  )
);

drop policy if exists "seller_followers_delete_own" on public.seller_followers;
create policy "seller_followers_delete_own" on public.seller_followers
for delete to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

create index if not exists idx_wishlists_user_created
  on public.wishlists (user_id, created_at desc);

create index if not exists idx_wishlists_product_created
  on public.wishlists (product_id, created_at desc);

create index if not exists idx_seller_followers_user_created
  on public.seller_followers (user_id, created_at desc);

create index if not exists idx_seller_followers_vendor_created
  on public.seller_followers (vendor_id, created_at desc);
