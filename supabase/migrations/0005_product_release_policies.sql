-- Fase siguiente: permitir que el seller gestione versiones y archivos de sus productos

drop policy if exists "product_versions_insert_own" on public.product_versions;
create policy "product_versions_insert_own" on public.product_versions
for insert to authenticated
with check (
  exists (
    select 1
    from public.products p
    join public.vendors v on v.id = p.vendor_id
    where p.id = product_id and v.user_id = auth.uid()
  )
);

drop policy if exists "product_files_insert_own" on public.product_files;
create policy "product_files_insert_own" on public.product_files
for insert to authenticated
with check (
  exists (
    select 1
    from public.product_versions pv
    join public.products p on p.id = pv.product_id
    join public.vendors v on v.id = p.vendor_id
    where pv.id = product_version_id and v.user_id = auth.uid()
  )
);
