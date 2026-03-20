-- Phase 10: explicit lifecycle for seller product releases.

alter table public.product_versions
  add column if not exists release_status text,
  add column if not exists activated_at timestamptz,
  add column if not exists retired_at timestamptz,
  add column if not exists retired_reason text;

with file_backed_versions as (
  select
    pv.id,
    row_number() over (
      partition by pv.product_id
      order by pv.created_at desc, pv.id desc
    ) as file_rank
  from public.product_versions pv
  where exists (
    select 1
    from public.product_files pf
    where pf.product_version_id = pv.id
  )
)
update public.product_versions pv
set
  release_status = case
    when exists (
      select 1 from file_backed_versions fb
      where fb.id = pv.id and fb.file_rank = 1
    ) then 'active'
    when exists (
      select 1 from file_backed_versions fb
      where fb.id = pv.id
    ) then 'historical'
    else 'retired'
  end,
  activated_at = case
    when exists (
      select 1 from file_backed_versions fb
      where fb.id = pv.id
    ) then coalesce(pv.activated_at, pv.created_at)
    else null
  end,
  retired_at = case
    when not exists (
      select 1 from file_backed_versions fb
      where fb.id = pv.id
    ) then coalesce(pv.retired_at, now())
    else null
  end,
  retired_reason = case
    when not exists (
      select 1 from file_backed_versions fb
      where fb.id = pv.id
    ) then coalesce(pv.retired_reason, 'missing_asset_backfill')
    else null
  end;

alter table public.product_versions
  alter column release_status set default 'pending';

update public.product_versions
set release_status = 'pending'
where release_status is null;

alter table public.product_versions
  alter column release_status set not null;

alter table public.product_versions
  drop constraint if exists product_versions_release_status_check;

alter table public.product_versions
  add constraint product_versions_release_status_check
    check (release_status in ('pending', 'active', 'historical', 'retired'));

create index if not exists idx_product_versions_product_release_status
  on public.product_versions (product_id, release_status, created_at desc);

create unique index if not exists idx_product_versions_single_active
  on public.product_versions (product_id)
  where release_status = 'active';

create unique index if not exists idx_product_versions_single_pending
  on public.product_versions (product_id)
  where release_status = 'pending';
