-- Automatic product metrics and seller reputation refresh.

create or replace function public.touch_product_updated_at()
returns trigger
language plpgsql
as $$
begin
  if
    new.vendor_id is distinct from old.vendor_id or
    new.category_id is distinct from old.category_id or
    new.game_id is distinct from old.game_id or
    new.title is distinct from old.title or
    new.slug is distinct from old.slug or
    new.short_description is distinct from old.short_description or
    new.description is distinct from old.description or
    new.support_policy is distinct from old.support_policy or
    new.refund_policy is distinct from old.refund_policy or
    new.update_policy is distinct from old.update_policy or
    new.price_cents is distinct from old.price_cents or
    new.currency is distinct from old.currency or
    new.is_free is distinct from old.is_free or
    new.featured is distinct from old.featured or
    new.moderation_status is distinct from old.moderation_status or
    new.rejection_reason is distinct from old.rejection_reason or
    new.compatibility is distinct from old.compatibility or
    new.featured_image_url is distinct from old.featured_image_url
  then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists touch_product_updated_at_before_update on public.products;
create trigger touch_product_updated_at_before_update
before update on public.products
for each row
execute procedure public.touch_product_updated_at();

create or replace function public.refresh_product_metrics(p_product_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products p
  set
    rating_count = coalesce((
      select count(*)::integer
      from public.reviews r
      where r.product_id = p.id
    ), 0),
    rating_average = coalesce((
      select round(avg(r.rating)::numeric, 2)
      from public.reviews r
      where r.product_id = p.id
    ), 0),
    download_count = coalesce((
      select count(*)::integer
      from public.downloads d
      where d.product_id = p.id
    ), 0),
    purchase_count = coalesce((
      select count(*)::integer
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.product_id = p.id
        and o.status = 'completed'
    ), 0)
  where p_product_id is null or p.id = p_product_id;
end;
$$;

create or replace function public.refresh_seller_trust(p_vendor_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_seller_reputation_snapshot(p_vendor_id);
  perform public.refresh_seller_badges(p_vendor_id);
end;
$$;

create or replace function public.refresh_product_and_seller_metrics(p_product_id uuid)
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

  perform public.refresh_product_metrics(p_product_id);

  select vendor_id
  into v_vendor_id
  from public.products
  where id = p_product_id;

  if v_vendor_id is not null then
    perform public.refresh_seller_trust(v_vendor_id);
  end if;
end;
$$;

create or replace function public.handle_reviews_metrics_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_product_and_seller_metrics(old.product_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    perform public.refresh_product_and_seller_metrics(old.product_id);
  end if;

  perform public.refresh_product_and_seller_metrics(new.product_id);
  return new;
end;
$$;

create or replace function public.handle_downloads_metrics_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_product_and_seller_metrics(old.product_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    perform public.refresh_product_and_seller_metrics(old.product_id);
  end if;

  perform public.refresh_product_and_seller_metrics(new.product_id);
  return new;
end;
$$;

create or replace function public.handle_order_items_metrics_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_product_and_seller_metrics(old.product_id);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.product_id is distinct from new.product_id then
      perform public.refresh_product_and_seller_metrics(old.product_id);
      perform public.refresh_product_and_seller_metrics(new.product_id);
    else
      perform public.refresh_product_and_seller_metrics(new.product_id);
    end if;

    return new;
  end if;

  perform public.refresh_product_and_seller_metrics(new.product_id);
  return new;
end;
$$;

create or replace function public.handle_orders_status_metrics_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
begin
  for v_product_id in
    select distinct oi.product_id
    from public.order_items oi
    where oi.order_id = new.id
  loop
    perform public.refresh_product_and_seller_metrics(v_product_id);
  end loop;

  return new;
end;
$$;

create or replace function public.handle_products_trust_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_seller_trust(old.vendor_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.vendor_id is distinct from new.vendor_id then
    perform public.refresh_seller_trust(old.vendor_id);
  end if;

  perform public.refresh_seller_trust(new.vendor_id);
  return new;
end;
$$;

drop trigger if exists refresh_reviews_metrics_after_write on public.reviews;
create trigger refresh_reviews_metrics_after_write
after insert or update or delete on public.reviews
for each row
execute procedure public.handle_reviews_metrics_refresh();

drop trigger if exists refresh_downloads_metrics_after_write on public.downloads;
create trigger refresh_downloads_metrics_after_write
after insert or update or delete on public.downloads
for each row
execute procedure public.handle_downloads_metrics_refresh();

drop trigger if exists refresh_order_items_metrics_after_write on public.order_items;
create trigger refresh_order_items_metrics_after_write
after insert or update or delete on public.order_items
for each row
execute procedure public.handle_order_items_metrics_refresh();

drop trigger if exists refresh_orders_status_after_update on public.orders;
create trigger refresh_orders_status_after_update
after update of status on public.orders
for each row
when (old.status is distinct from new.status)
execute procedure public.handle_orders_status_metrics_refresh();

drop trigger if exists refresh_products_trust_after_write on public.products;
create trigger refresh_products_trust_after_write
after insert or delete or update of vendor_id, moderation_status, is_free, updated_at
on public.products
for each row
execute procedure public.handle_products_trust_refresh();

revoke all on function public.refresh_product_metrics(uuid) from public;
revoke all on function public.refresh_product_metrics(uuid) from anon;
revoke all on function public.refresh_seller_trust(uuid) from public;
revoke all on function public.refresh_seller_trust(uuid) from anon;
revoke all on function public.refresh_product_and_seller_metrics(uuid) from public;
revoke all on function public.refresh_product_and_seller_metrics(uuid) from anon;

select public.refresh_product_metrics();
select public.refresh_seller_trust();
