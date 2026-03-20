-- Phase 9.2: align help center categories with the editorial state model.

alter table public.help_center_categories
  add column if not exists status text;

update public.help_center_categories
set status = case when is_public then 'published' else 'draft' end
where true;

alter table public.help_center_categories
  alter column status set default 'published';

update public.help_center_categories
set status = 'published'
where status is null;

alter table public.help_center_categories
  alter column status set not null;

alter table public.help_center_categories
  drop constraint if exists help_center_categories_status_check;

alter table public.help_center_categories
  add constraint help_center_categories_status_check
    check (status in ('draft', 'published', 'archived'));

comment on column public.help_center_categories.is_public is
  'Deprecated in favor of status. Kept temporarily for backward compatibility while editorial state rollout is completed.';

drop policy if exists "help_center_categories_select_public_or_admin" on public.help_center_categories;
create policy "help_center_categories_select_public_or_admin" on public.help_center_categories
for select
using (
  status = 'published'
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

create index if not exists idx_help_center_categories_status_sort
  on public.help_center_categories (status, sort_order, title);
