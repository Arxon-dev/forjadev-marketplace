-- Phase 5: public user collections for curation and discovery.

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  slug text not null unique,
  description text,
  is_public boolean not null default true,
  featured_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint collection_items_unique unique (collection_id, product_id)
);

alter table public.collections enable row level security;
alter table public.collection_items enable row level security;

drop policy if exists "collections_select_public_or_owner" on public.collections;
create policy "collections_select_public_or_owner" on public.collections
for select
using (
  is_public = true
  or user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "collections_insert_own" on public.collections;
create policy "collections_insert_own" on public.collections
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "collections_update_owner_or_admin" on public.collections;
create policy "collections_update_owner_or_admin" on public.collections
for update to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "collections_delete_owner_or_admin" on public.collections;
create policy "collections_delete_owner_or_admin" on public.collections
for delete to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "collection_items_select_visible_collection" on public.collection_items;
create policy "collection_items_select_visible_collection" on public.collection_items
for select
using (
  exists (
    select 1
    from public.collections c
    where c.id = collection_id
      and (
        c.is_public = true
        or c.user_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role = 'admin'
        )
      )
  )
);

drop policy if exists "collection_items_modify_owner_or_admin" on public.collection_items;
create policy "collection_items_modify_owner_or_admin" on public.collection_items
for all to authenticated
using (
  exists (
    select 1
    from public.collections c
    where c.id = collection_id
      and (
        c.user_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role = 'admin'
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.collections c
    where c.id = collection_id
      and (
        c.user_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role = 'admin'
        )
      )
  )
  and exists (
    select 1
    from public.products pr
    where pr.id = product_id
      and pr.moderation_status = 'approved'
  )
);

create index if not exists idx_collections_public_updated
  on public.collections (is_public, updated_at desc);

create index if not exists idx_collections_user_updated
  on public.collections (user_id, updated_at desc);

create index if not exists idx_collections_slug
  on public.collections (slug);

create index if not exists idx_collection_items_collection_sort
  on public.collection_items (collection_id, sort_order asc, created_at asc);

create index if not exists idx_collection_items_product_created
  on public.collection_items (product_id, created_at desc);

create or replace function public.touch_collection_updated_at()
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

drop trigger if exists touch_collection_updated_at_before_update on public.collections;
create trigger touch_collection_updated_at_before_update
before update on public.collections
for each row
execute procedure public.touch_collection_updated_at();

create or replace function public.touch_collection_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_collection_id uuid;
begin
  v_collection_id := coalesce(new.collection_id, old.collection_id);

  if v_collection_id is not null then
    update public.collections
    set updated_at = now()
    where id = v_collection_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists touch_collection_activity_after_insert on public.collection_items;
create trigger touch_collection_activity_after_insert
after insert on public.collection_items
for each row
execute procedure public.touch_collection_activity();

drop trigger if exists touch_collection_activity_after_update on public.collection_items;
create trigger touch_collection_activity_after_update
after update on public.collection_items
for each row
execute procedure public.touch_collection_activity();

drop trigger if exists touch_collection_activity_after_delete on public.collection_items;
create trigger touch_collection_activity_after_delete
after delete on public.collection_items
for each row
execute procedure public.touch_collection_activity();
