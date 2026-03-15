-- Endurece la emision de licencias para que solo puedan crearse
-- sobre order_items propias y del mismo producto comprado.

drop policy if exists "licenses_insert_via_own_order_item" on public.licenses;
create policy "licenses_insert_via_own_order_item" on public.licenses
for insert to authenticated
with check (
  user_id = auth.uid()
  and status = 'active'
  and exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = order_item_id
      and oi.product_id = product_id
      and o.user_id = auth.uid()
  )
);
