-- Phase 7 foundation: admin risk intelligence, moderation flags and license anomalies.

create table if not exists public.risk_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  vendor_id uuid references public.vendors(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  code text not null,
  title text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.moderation_flags (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  flag_code text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  reason text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint moderation_flags_product_code_unique unique (product_id, flag_code)
);

create table if not exists public.license_anomalies (
  id uuid primary key default gen_random_uuid(),
  license_id uuid references public.licenses(id) on delete set null,
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  anomaly_code text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  details text,
  created_at timestamptz not null default now()
);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  license_id uuid references public.licenses(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  opened_by_user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_admin_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'rejected')),
  reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.risk_events enable row level security;
alter table public.moderation_flags enable row level security;
alter table public.license_anomalies enable row level security;
alter table public.disputes enable row level security;

drop policy if exists "risk_events_admin_only" on public.risk_events;
create policy "risk_events_admin_only" on public.risk_events
for select to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "moderation_flags_admin_only" on public.moderation_flags;
create policy "moderation_flags_admin_only" on public.moderation_flags
for select to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "license_anomalies_admin_only" on public.license_anomalies;
create policy "license_anomalies_admin_only" on public.license_anomalies
for select to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "disputes_admin_or_owner" on public.disputes;
create policy "disputes_admin_or_owner" on public.disputes
for select to authenticated
using (
  opened_by_user_id = auth.uid()
  or assigned_admin_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

create index if not exists idx_risk_events_status_severity_created
  on public.risk_events (status, severity, created_at desc);

create index if not exists idx_risk_events_entity_created
  on public.risk_events (entity_type, entity_id, created_at desc);

create index if not exists idx_moderation_flags_product_active
  on public.moderation_flags (product_id, is_active, severity, created_at desc);

create index if not exists idx_license_anomalies_product_created
  on public.license_anomalies (product_id, created_at desc);

create index if not exists idx_license_anomalies_user_created
  on public.license_anomalies (user_id, created_at desc);

create index if not exists idx_disputes_status_updated
  on public.disputes (status, updated_at desc);

create or replace function public.touch_dispute_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_dispute_updated_at_before_update on public.disputes;
create trigger touch_dispute_updated_at_before_update
before update on public.disputes
for each row
execute procedure public.touch_dispute_updated_at();

create or replace function public.sync_product_moderation_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text;
  v_severity text;
begin
  if new.moderation_status in ('rejected', 'hidden') then
    v_reason := coalesce(new.rejection_reason, 'Producto con atencion de moderacion');
    v_severity := case
      when new.moderation_status = 'hidden' then 'high'
      else 'medium'
    end;

    insert into public.moderation_flags (
      product_id,
      flag_code,
      severity,
      reason,
      is_active,
      resolved_at
    )
    values (
      new.id,
      'moderation_attention',
      v_severity,
      v_reason,
      true,
      null
    )
    on conflict (product_id, flag_code) do update
    set
      severity = excluded.severity,
      reason = excluded.reason,
      is_active = true,
      resolved_at = null;
  else
    update public.moderation_flags
    set
      is_active = false,
      resolved_at = now()
    where product_id = new.id
      and flag_code = 'moderation_attention'
      and is_active = true;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_product_moderation_flag_after_write on public.products;
create trigger sync_product_moderation_flag_after_write
after insert or update of moderation_status, rejection_reason on public.products
for each row
execute procedure public.sync_product_moderation_flag();

create or replace function public.flag_license_revocation_risk()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
begin
  if new.status = 'revoked' and old.status is distinct from new.status then
    select p.vendor_id
    into v_vendor_id
    from public.products p
    where p.id = new.product_id;

    insert into public.license_anomalies (
      license_id,
      product_id,
      user_id,
      anomaly_code,
      severity,
      details
    )
    values (
      new.id,
      new.product_id,
      new.user_id,
      'license_revoked',
      'medium',
      'La licencia fue revocada y requiere trazabilidad administrativa.'
    );

    insert into public.risk_events (
      entity_type,
      entity_id,
      vendor_id,
      user_id,
      severity,
      code,
      title,
      details
    )
    values (
      'license',
      new.id::text,
      v_vendor_id,
      new.user_id,
      'medium',
      'license_revoked',
      'Licencia revocada',
      'Se revoco una licencia y conviene validar si hay abuso, reembolso o disputa asociada.'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists flag_license_revocation_risk_after_update on public.licenses;
create trigger flag_license_revocation_risk_after_update
after update of status on public.licenses
for each row
execute procedure public.flag_license_revocation_risk();

create or replace function public.flag_download_burst_risk()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_downloads integer;
  v_license_id uuid;
  v_vendor_id uuid;
begin
  select count(*)
  into v_recent_downloads
  from public.downloads d
  where d.user_id = new.user_id
    and d.product_id = new.product_id
    and d.downloaded_at >= now() - interval '24 hours';

  if v_recent_downloads >= 5 then
    select l.id
    into v_license_id
    from public.licenses l
    where l.user_id = new.user_id
      and l.product_id = new.product_id
    order by l.issued_at desc
    limit 1;

    select p.vendor_id
    into v_vendor_id
    from public.products p
    where p.id = new.product_id;

    insert into public.license_anomalies (
      license_id,
      product_id,
      user_id,
      anomaly_code,
      severity,
      details
    )
    values (
      v_license_id,
      new.product_id,
      new.user_id,
      'download_burst',
      'high',
      'Se detectaron 5 o mas descargas del mismo producto por el mismo usuario en menos de 24 horas.'
    );

    insert into public.risk_events (
      entity_type,
      entity_id,
      vendor_id,
      user_id,
      severity,
      code,
      title,
      details
    )
    values (
      'product',
      new.product_id::text,
      v_vendor_id,
      new.user_id,
      'high',
      'download_burst',
      'Patron de descarga sospechoso',
      'Un mismo usuario ha generado un volumen de descargas inusual en una ventana de 24 horas.'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists flag_download_burst_risk_after_insert on public.downloads;
create trigger flag_download_burst_risk_after_insert
after insert on public.downloads
for each row
execute procedure public.flag_download_burst_risk();

insert into public.moderation_flags (
  product_id,
  flag_code,
  severity,
  reason,
  is_active
)
select
  p.id,
  'moderation_attention',
  case
    when p.moderation_status = 'hidden' then 'high'
    else 'medium'
  end,
  coalesce(p.rejection_reason, 'Producto con atencion de moderacion'),
  true
from public.products p
where p.moderation_status in ('rejected', 'hidden')
on conflict (product_id, flag_code) do update
set
  severity = excluded.severity,
  reason = excluded.reason,
  is_active = true,
  resolved_at = null;
