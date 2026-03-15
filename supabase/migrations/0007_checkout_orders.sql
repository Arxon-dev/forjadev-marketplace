-- Fase siguiente: checkout simple y ordenes por producto

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "order_items_insert_via_own_order" on public.order_items;
create policy "order_items_insert_via_own_order" on public.order_items
for insert to authenticated
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_id and o.user_id = auth.uid()
  )
);
