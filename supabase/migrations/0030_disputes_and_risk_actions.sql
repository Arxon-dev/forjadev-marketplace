-- Phase 7 follow-up: dispute creation and admin risk resolution workflows.

drop policy if exists "risk_events_update_admin_only" on public.risk_events;
create policy "risk_events_update_admin_only" on public.risk_events
for update to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "disputes_insert_owner" on public.disputes;
create policy "disputes_insert_owner" on public.disputes
for insert to authenticated
with check (
  opened_by_user_id = auth.uid()
  and (
    order_id is null
    or exists (
      select 1
      from public.orders o
      where o.id = order_id
        and o.user_id = auth.uid()
    )
  )
  and (
    license_id is null
    or exists (
      select 1
      from public.licenses l
      where l.id = license_id
        and l.user_id = auth.uid()
    )
  )
  and (
    product_id is null
    or exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.product_id = product_id
        and o.user_id = auth.uid()
        and o.status = 'completed'
    )
  )
);

drop policy if exists "disputes_update_admin_only" on public.disputes;
create policy "disputes_update_admin_only" on public.disputes
for update to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
