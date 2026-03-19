-- Phase 8 data layer: daily product analytics snapshots for ranking and seller intelligence.

create table if not exists public.product_analytics_daily (
  product_id uuid not null references public.products(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  day date not null,
  view_count integer not null default 0 check (view_count >= 0),
  click_count integer not null default 0 check (click_count >= 0),
  add_to_cart_count integer not null default 0 check (add_to_cart_count >= 0),
  purchase_count integer not null default 0 check (purchase_count >= 0),
  download_count integer not null default 0 check (download_count >= 0),
  revenue_cents integer not null default 0 check (revenue_cents >= 0),
  updated_at timestamptz not null default now(),
  primary key (product_id, day)
);

alter table public.product_analytics_daily enable row level security;

drop policy if exists "product_analytics_daily_select_owner_or_admin" on public.product_analytics_daily;
create policy "product_analytics_daily_select_owner_or_admin" on public.product_analytics_daily
for select to authenticated
using (
  exists (
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

create index if not exists idx_product_analytics_daily_vendor_day
  on public.product_analytics_daily (vendor_id, day desc, updated_at desc);

create index if not exists idx_product_analytics_daily_day
  on public.product_analytics_daily (day desc, updated_at desc);

create or replace function public.refresh_product_analytics_daily(
  p_day date default current_date,
  p_product_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with target_products as (
    select p.id, p.vendor_id
    from public.products p
    where p_product_id is null or p.id = p_product_id
  ), event_counts as (
    select
      tp.id as product_id,
      count(*) filter (where me.event_name = 'product.detail.opened')::integer as view_count,
      count(*) filter (where me.event_name = 'product.card.clicked')::integer as click_count,
      count(*) filter (where me.event_name = 'checkout.started')::integer as add_to_cart_count
    from target_products tp
    left join public.marketplace_events me
      on me.entity_type = 'product'
      and me.entity_id = tp.id::text
      and me.created_at >= p_day::timestamptz
      and me.created_at < (p_day + 1)::timestamptz
      and me.event_name in ('product.detail.opened', 'product.card.clicked', 'checkout.started')
    group by tp.id
  ), order_counts as (
    select
      oi.product_id,
      count(*)::integer as purchase_count,
      coalesce(sum(oi.price_cents), 0)::integer as revenue_cents
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where (p_product_id is null or oi.product_id = p_product_id)
      and o.status = 'completed'
      and o.created_at >= p_day::timestamptz
      and o.created_at < (p_day + 1)::timestamptz
    group by oi.product_id
  ), download_counts as (
    select
      d.product_id,
      count(*)::integer as download_count
    from public.downloads d
    where (p_product_id is null or d.product_id = p_product_id)
      and d.downloaded_at >= p_day::timestamptz
      and d.downloaded_at < (p_day + 1)::timestamptz
    group by d.product_id
  ), combined as (
    select
      tp.id as product_id,
      tp.vendor_id,
      p_day as day,
      coalesce(ec.view_count, 0) as view_count,
      coalesce(ec.click_count, 0) as click_count,
      coalesce(ec.add_to_cart_count, 0) as add_to_cart_count,
      coalesce(oc.purchase_count, 0) as purchase_count,
      coalesce(dc.download_count, 0) as download_count,
      coalesce(oc.revenue_cents, 0) as revenue_cents
    from target_products tp
    left join event_counts ec on ec.product_id = tp.id
    left join order_counts oc on oc.product_id = tp.id
    left join download_counts dc on dc.product_id = tp.id
    where
      coalesce(ec.view_count, 0) > 0
      or coalesce(ec.click_count, 0) > 0
      or coalesce(ec.add_to_cart_count, 0) > 0
      or coalesce(oc.purchase_count, 0) > 0
      or coalesce(dc.download_count, 0) > 0
      or coalesce(oc.revenue_cents, 0) > 0
  )
  insert into public.product_analytics_daily (
    product_id,
    vendor_id,
    day,
    view_count,
    click_count,
    add_to_cart_count,
    purchase_count,
    download_count,
    revenue_cents,
    updated_at
  )
  select
    combined.product_id,
    combined.vendor_id,
    combined.day,
    combined.view_count,
    combined.click_count,
    combined.add_to_cart_count,
    combined.purchase_count,
    combined.download_count,
    combined.revenue_cents,
    now()
  from combined
  on conflict (product_id, day) do update
  set
    vendor_id = excluded.vendor_id,
    view_count = excluded.view_count,
    click_count = excluded.click_count,
    add_to_cart_count = excluded.add_to_cart_count,
    purchase_count = excluded.purchase_count,
    download_count = excluded.download_count,
    revenue_cents = excluded.revenue_cents,
    updated_at = excluded.updated_at;

  with target_products as (
    select p.id
    from public.products p
    where p_product_id is null or p.id = p_product_id
  ), combined as (
    select
      tp.id as product_id
    from target_products tp
    left join public.marketplace_events me
      on me.entity_type = 'product'
      and me.entity_id = tp.id::text
      and me.created_at >= p_day::timestamptz
      and me.created_at < (p_day + 1)::timestamptz
      and me.event_name in ('product.detail.opened', 'product.card.clicked', 'checkout.started')
    left join public.order_items oi
      on oi.product_id = tp.id
    left join public.orders o
      on o.id = oi.order_id
      and o.status = 'completed'
      and o.created_at >= p_day::timestamptz
      and o.created_at < (p_day + 1)::timestamptz
    left join public.downloads d
      on d.product_id = tp.id
      and d.downloaded_at >= p_day::timestamptz
      and d.downloaded_at < (p_day + 1)::timestamptz
    group by tp.id
    having
      count(me.id) > 0
      or count(o.id) > 0
      or count(d.id) > 0
  )
  delete from public.product_analytics_daily pad
  where pad.day = p_day
    and (p_product_id is null or pad.product_id = p_product_id)
    and not exists (
      select 1
      from combined c
      where c.product_id = pad.product_id
    );
end;
$$;

create or replace function public.refresh_recent_product_analytics_window(p_days integer default 90)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
begin
  for v_day in
    select generate_series(current_date - greatest(1, p_days) + 1, current_date, interval '1 day')::date
  loop
    perform public.refresh_product_analytics_daily(v_day, null);
  end loop;
end;
$$;

create or replace function public.handle_product_analytics_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_day date;
begin
  if tg_table_name = 'marketplace_events' then
    if new.entity_type = 'product'
      and new.entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and new.event_name in ('product.detail.opened', 'product.card.clicked', 'checkout.started') then
      perform public.refresh_product_analytics_daily(new.created_at::date, new.entity_id::uuid);
    end if;

    return new;
  end if;

  if tg_table_name = 'downloads' then
    v_product_id := coalesce(new.product_id, old.product_id);
    v_day := coalesce(new.downloaded_at, old.downloaded_at)::date;

    if v_product_id is not null and v_day is not null then
      perform public.refresh_product_analytics_daily(v_day, v_product_id);
    end if;

    return coalesce(new, old);
  end if;

  if tg_table_name = 'order_items' then
    v_product_id := coalesce(new.product_id, old.product_id);
    v_day := coalesce(new.created_at, old.created_at)::date;

    if v_product_id is not null and v_day is not null then
      perform public.refresh_product_analytics_daily(v_day, v_product_id);
    end if;

    return coalesce(new, old);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.handle_order_status_analytics_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    for v_product_id in
      select oi.product_id
      from public.order_items oi
      where oi.order_id = new.id
    loop
      perform public.refresh_product_analytics_daily(new.created_at::date, v_product_id);
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists refresh_product_analytics_on_marketplace_events_after_insert on public.marketplace_events;
create trigger refresh_product_analytics_on_marketplace_events_after_insert
after insert on public.marketplace_events
for each row
execute procedure public.handle_product_analytics_refresh();

drop trigger if exists refresh_product_analytics_on_downloads_after_write on public.downloads;
create trigger refresh_product_analytics_on_downloads_after_write
after insert or update or delete on public.downloads
for each row
execute procedure public.handle_product_analytics_refresh();

drop trigger if exists refresh_product_analytics_on_order_items_after_write on public.order_items;
create trigger refresh_product_analytics_on_order_items_after_write
after insert or update or delete on public.order_items
for each row
execute procedure public.handle_product_analytics_refresh();

drop trigger if exists refresh_product_analytics_on_orders_status_after_update on public.orders;
create trigger refresh_product_analytics_on_orders_status_after_update
after update of status on public.orders
for each row
execute procedure public.handle_order_status_analytics_refresh();

select public.refresh_recent_product_analytics_window(90);
