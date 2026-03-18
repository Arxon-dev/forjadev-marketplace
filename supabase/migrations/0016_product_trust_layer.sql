-- Trust layer for product detail pages: public policies and FAQ content.

alter table public.products
  add column if not exists support_policy text,
  add column if not exists refund_policy text,
  add column if not exists update_policy text;

create table if not exists public.product_faqs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.product_faqs enable row level security;

drop policy if exists "product_faqs_select_public_via_product" on public.product_faqs;
create policy "product_faqs_select_public_via_product" on public.product_faqs
for select to authenticated, anon
using (
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.moderation_status = 'approved'
  )
);

drop policy if exists "product_faqs_insert_seller_owned_product" on public.product_faqs;
create policy "product_faqs_insert_seller_owned_product" on public.product_faqs
for insert to authenticated
with check (
  exists (
    select 1
    from public.products p
    join public.vendors v on v.id = p.vendor_id
    where p.id = product_id
      and v.user_id = auth.uid()
  )
);

drop policy if exists "product_faqs_update_seller_owned_product" on public.product_faqs;
create policy "product_faqs_update_seller_owned_product" on public.product_faqs
for update to authenticated
using (
  exists (
    select 1
    from public.products p
    join public.vendors v on v.id = p.vendor_id
    where p.id = product_id
      and v.user_id = auth.uid()
  )
);

drop policy if exists "product_faqs_delete_seller_owned_product" on public.product_faqs;
create policy "product_faqs_delete_seller_owned_product" on public.product_faqs
for delete to authenticated
using (
  exists (
    select 1
    from public.products p
    join public.vendors v on v.id = p.vendor_id
    where p.id = product_id
      and v.user_id = auth.uid()
  )
);

create index if not exists idx_product_faqs_product_sort
  on public.product_faqs (product_id, sort_order, created_at);
