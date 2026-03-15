-- Fase 6: Políticas necesarias para descargas protegidas

drop policy if exists "products_select_owner_or_admin" on public.products;
create policy "products_select_owner_or_admin" on public.products
for select to authenticated
using (
  moderation_status = 'approved'
  or exists (
    select 1 from public.vendors v
    where v.id = vendor_id and v.user_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "product_versions_select_owner_or_admin" on public.product_versions;
create policy "product_versions_select_owner_or_admin" on public.product_versions
for select to authenticated
using (
  exists (
    select 1
    from public.products pr
    join public.vendors v on v.id = pr.vendor_id
    where pr.id = product_id and v.user_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "product_files_select_owner_or_admin" on public.product_files;
create policy "product_files_select_owner_or_admin" on public.product_files
for select to authenticated
using (
  exists (
    select 1
    from public.product_versions pv
    join public.products pr on pr.id = pv.product_id
    join public.vendors v on v.id = pr.vendor_id
    where pv.id = product_version_id and v.user_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "downloads_insert_own" on public.downloads;
create policy "downloads_insert_own" on public.downloads
for insert to authenticated
with check (user_id = auth.uid());
