-- Lightweight marketplace discovery analytics.

create table if not exists public.marketplace_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  session_id text not null,
  event_name text not null,
  page_type text not null,
  entity_type text,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.marketplace_events enable row level security;

drop policy if exists "marketplace_events_none" on public.marketplace_events;
create policy "marketplace_events_none" on public.marketplace_events
for select to authenticated
using (false);

create index if not exists idx_marketplace_events_event_created_at
  on public.marketplace_events (event_name, created_at desc);

create index if not exists idx_marketplace_events_page_created_at
  on public.marketplace_events (page_type, created_at desc);

create index if not exists idx_marketplace_events_entity_created_at
  on public.marketplace_events (entity_type, entity_id, created_at desc);
