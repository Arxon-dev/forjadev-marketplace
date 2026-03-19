-- Phase 7 completion: persisted product and seller risk scoring.

create table if not exists public.product_risk_snapshots (
  product_id uuid primary key references public.products(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  moderation_flag_count integer not null default 0,
  open_risk_event_count integer not null default 0,
  high_risk_event_count integer not null default 0,
  license_anomaly_count integer not null default 0,
  open_dispute_count integer not null default 0,
  risk_score integer not null default 0 check (risk_score >= 0 and risk_score <= 100),
  updated_at timestamptz not null default now()
);

create table if not exists public.seller_risk_snapshots (
  vendor_id uuid primary key references public.vendors(id) on delete cascade,
  product_count integer not null default 0,
  flagged_product_count integer not null default 0,
  open_risk_event_count integer not null default 0,
  high_risk_event_count integer not null default 0,
  license_anomaly_count integer not null default 0,
  open_dispute_count integer not null default 0,
  risk_score integer not null default 0 check (risk_score >= 0 and risk_score <= 100),
  updated_at timestamptz not null default now()
);

alter table public.product_risk_snapshots enable row level security;
alter table public.seller_risk_snapshots enable row level security;

drop policy if exists "product_risk_snapshots_admin_only" on public.product_risk_snapshots;
create policy "product_risk_snapshots_admin_only" on public.product_risk_snapshots
for select to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "seller_risk_snapshots_admin_only" on public.seller_risk_snapshots;
create policy "seller_risk_snapshots_admin_only" on public.seller_risk_snapshots
for select to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

create index if not exists idx_product_risk_snapshots_vendor_score
  on public.product_risk_snapshots (vendor_id, risk_score desc, updated_at desc);

create index if not exists idx_seller_risk_snapshots_score
  on public.seller_risk_snapshots (risk_score desc, updated_at desc);

create or replace function public.refresh_product_risk_snapshot(p_product_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_moderation_flag_count integer := 0;
  v_open_risk_event_count integer := 0;
  v_high_risk_event_count integer := 0;
  v_license_anomaly_count integer := 0;
  v_open_dispute_count integer := 0;
  v_risk_score integer := 0;
begin
  if p_product_id is null then
    return;
  end if;

  select p.vendor_id
  into v_vendor_id
  from public.products p
  where p.id = p_product_id;

  if not found then
    delete from public.product_risk_snapshots
    where product_id = p_product_id;
    return;
  end if;

  select count(*)
  into v_moderation_flag_count
  from public.moderation_flags mf
  where mf.product_id = p_product_id
    and mf.is_active = true;

  select count(*)
  into v_open_risk_event_count
  from public.risk_events re
  where re.entity_type = 'product'
    and re.entity_id = p_product_id::text
    and re.status = 'open';

  select count(*)
  into v_high_risk_event_count
  from public.risk_events re
  where re.entity_type = 'product'
    and re.entity_id = p_product_id::text
    and re.status = 'open'
    and re.severity = 'high';

  select count(*)
  into v_license_anomaly_count
  from public.license_anomalies la
  where la.product_id = p_product_id
    and la.created_at >= now() - interval '90 days';

  select count(*)
  into v_open_dispute_count
  from public.disputes d
  where d.product_id = p_product_id
    and d.status in ('open', 'reviewing');

  v_risk_score := least(
    100,
    v_moderation_flag_count * 25 +
    v_open_risk_event_count * 12 +
    v_high_risk_event_count * 18 +
    v_license_anomaly_count * 15 +
    v_open_dispute_count * 12
  );

  insert into public.product_risk_snapshots (
    product_id,
    vendor_id,
    moderation_flag_count,
    open_risk_event_count,
    high_risk_event_count,
    license_anomaly_count,
    open_dispute_count,
    risk_score,
    updated_at
  )
  values (
    p_product_id,
    v_vendor_id,
    v_moderation_flag_count,
    v_open_risk_event_count,
    v_high_risk_event_count,
    v_license_anomaly_count,
    v_open_dispute_count,
    v_risk_score,
    now()
  )
  on conflict (product_id) do update
  set
    vendor_id = excluded.vendor_id,
    moderation_flag_count = excluded.moderation_flag_count,
    open_risk_event_count = excluded.open_risk_event_count,
    high_risk_event_count = excluded.high_risk_event_count,
    license_anomaly_count = excluded.license_anomaly_count,
    open_dispute_count = excluded.open_dispute_count,
    risk_score = excluded.risk_score,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.refresh_seller_risk_snapshot(p_vendor_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_count integer := 0;
  v_flagged_product_count integer := 0;
  v_open_risk_event_count integer := 0;
  v_high_risk_event_count integer := 0;
  v_license_anomaly_count integer := 0;
  v_open_dispute_count integer := 0;
  v_risk_score integer := 0;
begin
  if p_vendor_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.vendors v
    where v.id = p_vendor_id
  ) then
    delete from public.seller_risk_snapshots
    where vendor_id = p_vendor_id;
    return;
  end if;

  select count(*)
  into v_product_count
  from public.products p
  where p.vendor_id = p_vendor_id;

  select count(distinct mf.product_id)
  into v_flagged_product_count
  from public.moderation_flags mf
  join public.products p on p.id = mf.product_id
  where p.vendor_id = p_vendor_id
    and mf.is_active = true;

  select count(*)
  into v_open_risk_event_count
  from public.risk_events re
  where re.vendor_id = p_vendor_id
    and re.status = 'open';

  select count(*)
  into v_high_risk_event_count
  from public.risk_events re
  where re.vendor_id = p_vendor_id
    and re.status = 'open'
    and re.severity = 'high';

  select count(*)
  into v_license_anomaly_count
  from public.license_anomalies la
  join public.products p on p.id = la.product_id
  where p.vendor_id = p_vendor_id
    and la.created_at >= now() - interval '90 days';

  select count(*)
  into v_open_dispute_count
  from public.disputes d
  join public.products p on p.id = d.product_id
  where p.vendor_id = p_vendor_id
    and d.status in ('open', 'reviewing');

  v_risk_score := least(
    100,
    v_flagged_product_count * 20 +
    v_open_risk_event_count * 8 +
    v_high_risk_event_count * 15 +
    v_license_anomaly_count * 12 +
    v_open_dispute_count * 10
  );

  insert into public.seller_risk_snapshots (
    vendor_id,
    product_count,
    flagged_product_count,
    open_risk_event_count,
    high_risk_event_count,
    license_anomaly_count,
    open_dispute_count,
    risk_score,
    updated_at
  )
  values (
    p_vendor_id,
    v_product_count,
    v_flagged_product_count,
    v_open_risk_event_count,
    v_high_risk_event_count,
    v_license_anomaly_count,
    v_open_dispute_count,
    v_risk_score,
    now()
  )
  on conflict (vendor_id) do update
  set
    product_count = excluded.product_count,
    flagged_product_count = excluded.flagged_product_count,
    open_risk_event_count = excluded.open_risk_event_count,
    high_risk_event_count = excluded.high_risk_event_count,
    license_anomaly_count = excluded.license_anomaly_count,
    open_dispute_count = excluded.open_dispute_count,
    risk_score = excluded.risk_score,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.refresh_product_and_seller_risk(p_product_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
begin
  if p_product_id is null then
    return;
  end if;

  perform public.refresh_product_risk_snapshot(p_product_id);

  select p.vendor_id
  into v_vendor_id
  from public.products p
  where p.id = p_product_id;

  if v_vendor_id is not null then
    perform public.refresh_seller_risk_snapshot(v_vendor_id);
  end if;
end;
$$;

create or replace function public.handle_risk_signal_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_vendor_id uuid;
  v_entity_type text;
  v_entity_id text;
begin
  if tg_table_name = 'moderation_flags' then
    v_product_id := coalesce(new.product_id, old.product_id);
    perform public.refresh_product_and_seller_risk(v_product_id);
    return coalesce(new, old);
  end if;

  if tg_table_name = 'license_anomalies' then
    v_product_id := coalesce(new.product_id, old.product_id);
    perform public.refresh_product_and_seller_risk(v_product_id);
    return coalesce(new, old);
  end if;

  if tg_table_name = 'disputes' then
    v_product_id := coalesce(new.product_id, old.product_id);
    if v_product_id is not null then
      perform public.refresh_product_and_seller_risk(v_product_id);
    end if;
    return coalesce(new, old);
  end if;

  if tg_table_name = 'risk_events' then
    v_vendor_id := coalesce(new.vendor_id, old.vendor_id);
    v_entity_type := coalesce(new.entity_type, old.entity_type);
    v_entity_id := coalesce(new.entity_id, old.entity_id);

    if v_vendor_id is not null then
      perform public.refresh_seller_risk_snapshot(v_vendor_id);
    end if;

    if v_entity_type = 'product' and v_entity_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      perform public.refresh_product_and_seller_risk(v_entity_id::uuid);
    end if;

    return coalesce(new, old);
  end if;

  if tg_table_name = 'products' then
    v_product_id := coalesce(new.id, old.id);
    perform public.refresh_product_and_seller_risk(v_product_id);

    if tg_op = 'UPDATE' and old.vendor_id is distinct from new.vendor_id and old.vendor_id is not null then
      perform public.refresh_seller_risk_snapshot(old.vendor_id);
    end if;

    return coalesce(new, old);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists refresh_risk_on_moderation_flags_after_write on public.moderation_flags;
create trigger refresh_risk_on_moderation_flags_after_write
after insert or update or delete on public.moderation_flags
for each row
execute procedure public.handle_risk_signal_refresh();

drop trigger if exists refresh_risk_on_license_anomalies_after_write on public.license_anomalies;
create trigger refresh_risk_on_license_anomalies_after_write
after insert or update or delete on public.license_anomalies
for each row
execute procedure public.handle_risk_signal_refresh();

drop trigger if exists refresh_risk_on_disputes_after_write on public.disputes;
create trigger refresh_risk_on_disputes_after_write
after insert or update or delete on public.disputes
for each row
execute procedure public.handle_risk_signal_refresh();

drop trigger if exists refresh_risk_on_risk_events_after_write on public.risk_events;
create trigger refresh_risk_on_risk_events_after_write
after insert or update or delete on public.risk_events
for each row
execute procedure public.handle_risk_signal_refresh();

drop trigger if exists refresh_risk_on_products_after_write on public.products;
create trigger refresh_risk_on_products_after_write
after insert or update of vendor_id on public.products
for each row
execute procedure public.handle_risk_signal_refresh();

do $$
declare
  v_product_id uuid;
  v_vendor_id uuid;
begin
  for v_product_id in
    select p.id
    from public.products p
  loop
    perform public.refresh_product_risk_snapshot(v_product_id);
  end loop;

  for v_vendor_id in
    select v.id
    from public.vendors v
  loop
    perform public.refresh_seller_risk_snapshot(v_vendor_id);
  end loop;
end;
$$;
