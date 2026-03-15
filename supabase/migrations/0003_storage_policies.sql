-- Fase 5: Políticas de Storage para imágenes y archivos de productos

-- Crear bucket para imágenes de productos (público)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Crear bucket para archivos de productos (privado)
insert into storage.buckets (id, name, public)
values ('product-files', 'product-files', false)
on conflict (id) do nothing;

-- Política para product-images: lectura pública
create policy "product_images_public_read"
on storage.objects for select
using (bucket_id = 'product-images');

-- Política para product-images: escritura solo por vendedores autenticados
create policy "product_images_vendor_write"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images' and
  exists (
    select 1 from public.vendors v
    join public.profiles p on p.id = v.user_id
    where p.role = 'seller' and p.id = auth.uid()
  )
);

-- Política para product-images: actualización solo por vendedores
create policy "product_images_vendor_update"
on storage.objects for update to authenticated
using (bucket_id = 'product-images')
with check (
  exists (
    select 1 from public.vendors v
    join public.profiles p on p.id = v.user_id
    where p.role = 'seller' and p.id = auth.uid()
  )
);

-- Política para product-images: eliminación solo por vendedores
create policy "product_images_vendor_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images' and
  exists (
    select 1 from public.vendors v
    join public.profiles p on p.id = v.user_id
    where p.role = 'seller' and p.id = auth.uid()
  )
);

-- Política para product-files: lectura bloqueada directamente
-- Solo accesible vía signed URLs generadas por la API
create policy "product_files_no_direct_read"
on storage.objects for select
using (bucket_id = 'product-files' and false);

-- Política para product-files: escritura solo por vendedores
create policy "product_files_vendor_write"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-files' and
  exists (
    select 1 from public.vendors v
    join public.profiles p on p.id = v.user_id
    where p.role = 'seller' and p.id = auth.uid()
  )
);

-- Política para product-files: actualización solo por vendedores
create policy "product_files_vendor_update"
on storage.objects for update to authenticated
using (bucket_id = 'product-files')
with check (
  exists (
    select 1 from public.vendors v
    join public.profiles p on p.id = v.user_id
    where p.role = 'seller' and p.id = auth.uid()
  )
);

-- Política para product-files: eliminación solo por vendedores
create policy "product_files_vendor_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-files' and
  exists (
    select 1 from public.vendors v
    join public.profiles p on p.id = v.user_id
    where p.role = 'seller' and p.id = auth.uid()
  )
);
