-- Phase 4 expansion: seller-managed bundles with transactional checkout.

create table if not exists public.bundles (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  title text not null,
  slug text not null unique,
  short_description text,
  description text,
  featured_image_url text,
  price_cents integer not null check (price_cents >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bundle_products (
  bundle_id uuid not null references public.bundles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (bundle_id, product_id)
);

alter table public.bundles enable row level security;
alter table public.bundle_products enable row level security;

drop policy if exists "bundles_select_public_or_owner" on public.bundles;
create policy "bundles_select_public_or_owner" on public.bundles
for select
using (
  (
    is_active = true
    and exists (
      select 1
      from public.bundle_products bp
      where bp.bundle_id = id
    )
    and not exists (
      select 1
      from public.bundle_products bp
      join public.products p on p.id = bp.product_id
      where bp.bundle_id = id
        and p.moderation_status <> 'approved'
    )
  )
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

drop policy if exists "bundles_modify_owner" on public.bundles;
create policy "bundles_modify_owner" on public.bundles
for all to authenticated
using (
  exists (
    select 1
    from public.vendors v
    where v.id = vendor_id
      and v.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.vendors v
    where v.id = vendor_id
      and v.user_id = auth.uid()
  )
);

drop policy if exists "bundle_products_select_public_or_owner" on public.bundle_products;
create policy "bundle_products_select_public_or_owner" on public.bundle_products
for select
using (
  exists (
    select 1
    from public.bundles b
    where b.id = bundle_id
      and (
        (
          b.is_active = true
          and not exists (
            select 1
            from public.bundle_products bp2
            join public.products p on p.id = bp2.product_id
            where bp2.bundle_id = b.id
              and p.moderation_status <> 'approved'
          )
        )
        or exists (
          select 1
          from public.vendors v
          where v.id = b.vendor_id
            and v.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role = 'admin'
        )
      )
  )
);

drop policy if exists "bundle_products_modify_owner" on public.bundle_products;
create policy "bundle_products_modify_owner" on public.bundle_products
for all to authenticated
using (
  exists (
    select 1
    from public.bundles b
    join public.vendors v on v.id = b.vendor_id
    where b.id = bundle_id
      and v.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.bundles b
    join public.vendors v on v.id = b.vendor_id
    where b.id = bundle_id
      and v.user_id = auth.uid()
  )
);

create index if not exists idx_bundles_vendor_updated
  on public.bundles (vendor_id, updated_at desc);

create index if not exists idx_bundles_active_updated
  on public.bundles (is_active, updated_at desc);

create index if not exists idx_bundle_products_product
  on public.bundle_products (product_id);

create index if not exists idx_bundle_products_bundle_sort
  on public.bundle_products (bundle_id, sort_order asc, created_at asc);

create or replace function public.touch_bundle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.bundles
    set updated_at = now()
    where id = old.bundle_id;

    return old;
  end if;

  update public.bundles
  set updated_at = now()
  where id = new.bundle_id;

  return new;
end;
$$;

drop trigger if exists touch_bundle_updated_at_after_insert on public.bundle_products;
create trigger touch_bundle_updated_at_after_insert
after insert on public.bundle_products
for each row
execute procedure public.touch_bundle_updated_at();

drop trigger if exists touch_bundle_updated_at_after_update on public.bundle_products;
create trigger touch_bundle_updated_at_after_update
after update on public.bundle_products
for each row
execute procedure public.touch_bundle_updated_at();

drop trigger if exists touch_bundle_updated_at_after_delete on public.bundle_products;
create trigger touch_bundle_updated_at_after_delete
after delete on public.bundle_products
for each row
execute procedure public.touch_bundle_updated_at();

create or replace function public.create_bundle_checkout_order(p_bundle_id uuid)
returns table (
  order_id uuid,
  licenses_issued integer,
  message text,
  total_cents integer,
  item_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_bundle public.bundles%rowtype;
  v_vendor_owner_id uuid;
  v_order_id uuid;
  v_order_item_id uuid;
  v_item_count integer := 0;
  v_total_original_cents integer := 0;
  v_total_cents integer := 0;
  v_remaining_cents integer := 0;
  v_item_index integer := 0;
  v_allocated_cents integer := 0;
  v_license_key text := null;
  v_attempt integer := 0;
  v_licenses_issued integer := 0;
  v_row record;
begin
  if v_user_id is null then
    raise exception 'Necesitas iniciar sesion';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_user_id
  ) then
    raise exception 'Perfil no encontrado';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':bundle:' || p_bundle_id::text, 0));

  select *
  into v_bundle
  from public.bundles
  where id = p_bundle_id;

  if not found then
    raise exception 'Bundle no encontrado';
  end if;

  if v_bundle.is_active <> true then
    raise exception 'Este bundle no esta disponible';
  end if;

  select v.user_id
  into v_vendor_owner_id
  from public.vendors v
  where v.id = v_bundle.vendor_id;

  if not found then
    raise exception 'No se pudo resolver el vendedor del bundle';
  end if;

  if v_vendor_owner_id = v_user_id then
    raise exception 'No puedes comprar tu propio bundle';
  end if;

  select
    count(*)::integer,
    coalesce(sum(p.price_cents), 0)::integer
  into
    v_item_count,
    v_total_original_cents
  from public.bundle_products bp
  join public.products p on p.id = bp.product_id
  where bp.bundle_id = p_bundle_id
    and p.moderation_status = 'approved';

  if v_item_count = 0 then
    raise exception 'Este bundle no tiene productos disponibles';
  end if;

  if exists (
    select 1
    from public.bundle_products bp
    join public.products p on p.id = bp.product_id
    where bp.bundle_id = p_bundle_id
      and p.moderation_status <> 'approved'
  ) then
    raise exception 'Este bundle incluye productos no disponibles';
  end if;

  if exists (
    select 1
    from public.bundle_products bp
    join public.products p on p.id = bp.product_id
    join public.order_items oi on oi.product_id = p.id
    join public.orders o on o.id = oi.order_id
    where bp.bundle_id = p_bundle_id
      and o.user_id = v_user_id
      and o.status = 'completed'
  ) then
    raise exception 'Ya tienes uno o mas productos de este bundle en tu biblioteca';
  end if;

  if v_bundle.price_cents > v_total_original_cents then
    raise exception 'El bundle no tiene un precio comercial valido';
  end if;

  v_total_cents := greatest(0, v_bundle.price_cents);
  v_remaining_cents := v_total_cents;

  insert into public.orders (user_id, total_cents, currency, status)
  values (
    v_user_id,
    v_total_cents,
    'EUR',
    'completed'
  )
  returning id into v_order_id;

  for v_row in
    select
      p.id as product_id,
      p.price_cents,
      p.is_free
    from public.bundle_products bp
    join public.products p on p.id = bp.product_id
    where bp.bundle_id = p_bundle_id
    order by bp.sort_order asc, bp.created_at asc, p.id asc
  loop
    v_item_index := v_item_index + 1;

    if v_total_original_cents <= 0 then
      v_allocated_cents := 0;
    elsif v_item_index = v_item_count then
      v_allocated_cents := v_remaining_cents;
    else
      v_allocated_cents := floor(v_total_cents * v_row.price_cents::numeric / v_total_original_cents::numeric);
      v_remaining_cents := greatest(0, v_remaining_cents - v_allocated_cents);
    end if;

    insert into public.order_items (order_id, product_id, price_cents)
    values (
      v_order_id,
      v_row.product_id,
      greatest(0, v_allocated_cents)
    )
    returning id into v_order_item_id;

    if not v_row.is_free then
      loop
        v_attempt := v_attempt + 1;
        v_license_key := concat(
          'FJ-',
          upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)),
          '-',
          upper(substr(replace(gen_random_uuid()::text, '-', ''), 5, 4)),
          '-',
          upper(substr(replace(gen_random_uuid()::text, '-', ''), 9, 4)),
          '-',
          upper(substr(replace(gen_random_uuid()::text, '-', ''), 13, 4))
        );

        begin
          insert into public.licenses (
            order_item_id,
            product_id,
            user_id,
            license_key,
            status
          )
          values (
            v_order_item_id,
            v_row.product_id,
            v_user_id,
            v_license_key,
            'active'
          );

          v_licenses_issued := v_licenses_issued + 1;
          exit;
        exception
          when unique_violation then
            if v_attempt >= 5 then
              raise exception 'No se pudo emitir una licencia unica';
            end if;
        end;
      end loop;

      v_attempt := 0;
    end if;
  end loop;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_user_id,
    'bundle.checkout.completed',
    'bundle',
    p_bundle_id::text,
    jsonb_build_object(
      'bundle_id', p_bundle_id,
      'order_id', v_order_id,
      'item_count', v_item_count,
      'licenses_issued', v_licenses_issued,
      'total_cents', v_total_cents
    )
  );

  return query
  select
    v_order_id,
    v_licenses_issued,
    'Bundle comprado correctamente',
    v_total_cents,
    v_item_count;
end;
$$;

revoke all on function public.create_bundle_checkout_order(uuid) from public;
revoke all on function public.create_bundle_checkout_order(uuid) from anon;
grant execute on function public.create_bundle_checkout_order(uuid) to authenticated;
