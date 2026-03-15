-- Fase siguiente: acceso seller a ventas, descargas y licencias de sus propios productos

drop policy if exists "downloads_select_seller_owned_products" on public.downloads;
create policy "downloads_select_seller_owned_products" on public.downloads
for select to authenticated
using (
  exists (
    select 1
    from public.products p
    join public.vendors v on v.id = p.vendor_id
    where p.id = product_id and v.user_id = auth.uid()
  )
);

drop policy if exists "order_items_select_seller_owned_products" on public.order_items;
create policy "order_items_select_seller_owned_products" on public.order_items
for select to authenticated
using (
  exists (
    select 1
    from public.products p
    join public.vendors v on v.id = p.vendor_id
    where p.id = product_id and v.user_id = auth.uid()
  )
);

drop policy if exists "orders_select_seller_via_owned_product" on public.orders;
create policy "orders_select_seller_via_owned_product" on public.orders
for select to authenticated
using (
  exists (
    select 1
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    join public.vendors v on v.id = p.vendor_id
    where oi.order_id = id and v.user_id = auth.uid()
  )
);

drop policy if exists "licenses_select_seller_owned_products" on public.licenses;
create policy "licenses_select_seller_owned_products" on public.licenses
for select to authenticated
using (
  exists (
    select 1
    from public.products p
    join public.vendors v on v.id = p.vendor_id
    where p.id = product_id and v.user_id = auth.uid()
  )
);
