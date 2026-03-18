-- Phase 3 completion: product guides and buyer update notifications.

create table if not exists public.product_guides (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null,
  body text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.product_guides enable row level security;

drop policy if exists "product_guides_select_public" on public.product_guides;
create policy "product_guides_select_public" on public.product_guides
for select
using (
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.moderation_status = 'approved'
  )
  or exists (
    select 1
    from public.products p
    join public.vendors v on v.id = p.vendor_id
    where p.id = product_id
      and v.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'admin'
  )
);

drop policy if exists "product_guides_modify_owner" on public.product_guides;
create policy "product_guides_modify_owner" on public.product_guides
for all to authenticated
using (
  exists (
    select 1
    from public.products p
    join public.vendors v on v.id = p.vendor_id
    where p.id = product_id
      and v.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.products p
    join public.vendors v on v.id = p.vendor_id
    where p.id = product_id
      and v.user_id = auth.uid()
  )
);

create index if not exists idx_product_guides_product_sort
  on public.product_guides (product_id, sort_order asc, created_at asc);

create or replace function public.notify_product_version_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_version public.product_versions%rowtype;
  v_vendor_user_id uuid;
  v_notification_exists boolean;
  v_recipient_id uuid;
begin
  select *
  into v_version
  from public.product_versions
  where id = new.product_version_id;

  if not found then
    return new;
  end if;

  select *
  into v_product
  from public.products
  where id = v_version.product_id;

  if not found or v_product.moderation_status <> 'approved' then
    return new;
  end if;

  select v.user_id
  into v_vendor_user_id
  from public.vendors v
  where v.id = v_product.vendor_id;

  select exists (
    select 1
    from public.user_notifications un
    where un.kind = 'product_version_published'
      and un.entity_type = 'product_version'
      and un.entity_id = v_version.id::text
  )
  into v_notification_exists;

  if v_notification_exists then
    return new;
  end if;

  for v_recipient_id in
    with owners as (
      select distinct d.user_id
      from public.downloads d
      where d.product_id = v_product.id

      union

      select distinct o.user_id
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.product_id = v_product.id
        and o.status = 'completed'
    )
    select owner.user_id
    from owners owner
    where owner.user_id is not null
      and owner.user_id <> coalesce(v_vendor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  loop
    insert into public.user_notifications (
      recipient_user_id,
      actor_user_id,
      kind,
      title,
      body,
      href,
      entity_type,
      entity_id,
      metadata
    )
    values (
      v_recipient_id,
      v_vendor_user_id,
      'product_version_published',
      'Nueva version disponible',
      v_product.title || ' · ' || v_version.version,
      '/products/' || v_product.slug,
      'product_version',
      v_version.id::text,
      jsonb_build_object(
        'productId', v_product.id,
        'productSlug', v_product.slug,
        'productTitle', v_product.title,
        'version', v_version.version
      )
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists notify_product_version_release_after_insert on public.product_files;
create trigger notify_product_version_release_after_insert
after insert on public.product_files
for each row
execute procedure public.notify_product_version_release();
