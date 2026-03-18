-- Discovery taxonomy foundation for ecosystem phase 1.
-- Adds games, richer categories, product-category mapping and
-- product discovery metadata without breaking current catalog flows.

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.categories
  add column if not exists description text,
  add column if not exists parent_id uuid references public.categories(id) on delete set null,
  add column if not exists is_active boolean not null default true,
  add column if not exists sort_order integer not null default 0;

create table if not exists public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, category_id)
);

alter table public.products
  add column if not exists game_id uuid references public.games(id) on delete set null,
  add column if not exists featured boolean not null default false,
  add column if not exists search_text text,
  add column if not exists view_count integer not null default 0,
  add column if not exists download_count integer not null default 0,
  add column if not exists purchase_count integer not null default 0,
  add column if not exists rating_average numeric(3,2) not null default 0,
  add column if not exists rating_count integer not null default 0;

alter table public.games enable row level security;
alter table public.categories enable row level security;
alter table public.product_categories enable row level security;

drop policy if exists "games_select_public" on public.games;
create policy "games_select_public" on public.games
for select to authenticated, anon
using (is_active = true);

drop policy if exists "categories_select_public" on public.categories;
create policy "categories_select_public" on public.categories
for select to authenticated, anon
using (is_active = true);

drop policy if exists "product_categories_select_public_or_owner" on public.product_categories;
create policy "product_categories_select_public_or_owner" on public.product_categories
for select to authenticated, anon
using (
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and (
        p.moderation_status = 'approved'
        or exists (
          select 1
          from public.vendors v
          where v.id = p.vendor_id
            and v.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.profiles pr
          where pr.id = auth.uid()
            and pr.role = 'admin'
        )
      )
  )
);

drop policy if exists "product_categories_insert_own" on public.product_categories;
create policy "product_categories_insert_own" on public.product_categories
for insert to authenticated
with check (
  exists (
    select 1
    from public.products p
    join public.vendors v on v.id = p.vendor_id
    where p.id = product_id
      and v.user_id = auth.uid()
  )
);

drop policy if exists "product_categories_delete_own" on public.product_categories;
create policy "product_categories_delete_own" on public.product_categories
for delete to authenticated
using (
  exists (
    select 1
    from public.products p
    join public.vendors v on v.id = p.vendor_id
    where p.id = product_id
      and v.user_id = auth.uid()
  )
);

create index if not exists idx_products_moderation_created_at
  on public.products (moderation_status, created_at desc);

create index if not exists idx_products_game_moderation
  on public.products (game_id, moderation_status);

create index if not exists idx_products_featured_moderation
  on public.products (featured, moderation_status);

create index if not exists idx_categories_parent_sort
  on public.categories (parent_id, sort_order);

create index if not exists idx_games_sort_active
  on public.games (sort_order, is_active);

create index if not exists idx_product_categories_category_product
  on public.product_categories (category_id, product_id);

create or replace function public.set_product_search_text()
returns trigger
language plpgsql
as $$
begin
  new.search_text := trim(
    concat_ws(
      ' ',
      new.title,
      coalesce(new.short_description, ''),
      coalesce(new.description, ''),
      coalesce(new.compatibility, '')
    )
  );

  return new;
end;
$$;

drop trigger if exists set_product_search_text_before_write on public.products;
create trigger set_product_search_text_before_write
before insert or update on public.products
for each row
execute procedure public.set_product_search_text();

insert into public.games (name, slug, is_active, sort_order)
values
  ('Rust', 'rust', true, 0)
on conflict (slug) do update
set
  name = excluded.name,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

with root_categories(name, slug, description, sort_order) as (
  values
    ('Plugin', 'plugin', 'Server-side gameplay and systems extensions.', 0),
    ('Map', 'map', 'Playable worlds, arenas and custom terrain.', 1),
    ('Asset', 'asset', 'Art, UI, prefabs and reusable content.', 2),
    ('Tool', 'tool', 'Utilities for management, moderation and operations.', 3),
    ('Service', 'service', 'Professional setup, custom work and support offers.', 4)
)
insert into public.categories (name, slug, description, is_active, sort_order)
select name, slug, description, true, sort_order
from root_categories
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

with child_categories(name, slug, parent_slug, description, sort_order) as (
  values
    ('Economy', 'economy', 'plugin', 'Economy systems, shops and virtual currencies.', 100),
    ('Raiding', 'raiding', 'plugin', 'Raid progression, damage tuning and explosive systems.', 101),
    ('PVP', 'pvp', 'plugin', 'Combat systems, events and competitive features.', 102),
    ('Admin', 'admin', 'tool', 'Admin panels, moderation and server operations tooling.', 103),
    ('Building', 'building', 'plugin', 'Building, deployables and construction experiences.', 104),
    ('Wipe Systems', 'wipe-systems', 'plugin', 'Progression, wipe cycles and retention systems.', 105),
    ('UI', 'ui', 'asset', 'User interface packs, HUDs and visual components.', 106),
    ('Performance', 'performance', 'tool', 'Optimization, monitoring and runtime efficiency.', 107)
)
insert into public.categories (name, slug, parent_id, description, is_active, sort_order)
select
  c.name,
  c.slug,
  p.id,
  c.description,
  true,
  c.sort_order
from child_categories c
join public.categories p on p.slug = c.parent_slug
on conflict (slug) do update
set
  name = excluded.name,
  parent_id = excluded.parent_id,
  description = excluded.description,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

update public.products
set game_id = (
  select g.id
  from public.games g
  where g.slug = 'rust'
)
where game_id is null;

insert into public.product_categories (product_id, category_id)
select p.id, p.category_id
from public.products p
where p.category_id is not null
on conflict (product_id, category_id) do nothing;

update public.products p
set search_text = trim(
  concat_ws(
    ' ',
    p.title,
    coalesce(p.short_description, ''),
    coalesce(p.description, ''),
    coalesce(p.compatibility, '')
  )
);

update public.products p
set rating_count = coalesce(r.rating_count, 0),
    rating_average = coalesce(r.rating_average, 0)
from (
  select
    product_id,
    count(*)::integer as rating_count,
    round(avg(rating)::numeric, 2) as rating_average
  from public.reviews
  group by product_id
) r
where r.product_id = p.id;

update public.products p
set download_count = coalesce(d.download_count, 0)
from (
  select product_id, count(*)::integer as download_count
  from public.downloads
  group by product_id
) d
where d.product_id = p.id;

update public.products p
set purchase_count = coalesce(o.purchase_count, 0)
from (
  select oi.product_id, count(*)::integer as purchase_count
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.status = 'completed'
  group by oi.product_id
) o
where o.product_id = p.id;
