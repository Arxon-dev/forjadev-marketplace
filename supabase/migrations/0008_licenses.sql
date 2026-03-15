-- Fase siguiente: licencias simples para compras completadas

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  license_key text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked')),
  issued_at timestamptz not null default now(),
  last_validated_at timestamptz
);

alter table public.licenses enable row level security;

drop policy if exists "licenses_select_own" on public.licenses;
create policy "licenses_select_own" on public.licenses
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "licenses_insert_via_own_order_item" on public.licenses;
create policy "licenses_insert_via_own_order_item" on public.licenses
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = order_item_id and o.user_id = auth.uid()
  )
);
