-- Phase 4 foundation: seller-managed coupons with transactional checkout support.

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  code text not null unique,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value integer not null check (discount_value > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.coupons enable row level security;

drop policy if exists "coupons_select_owner" on public.coupons;
create policy "coupons_select_owner" on public.coupons
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

drop policy if exists "coupons_modify_owner" on public.coupons;
create policy "coupons_modify_owner" on public.coupons
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

create index if not exists idx_coupons_product_active
  on public.coupons (product_id, is_active, created_at desc);

create index if not exists idx_coupons_vendor_created
  on public.coupons (vendor_id, created_at desc);

create or replace function public.create_checkout_order(
  p_product_id uuid,
  p_coupon_code text default null
)
returns table (
  order_id uuid,
  license_key text,
  license_issued boolean,
  message text,
  coupon_code text,
  discount_cents integer,
  total_cents integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_vendor_id uuid;
  v_vendor_owner_id uuid;
  v_price_cents integer;
  v_currency text;
  v_is_free boolean;
  v_moderation_status text;
  v_order_id uuid;
  v_order_item_id uuid;
  v_license_key text := null;
  v_attempt integer := 0;
  v_coupon public.coupons%rowtype;
  v_coupon_code text := nullif(trim(coalesce(p_coupon_code, '')), '');
  v_discount_cents integer := 0;
  v_total_cents integer := 0;
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

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_product_id::text, 0));

  select
    p.vendor_id,
    p.price_cents,
    p.currency,
    p.is_free,
    p.moderation_status
  into
    v_vendor_id,
    v_price_cents,
    v_currency,
    v_is_free,
    v_moderation_status
  from public.products p
  where p.id = p_product_id;

  if not found then
    raise exception 'Producto no encontrado';
  end if;

  if v_moderation_status <> 'approved' then
    raise exception 'Solo puedes comprar productos aprobados';
  end if;

  select v.user_id
  into v_vendor_owner_id
  from public.vendors v
  where v.id = v_vendor_id;

  if not found then
    raise exception 'No se pudo resolver el vendedor del producto';
  end if;

  if v_vendor_owner_id = v_user_id then
    raise exception 'No puedes comprar tu propio producto';
  end if;

  if exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.product_id = p_product_id
      and o.user_id = v_user_id
      and o.status = 'completed'
  ) then
    raise exception 'Ya tienes este producto en tu biblioteca';
  end if;

  if v_is_free and v_coupon_code is not null then
    raise exception 'No puedes aplicar cupones a productos gratuitos';
  end if;

  if v_coupon_code is not null then
    select *
    into v_coupon
    from public.coupons c
    where c.product_id = p_product_id
      and upper(c.code) = upper(v_coupon_code)
      and c.is_active = true
      and (c.starts_at is null or c.starts_at <= now())
      and (c.ends_at is null or c.ends_at >= now())
      and (c.max_redemptions is null or c.redemption_count < c.max_redemptions)
    order by c.created_at desc
    limit 1
    for update;

    if not found then
      raise exception 'Cupon no valido';
    end if;

    if v_coupon.discount_type = 'percent' then
      v_discount_cents := floor(v_price_cents * least(v_coupon.discount_value, 100) / 100.0);
    else
      v_discount_cents := least(v_price_cents, v_coupon.discount_value);
    end if;
  end if;

  v_total_cents := greatest(0, case when v_is_free then 0 else v_price_cents - v_discount_cents end);

  insert into public.orders (user_id, total_cents, currency, status)
  values (
    v_user_id,
    v_total_cents,
    coalesce(v_currency, 'EUR'),
    'completed'
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, price_cents)
  values (
    v_order_id,
    p_product_id,
    v_total_cents
  )
  returning id into v_order_item_id;

  if not v_is_free then
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
          p_product_id,
          v_user_id,
          v_license_key,
          'active'
        );

        exit;
      exception
        when unique_violation then
          if v_attempt >= 5 then
            raise exception 'No se pudo emitir una licencia unica';
          end if;
      end;
    end loop;
  end if;

  if v_coupon_code is not null then
    update public.coupons
    set redemption_count = redemption_count + 1
    where id = v_coupon.id;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    v_user_id,
    'checkout.completed',
    'order',
    v_order_id::text,
    jsonb_build_object(
      'product_id', p_product_id,
      'license_issued', not v_is_free,
      'coupon_code', case when v_coupon_code is null then null else upper(v_coupon.code) end,
      'discount_cents', v_discount_cents,
      'total_cents', v_total_cents
    )
  );

  return query
  select
    v_order_id,
    v_license_key,
    not v_is_free,
    case
      when v_is_free then 'Compra completada correctamente'
      when v_discount_cents > 0 then 'Compra completada con descuento aplicado'
      else 'Compra completada y licencia emitida correctamente'
    end,
    case when v_coupon_code is null then null else upper(v_coupon.code) end,
    v_discount_cents,
    v_total_cents;
end;
$$;
