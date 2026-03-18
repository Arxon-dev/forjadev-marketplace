-- Phase 3 foundation: buyer-seller support tickets.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  buyer_user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  status text not null default 'waiting_seller'
    check (status in ('open', 'waiting_seller', 'waiting_buyer', 'closed')),
  priority text not null default 'normal'
    check (priority in ('normal', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "support_tickets_select_participants" on public.support_tickets;
create policy "support_tickets_select_participants" on public.support_tickets
for select to authenticated
using (
  buyer_user_id = auth.uid()
  or exists (
    select 1
    from public.vendors v
    where v.id = vendor_id
      and v.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "support_tickets_insert_buyer" on public.support_tickets;
create policy "support_tickets_insert_buyer" on public.support_tickets
for insert to authenticated
with check (buyer_user_id = auth.uid());

drop policy if exists "support_tickets_update_participants" on public.support_tickets;
create policy "support_tickets_update_participants" on public.support_tickets
for update to authenticated
using (
  buyer_user_id = auth.uid()
  or exists (
    select 1
    from public.vendors v
    where v.id = vendor_id
      and v.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "support_messages_select_participants" on public.support_messages;
create policy "support_messages_select_participants" on public.support_messages
for select to authenticated
using (
  exists (
    select 1
    from public.support_tickets t
    where t.id = ticket_id
      and (
        t.buyer_user_id = auth.uid()
        or exists (
          select 1
          from public.vendors v
          where v.id = t.vendor_id
            and v.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role = 'admin'
        )
      )
  )
);

drop policy if exists "support_messages_insert_participants" on public.support_messages;
create policy "support_messages_insert_participants" on public.support_messages
for insert to authenticated
with check (
  sender_user_id = auth.uid()
  and exists (
    select 1
    from public.support_tickets t
    where t.id = ticket_id
      and (
        t.buyer_user_id = auth.uid()
        or exists (
          select 1
          from public.vendors v
          where v.id = t.vendor_id
            and v.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role = 'admin'
        )
      )
  )
);

create index if not exists idx_support_tickets_buyer_updated
  on public.support_tickets (buyer_user_id, updated_at desc);

create index if not exists idx_support_tickets_vendor_updated
  on public.support_tickets (vendor_id, updated_at desc);

create index if not exists idx_support_messages_ticket_created
  on public.support_messages (ticket_id, created_at asc);

create or replace function public.touch_support_ticket_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_tickets
  set
    updated_at = now(),
    last_message_at = new.created_at
  where id = new.ticket_id;

  return new;
end;
$$;

drop trigger if exists touch_support_ticket_message_after_insert on public.support_messages;
create trigger touch_support_ticket_message_after_insert
after insert on public.support_messages
for each row
execute procedure public.touch_support_ticket_message();
