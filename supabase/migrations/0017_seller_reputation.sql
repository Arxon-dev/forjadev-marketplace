-- Persisted seller reputation snapshots and public badges.

create table if not exists public.seller_reputation_snapshots (
  vendor_id uuid primary key references public.vendors(id) on delete cascade,
  approved_products integer not null default 0,
  free_products integer not null default 0,
  paid_products integer not null default 0,
  total_downloads integer not null default 0,
  total_purchases integer not null default 0,
  total_ratings integer not null default 0,
  average_rating numeric(4, 2),
  joined_at timestamptz not null,
  latest_product_update_at timestamptz,
  reputation_score integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.seller_badges (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  code text not null,
  label text not null,
  tone text not null check (tone in ('primary', 'success', 'warning')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (vendor_id, code)
);

alter table public.seller_reputation_snapshots enable row level security;
alter table public.seller_badges enable row level security;

drop policy if exists "seller_reputation_snapshots_select_public" on public.seller_reputation_snapshots;
create policy "seller_reputation_snapshots_select_public" on public.seller_reputation_snapshots
for select to authenticated, anon
using (true);

drop policy if exists "seller_badges_select_public" on public.seller_badges;
create policy "seller_badges_select_public" on public.seller_badges
for select to authenticated, anon
using (true);

create index if not exists idx_seller_badges_vendor_sort
  on public.seller_badges (vendor_id, sort_order, created_at);

create or replace function public.refresh_seller_reputation_snapshot(p_vendor_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.seller_reputation_snapshots (
    vendor_id,
    approved_products,
    free_products,
    paid_products,
    total_downloads,
    total_purchases,
    total_ratings,
    average_rating,
    joined_at,
    latest_product_update_at,
    reputation_score,
    updated_at
  )
  select
    v.id as vendor_id,
    count(p.id)::integer as approved_products,
    count(*) filter (where p.is_free)::integer as free_products,
    count(*) filter (where not p.is_free)::integer as paid_products,
    coalesce(sum(p.download_count), 0)::integer as total_downloads,
    coalesce(sum(p.purchase_count), 0)::integer as total_purchases,
    coalesce(sum(p.rating_count), 0)::integer as total_ratings,
    case
      when coalesce(sum(p.rating_count), 0) > 0
        then round((sum(p.rating_average * p.rating_count) / sum(p.rating_count))::numeric, 2)
      else null
    end as average_rating,
    v.created_at as joined_at,
    max(p.updated_at) as latest_product_update_at,
    least(
      100,
      greatest(
        0,
        (
          least(count(p.id) * 6, 24) +
          least(coalesce(sum(p.purchase_count), 0) / 5, 28) +
          least(coalesce(sum(p.download_count), 0) / 20, 12) +
          least(coalesce(sum(p.rating_count), 0) * 2, 16) +
          case
            when coalesce(sum(p.rating_count), 0) >= 3
              then least((sum(p.rating_average * p.rating_count) / sum(p.rating_count)) * 4, 20)
            else 0
          end
        )::integer +
        case
          when max(p.updated_at) is not null
               and max(p.updated_at) >= now() - interval '45 days'
            then 8
          else 0
        end
      )
    )::integer as reputation_score,
    now() as updated_at
  from public.vendors v
  left join public.products p
    on p.vendor_id = v.id
   and p.moderation_status = 'approved'
  where p_vendor_id is null or v.id = p_vendor_id
  group by v.id, v.created_at
  on conflict (vendor_id) do update
  set
    approved_products = excluded.approved_products,
    free_products = excluded.free_products,
    paid_products = excluded.paid_products,
    total_downloads = excluded.total_downloads,
    total_purchases = excluded.total_purchases,
    total_ratings = excluded.total_ratings,
    average_rating = excluded.average_rating,
    joined_at = excluded.joined_at,
    latest_product_update_at = excluded.latest_product_update_at,
    reputation_score = excluded.reputation_score,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.refresh_seller_badges(p_vendor_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.seller_badges
  where p_vendor_id is null or vendor_id = p_vendor_id;

  insert into public.seller_badges (vendor_id, code, label, tone, sort_order)
  select
    s.vendor_id,
    badge.code,
    badge.label,
    badge.tone,
    badge.sort_order
  from public.seller_reputation_snapshots s
  cross join lateral (
    values
      ('active_store', 'Tienda activa', 'primary', 10),
      ('top_seller', 'Top seller', 'success', 20),
      ('highly_rated', 'Muy bien valorado', 'success', 30),
      ('active_maintenance', 'Mantenimiento activo', 'warning', 40)
  ) as badge(code, label, tone, sort_order)
  where (p_vendor_id is null or s.vendor_id = p_vendor_id)
    and (
      (badge.code = 'active_store' and s.approved_products > 0) or
      (badge.code = 'top_seller' and s.total_purchases >= 25) or
      (badge.code = 'highly_rated' and s.average_rating >= 4.5 and s.total_ratings >= 5) or
      (
        badge.code = 'active_maintenance'
        and s.latest_product_update_at is not null
        and s.latest_product_update_at >= now() - interval '45 days'
      )
    )
  on conflict (vendor_id, code) do update
  set
    label = excluded.label,
    tone = excluded.tone,
    sort_order = excluded.sort_order;
end;
$$;

revoke all on function public.refresh_seller_reputation_snapshot(uuid) from public;
revoke all on function public.refresh_seller_reputation_snapshot(uuid) from anon;
revoke all on function public.refresh_seller_badges(uuid) from public;
revoke all on function public.refresh_seller_badges(uuid) from anon;

select public.refresh_seller_reputation_snapshot();
select public.refresh_seller_badges();
