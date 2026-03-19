-- Phase 5 community layer: product discussions.

create table if not exists public.product_discussions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discussion_messages (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.product_discussions(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.product_discussions enable row level security;
alter table public.discussion_messages enable row level security;

drop policy if exists "product_discussions_select_public" on public.product_discussions;
create policy "product_discussions_select_public" on public.product_discussions
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

drop policy if exists "product_discussions_insert_authenticated" on public.product_discussions;
create policy "product_discussions_insert_authenticated" on public.product_discussions
for insert to authenticated
with check (
  author_user_id = auth.uid()
  and exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.moderation_status = 'approved'
  )
);

drop policy if exists "discussion_messages_select_public" on public.discussion_messages;
create policy "discussion_messages_select_public" on public.discussion_messages
for select
using (
  exists (
    select 1
    from public.product_discussions d
    join public.products p on p.id = d.product_id
    where d.id = discussion_id
      and p.moderation_status = 'approved'
  )
  or exists (
    select 1
    from public.product_discussions d
    join public.products p on p.id = d.product_id
    join public.vendors v on v.id = p.vendor_id
    where d.id = discussion_id
      and v.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.role = 'admin'
  )
);

drop policy if exists "discussion_messages_insert_authenticated" on public.discussion_messages;
create policy "discussion_messages_insert_authenticated" on public.discussion_messages
for insert to authenticated
with check (
  author_user_id = auth.uid()
  and exists (
    select 1
    from public.product_discussions d
    join public.products p on p.id = d.product_id
    where d.id = discussion_id
      and d.is_locked = false
      and p.moderation_status = 'approved'
  )
);

create index if not exists idx_product_discussions_product_updated
  on public.product_discussions (product_id, is_pinned desc, updated_at desc);

create index if not exists idx_discussion_messages_discussion_created
  on public.discussion_messages (discussion_id, created_at asc);

create or replace function public.touch_product_discussion_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.product_discussions
  set updated_at = now()
  where id = new.discussion_id;

  return new;
end;
$$;

drop trigger if exists touch_product_discussion_updated_at_after_insert on public.discussion_messages;
create trigger touch_product_discussion_updated_at_after_insert
after insert on public.discussion_messages
for each row
execute procedure public.touch_product_discussion_updated_at();
