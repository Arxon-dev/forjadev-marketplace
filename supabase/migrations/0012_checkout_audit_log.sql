-- Garantiza auditoria de checkout en la propia base de datos,
-- incluso cuando el RPC se invoca fuera de la API Next.js.

create or replace function public.create_checkout_order(p_product_id uuid)
returns table (
  order_id uuid,
  license_key text,
  license_issued boolean,
  message text
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

  insert into public.orders (user_id, total_cents, currency, status)
  values (
    v_user_id,
    case when v_is_free then 0 else v_price_cents end,
    coalesce(v_currency, 'EUR'),
    'completed'
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, price_cents)
  values (
    v_order_id,
    p_product_id,
    case when v_is_free then 0 else v_price_cents end
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
      'license_issued', not v_is_free
    )
  );

  return query
  select
    v_order_id,
    v_license_key,
    not v_is_free,
    case
      when v_is_free then 'Compra completada correctamente'
      else 'Compra completada y licencia emitida correctamente'
    end;
end;
$$;
