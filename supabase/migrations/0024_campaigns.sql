-- Phase 4: campaign system for flash deals, launch discounts and placements.

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  bundle_id uuid references public.bundles(id) on delete cascade,
  title text not null,
  campaign_type text not null
    check (campaign_type in ('flash_deal', 'launch_discount', 'featured_placement')),
  discount_type text
    check (discount_type in ('percent', 'fixed')),
  discount_value integer
    check (discount_value is null or discount_value > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_single_target check (
    ((product_id is not null)::integer + (bundle_id is not null)::integer) = 1
  ),
  constraint campaigns_discount_required check (
    (
      campaign_type in ('flash_deal', 'launch_discount')
      and discount_type is not null
      and discount_value is not null
    )
    or (
      campaign_type = 'featured_placement'
      and discount_type is null
      and discount_value is null
    )
  )
);

alter table public.campaigns enable row level security;

drop policy if exists "campaigns_select_owner_or_admin" on public.campaigns;
create policy "campaigns_select_owner_or_admin" on public.campaigns
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

drop policy if exists "campaigns_modify_owner" on public.campaigns;
create policy "campaigns_modify_owner" on public.campaigns
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

create index if not exists idx_campaigns_product_active
  on public.campaigns (product_id, is_active, starts_at, ends_at);

create index if not exists idx_campaigns_bundle_active
  on public.campaigns (bundle_id, is_active, starts_at, ends_at);

create index if not exists idx_campaigns_vendor_created
  on public.campaigns (vendor_id, created_at desc);

create or replace function public.touch_campaign_updated_at()
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

drop trigger if exists touch_campaign_updated_at_before_update on public.campaigns;
create trigger touch_campaign_updated_at_before_update
before update on public.campaigns
for each row
execute procedure public.touch_campaign_updated_at();

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
  v_campaign public.campaigns%rowtype;
  v_coupon_code text := nullif(trim(coalesce(p_coupon_code, '')), '');
  v_coupon_discount_cents integer := 0;
  v_campaign_discount_cents integer := 0;
  v_discount_cents integer := 0;
  v_total_cents integer := 0;
  v_promo_source text := null;
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

  if not v_is_free then
    select *
    into v_campaign
    from public.campaigns c
    where c.product_id = p_product_id
      and c.campaign_type in ('flash_deal', 'launch_discount')
      and c.is_active = true
      and (c.starts_at is null or c.starts_at <= now())
      and (c.ends_at is null or c.ends_at >= now())
    order by
      case
        when c.discount_type = 'percent'
          then floor(v_price_cents * least(coalesce(c.discount_value, 0), 100) / 100.0)
        else least(v_price_cents, coalesce(c.discount_value, 0))
      end desc,
      c.created_at desc
    limit 1;

    if found then
      if v_campaign.discount_type = 'percent' then
        v_campaign_discount_cents := floor(v_price_cents * least(v_campaign.discount_value, 100) / 100.0);
      else
        v_campaign_discount_cents := least(v_price_cents, v_campaign.discount_value);
      end if;
    end if;
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
      v_coupon_discount_cents := floor(v_price_cents * least(v_coupon.discount_value, 100) / 100.0);
    else
      v_coupon_discount_cents := least(v_price_cents, v_coupon.discount_value);
    end if;
  end if;

  if v_coupon_discount_cents > v_campaign_discount_cents then
    v_discount_cents := v_coupon_discount_cents;
    v_promo_source := 'coupon';
  else
    v_discount_cents := v_campaign_discount_cents;
    if v_campaign_discount_cents > 0 then
      v_promo_source := 'campaign';
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

  if v_coupon_code is not null and v_promo_source = 'coupon' then
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
      'promo_source', v_promo_source,
      'coupon_code', case when v_promo_source = 'coupon' then upper(v_coupon.code) else null end,
      'campaign_id', case when v_promo_source = 'campaign' then v_campaign.id else null end,
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
      when v_promo_source = 'campaign' then 'Compra completada con promocion activa'
      when v_promo_source = 'coupon' then 'Compra completada con descuento aplicado'
      else 'Compra completada y licencia emitida correctamente'
    end,
    case when v_promo_source = 'coupon' then upper(v_coupon.code) else null end,
    v_discount_cents,
    v_total_cents;
end;
$$;

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
  v_campaign public.campaigns%rowtype;
  v_campaign_discount_cents integer := 0;
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

  select *
  into v_campaign
  from public.campaigns c
  where c.bundle_id = p_bundle_id
    and c.campaign_type in ('flash_deal', 'launch_discount')
    and c.is_active = true
    and (c.starts_at is null or c.starts_at <= now())
    and (c.ends_at is null or c.ends_at >= now())
  order by
    case
      when c.discount_type = 'percent'
        then floor(v_bundle.price_cents * least(coalesce(c.discount_value, 0), 100) / 100.0)
      else least(v_bundle.price_cents, coalesce(c.discount_value, 0))
    end desc,
    c.created_at desc
  limit 1;

  if found then
    if v_campaign.discount_type = 'percent' then
      v_campaign_discount_cents := floor(v_bundle.price_cents * least(v_campaign.discount_value, 100) / 100.0);
    else
      v_campaign_discount_cents := least(v_bundle.price_cents, v_campaign.discount_value);
    end if;
  end if;

  v_total_cents := greatest(0, v_bundle.price_cents - v_campaign_discount_cents);
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
      'campaign_id', case when v_campaign_discount_cents > 0 then v_campaign.id else null end,
      'discount_cents', v_campaign_discount_cents,
      'total_cents', v_total_cents
    )
  );

  return query
  select
    v_order_id,
    v_licenses_issued,
    case
      when v_campaign_discount_cents > 0 then 'Bundle comprado correctamente con promocion activa'
      else 'Bundle comprado correctamente'
    end,
    v_total_cents,
    v_item_count;
end;
$$;
