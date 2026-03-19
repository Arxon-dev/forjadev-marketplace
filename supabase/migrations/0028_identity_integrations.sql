-- Phase 6 foundation: provider identities and public ecosystem links.

alter table public.vendors
  add column if not exists discord_url text,
  add column if not exists steam_url text,
  add column if not exists x_url text,
  add column if not exists website_url text;

create table if not exists public.user_provider_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('discord', 'steam')),
  provider_user_id text not null,
  provider_email text,
  provider_username text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_provider_identities_user_provider_unique unique (user_id, provider),
  constraint user_provider_identities_provider_subject_unique unique (provider, provider_user_id)
);

alter table public.user_provider_identities enable row level security;

drop policy if exists "user_provider_identities_select_own_or_admin" on public.user_provider_identities;
create policy "user_provider_identities_select_own_or_admin" on public.user_provider_identities
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

create index if not exists idx_user_provider_identities_user_provider
  on public.user_provider_identities (user_id, provider);

create index if not exists idx_user_provider_identities_provider_subject
  on public.user_provider_identities (provider, provider_user_id);

create or replace function public.touch_user_provider_identity_updated_at()
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

drop trigger if exists touch_user_provider_identity_updated_at_before_update on public.user_provider_identities;
create trigger touch_user_provider_identity_updated_at_before_update
before update on public.user_provider_identities
for each row
execute procedure public.touch_user_provider_identity_updated_at();

create or replace function public.sync_user_provider_identities(p_user_id uuid default auth.uid())
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_rows_upserted integer := 0;
begin
  if p_user_id is null then
    raise exception 'Necesitas iniciar sesion';
  end if;

  perform public.ensure_profile_exists(p_user_id);

  with supported_identities as (
    select
      i.user_id,
      i.provider,
      i.id as provider_user_id,
      i.identity_data ->> 'email' as provider_email,
      coalesce(
        i.identity_data ->> 'full_name',
        i.identity_data ->> 'name',
        i.identity_data ->> 'user_name',
        i.identity_data ->> 'preferred_username',
        i.identity_data ->> 'nick'
      ) as provider_username,
      i.identity_data as metadata
    from auth.identities i
    where i.user_id = p_user_id
      and i.provider in ('discord', 'steam')
  ), upserted as (
    insert into public.user_provider_identities (
      user_id,
      provider,
      provider_user_id,
      provider_email,
      provider_username,
      metadata
    )
    select
      si.user_id,
      si.provider,
      si.provider_user_id,
      si.provider_email,
      si.provider_username,
      si.metadata
    from supported_identities si
    on conflict (user_id, provider) do update
    set
      provider_user_id = excluded.provider_user_id,
      provider_email = excluded.provider_email,
      provider_username = excluded.provider_username,
      metadata = excluded.metadata,
      updated_at = now()
    returning 1
  )
  select count(*) into v_rows_upserted
  from upserted;

  delete from public.user_provider_identities upi
  where upi.user_id = p_user_id
    and upi.provider in ('discord', 'steam')
    and not exists (
      select 1
      from auth.identities i
      where i.user_id = p_user_id
        and i.provider = upi.provider
    );

  return v_rows_upserted;
end;
$$;

revoke all on function public.sync_user_provider_identities(uuid) from public;
revoke all on function public.sync_user_provider_identities(uuid) from anon;
grant execute on function public.sync_user_provider_identities(uuid) to authenticated;
