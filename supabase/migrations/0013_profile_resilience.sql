-- Refuerza la creacion automatica de perfiles y permite reparar
-- usuarios auth sin fila en public.profiles.

create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_base_username text;
  v_username text;
  v_display_name text;
begin
  v_base_username := coalesce(
    new.raw_user_meta_data ->> 'username',
    split_part(new.email, '@', 1),
    'user'
  );
  v_username := left(v_base_username, 40);
  v_display_name := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'username',
    split_part(new.email, '@', 1),
    'Buyer'
  );

  if exists (
    select 1
    from public.profiles p
    where p.username = v_username
      and p.id <> new.id
  ) then
    v_username := left(v_base_username, 27) || '_' || left(new.id::text, 12);
  end if;

  insert into public.profiles (
    id,
    email,
    username,
    display_name,
    role,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    v_username,
    v_display_name,
    'buyer',
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    username = public.profiles.username,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    updated_at = now();

  return new;
exception when others then
  raise warning 'Error creando perfil para usuario %: %', new.id, sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.ensure_profile_exists(p_user_id uuid default auth.uid())
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user auth.users%rowtype;
  v_base_username text;
  v_username text;
  v_display_name text;
begin
  if p_user_id is null then
    raise exception 'Necesitas iniciar sesion';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = p_user_id
  ) then
    return p_user_id;
  end if;

  select *
  into v_user
  from auth.users
  where id = p_user_id;

  if not found then
    raise exception 'Usuario auth no encontrado';
  end if;

  v_base_username := coalesce(
    v_user.raw_user_meta_data ->> 'username',
    split_part(v_user.email, '@', 1),
    'user'
  );
  v_username := left(v_base_username, 40);
  v_display_name := coalesce(
    v_user.raw_user_meta_data ->> 'display_name',
    v_user.raw_user_meta_data ->> 'username',
    split_part(v_user.email, '@', 1),
    'Buyer'
  );

  if exists (
    select 1
    from public.profiles p
    where p.username = v_username
      and p.id <> v_user.id
  ) then
    v_username := left(v_base_username, 27) || '_' || left(v_user.id::text, 12);
  end if;

  insert into public.profiles (
    id,
    email,
    username,
    display_name,
    role,
    created_at,
    updated_at
  )
  values (
    v_user.id,
    v_user.email,
    v_username,
    v_display_name,
    'buyer',
    now(),
    now()
  )
  on conflict (id) do nothing;

  return p_user_id;
end;
$$;

revoke all on function public.ensure_profile_exists(uuid) from public;
revoke all on function public.ensure_profile_exists(uuid) from anon;
grant execute on function public.ensure_profile_exists(uuid) to authenticated;

with missing_users as (
  select
    u.id,
    u.email,
    coalesce(
      u.raw_user_meta_data ->> 'username',
      split_part(u.email, '@', 1),
      'user'
    ) as base_username,
    coalesce(
      u.raw_user_meta_data ->> 'display_name',
      u.raw_user_meta_data ->> 'username',
      split_part(u.email, '@', 1),
      'Buyer'
    ) as base_display_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where p.id is null
),
ranked_missing_users as (
  select
    mu.*,
    row_number() over (
      partition by left(mu.base_username, 40)
      order by mu.id
    ) as username_rank
  from missing_users mu
)
insert into public.profiles (
  id,
  email,
  username,
  display_name,
  role,
  created_at,
  updated_at
)
select
  u.id,
  u.email,
  case
    when u.username_rank > 1
      or exists (
        select 1
        from public.profiles p2
        where p2.username = left(u.base_username, 40)
          and p2.id <> u.id
      )
      then left(u.base_username, 27) || '_' || left(u.id::text, 12)
    else left(u.base_username, 40)
  end,
  u.base_display_name,
  'buyer',
  now(),
  now()
from ranked_missing_users u
on conflict (id) do nothing;
