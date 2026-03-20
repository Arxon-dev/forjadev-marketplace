-- Phase 9 foundation: public help center, marketplace policies and buyer trust content architecture.

create table if not exists public.help_center_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  icon text,
  sort_order integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.help_center_articles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.help_center_categories(id) on delete cascade,
  related_product_id uuid references public.products(id) on delete set null,
  article_type text not null default 'guide'
    check (article_type in ('guide', 'policy', 'faq', 'troubleshooting', 'post_sale')),
  audience text not null default 'buyer'
    check (audience in ('buyer', 'seller', 'shared')),
  slug text not null unique,
  title text not null,
  summary text,
  body text not null,
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_policy_pages (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null unique,
  title text not null,
  summary text,
  body text not null,
  audience text not null default 'shared'
    check (audience in ('buyer', 'seller', 'shared')),
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.help_center_categories enable row level security;
alter table public.help_center_articles enable row level security;
alter table public.marketplace_policy_pages enable row level security;

drop policy if exists "help_center_categories_select_public_or_admin" on public.help_center_categories;
create policy "help_center_categories_select_public_or_admin" on public.help_center_categories
for select
using (
  is_public = true
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "help_center_categories_admin_manage" on public.help_center_categories;
create policy "help_center_categories_admin_manage" on public.help_center_categories
for all to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "help_center_articles_select_published_or_admin" on public.help_center_articles;
create policy "help_center_articles_select_published_or_admin" on public.help_center_articles
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

drop policy if exists "help_center_articles_admin_manage" on public.help_center_articles;
create policy "help_center_articles_admin_manage" on public.help_center_articles
for all to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "marketplace_policy_pages_select_published_or_admin" on public.marketplace_policy_pages;
create policy "marketplace_policy_pages_select_published_or_admin" on public.marketplace_policy_pages
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

drop policy if exists "marketplace_policy_pages_admin_manage" on public.marketplace_policy_pages;
create policy "marketplace_policy_pages_admin_manage" on public.marketplace_policy_pages
for all to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

create index if not exists idx_help_center_categories_public_sort
  on public.help_center_categories (is_public, sort_order, title);

create index if not exists idx_help_center_articles_category_status_sort
  on public.help_center_articles (category_id, status, sort_order, published_at desc);

create index if not exists idx_help_center_articles_related_product
  on public.help_center_articles (related_product_id, status, published_at desc);

create index if not exists idx_marketplace_policy_pages_status_sort
  on public.marketplace_policy_pages (status, sort_order, published_at desc);

insert into public.help_center_categories (slug, title, description, icon, sort_order)
values
  ('compras-y-pagos', 'Compras y pagos', 'Checkout, acceso, errores de compra y facturacion.', 'credit-card', 10),
  ('descargas-y-licencias', 'Descargas y licencias', 'Acceso a archivos, re-descargas y validacion de licencias.', 'download', 20),
  ('soporte-y-postventa', 'Soporte y postventa', 'Como abrir tickets, tiempos de respuesta y escalado.', 'life-buoy', 30),
  ('vendedores-y-confianza', 'Vendedores y confianza', 'Politicas de tienda, reputacion, identidad y senales publicas.', 'shield-check', 40)
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.marketplace_policy_pages (policy_key, title, summary, body, audience, sort_order, published_at)
values
  (
    'compras-y-acceso',
    'Compras y acceso a productos',
    'Resume como se confirma una compra, cuando aparece en pedidos y como se obtiene acceso a la descarga.',
    'Una compra se considera efectiva cuando el pedido queda registrado y su estado final permite acceso al producto correspondiente.

Despues de una compra completada, el comprador debe poder encontrar el producto desde su historial de pedidos. Si el producto requiere licencia, la licencia emitida forma parte del acceso. Si el producto es gratuito, el acceso depende del flujo publico de descarga y del registro de biblioteca asociado a la cuenta.

El marketplace diferencia entre reglas globales y politicas especificas del seller. La entrega base, la aparicion del pedido y la disponibilidad del acceso son reglas del marketplace. En cambio, el alcance funcional del producto, el soporte que incluye y la frecuencia esperada de actualizaciones dependen de la ficha del seller.

Si un comprador no encuentra el acceso esperado, el primer paso correcto es revisar el pedido, la licencia y la ficha publica del producto. Si el problema persiste, debe abrir soporte sobre ese producto para que el seller responda dentro del flujo previsto.',
    'buyer',
    10,
    now()
  ),
  (
    'reembolsos-y-reclamaciones',
    'Reembolsos y reclamaciones',
    'Explica que casos se revisan, como se abre una disputa y que diferencia hay entre soporte y reclamacion.',
    'El soporte y la reclamacion no son el mismo flujo. El soporte sirve para resolver dudas, incidencias de instalacion, uso esperado o problemas que el seller puede atender directamente. La reclamacion o disputa entra en juego cuando existe un bloqueo que no se ha resuelto de forma razonable o cuando el caso requiere intervencion del marketplace.

Antes de escalar una disputa, el comprador debe revisar la politica publica del producto y abrir soporte si el seller aun puede dar una solucion operativa. La disputa se reserva para casos donde el acceso, la licencia, la entrega o la adecuacion del producto a su descripcion necesitan revision administrativa.

El marketplace revisa las disputas como casos independientes. Abrir una disputa no garantiza un reembolso automatico. La decision depende del historial del pedido, del estado de la licencia, de la informacion publicada en la ficha y del intercambio previo de soporte.',
    'buyer',
    20,
    now()
  ),
  (
    'licencias-y-validacion',
    'Licencias y validacion',
    'Aclara como funcionan las licencias, estados activos o revocados y su impacto en las descargas.',
    'Las licencias son la prueba operativa de acceso para los productos que las requieren. Una licencia activa permite validar la relacion entre una compra y el derecho de uso o descarga correspondiente. Una licencia revocada indica que el acceso asociado ya no debe tratarse como valido mientras mantenga ese estado.

El comprador puede consultar el estado de sus licencias desde su biblioteca privada. Si una licencia esta revocada, la descarga puede quedar bloqueada aunque el pedido siga existiendo en el historial. Esto evita confundir posesion historica de un pedido con acceso vigente al recurso.

Cuando exista una discrepancia entre el pedido, la licencia y la posibilidad real de descarga, el flujo correcto es revisar primero la ficha del producto y despues abrir soporte o disputa segun la naturaleza del problema.',
    'shared',
    30,
    now()
  ),
  (
    'soporte-del-marketplace',
    'Soporte del marketplace',
    'Detalla cuando usar tickets con seller y cuando escalar al marketplace.',
    'El soporte por producto pertenece al flujo normal de postventa del marketplace. El comprador abre un ticket sobre un producto concreto y el seller responde dentro del mismo hilo. Este flujo es el adecuado para resolver incidencias tecnicas, dudas funcionales, problemas de instalacion y preguntas ligadas al contenido real del producto.

El marketplace mantiene una capa de gobernanza sobre el sistema de soporte. Eso significa que el historial de tickets, los tiempos de respuesta y el estado de escalado forman parte de la operacion global de confianza, aunque la primera respuesta corresponda al seller.

Cuando un ticket no resuelve el problema o el caso exige una decision imparcial, el comprador puede pasar al flujo de disputa. Por eso soporte y reclamacion se diseñan como rutas conectadas pero no equivalentes.',
    'shared',
    40,
    now()
  ),
  (
    'confianza-y-seguridad',
    'Confianza y seguridad',
    'Describe senales publicas de reputacion, verificacion y seguridad operacional del marketplace.',
    'La confianza del marketplace no depende de una sola señal. ForjaDev combina reputacion publica del seller, actividad del catalogo, verificacion de identidad disponible, reglas visibles de compra, claridad de licencias y caminos de escalado reales para soporte y disputas.

En la ficha del producto y en el perfil del seller se publican señales pensadas para ayudar a comprar con criterio. Entre ellas se incluyen reputacion agregada, volumen de actividad, mantenimiento reciente y presencia de identidades vinculadas cuando proceda.

La seguridad operativa tambien exige separar bien lo publico y lo privado. Las rules del marketplace y las policies son publicas; en cambio, mensajes de soporte, licencias individuales y datos de compra permanecen protegidos dentro del area autenticada correspondiente.',
    'shared',
    50,
    now()
  )
on conflict (policy_key) do update
set
  title = excluded.title,
  summary = excluded.summary,
  body = excluded.body,
  audience = excluded.audience,
  sort_order = excluded.sort_order,
  published_at = excluded.published_at,
  updated_at = now();

insert into public.help_center_articles (
  category_id,
  article_type,
  audience,
  slug,
  title,
  summary,
  body,
  status,
  is_featured,
  sort_order,
  published_at
)
select
  c.id,
  seed.article_type,
  seed.audience,
  seed.slug,
  seed.title,
  seed.summary,
  seed.body,
  'published',
  seed.is_featured,
  seed.sort_order,
  now()
from (
  values
    (
      'compras-y-pagos',
      'guide',
      'buyer',
      'como-funciona-una-compra-en-forjadev',
      'Como funciona una compra en ForjaDev',
      'Explica el recorrido desde checkout hasta acceso al pedido y al producto.',
      'El flujo de compra del marketplace termina cuando el pedido queda registrado y el comprador puede volver a encontrarlo en su historial.

Tras confirmar una compra, revisa primero el pedido. Si el producto utiliza licencia, verifica tambien su estado en la biblioteca de licencias. La ficha del producto sigue siendo la referencia para soporte, actualizaciones y alcance del recurso comprado.

Si el pedido existe pero no puedes avanzar al siguiente paso natural, no intentes resolverlo a ciegas. Revisa las policies de compra y acceso y, si el bloqueo continua, abre soporte sobre ese producto para dejar trazabilidad desde el inicio.',
      true,
      10
    ),
    (
      'descargas-y-licencias',
      'post_sale',
      'buyer',
      'que-hacer-si-no-puedes-descargar',
      'Que hacer si no puedes descargar',
      'Checklist publico para entender si el bloqueo viene de la compra, la licencia o el archivo.',
      'Cuando una descarga falla, separa el problema en tres capas: acceso del pedido, estado de la licencia y disponibilidad real del archivo.

Primero confirma que el producto aparece en pedidos o biblioteca. Despues revisa si existe una licencia activa cuando el producto la requiere. Por ultimo, verifica si la ficha del producto muestra una version descargable disponible.

Si el bloqueo parece venir de licencia o acceso, usa la documentacion publica y luego abre soporte. Si el caso ya no puede resolverse de forma razonable, el siguiente paso correcto es una disputa, no un ticket duplicado.',
      true,
      20
    ),
    (
      'soporte-y-postventa',
      'troubleshooting',
      'shared',
      'cuando-abrir-soporte-y-cuando-escalar',
      'Cuando abrir soporte y cuando escalar',
      'Aclara la diferencia entre duda operativa, ticket de soporte y disputa administrativa.',
      'Usa soporte cuando el seller todavia puede ayudarte a resolver el problema de forma directa: instalacion, configuracion, uso esperado o validacion del alcance publicado.

Usa disputa cuando el problema ya no depende solo de una respuesta del seller o cuando necesitas que el marketplace revise el caso con criterio propio.

La idea central es evitar dos extremos: escalar demasiado pronto y bloquear la resolucion, o quedarse atrapado en un soporte sin salida. El marketplace serio define ambos caminos con fronteras claras.',
      true,
      30
    ),
    (
      'vendedores-y-confianza',
      'guide',
      'shared',
      'como-evaluar-la-confianza-de-un-seller',
      'Como evaluar la confianza de un seller',
      'Resume las senales publicas que deberian ayudarte a comprar con criterio.',
      'Antes de comprar, revisa no solo el precio. Mira tambien la claridad de la ficha, las politicas publicadas, las FAQs, la evidencia de mantenimiento y las señales de reputacion del seller.

Las tiendas mas confiables suelen combinar descripcion clara, historial de actividad, reglas de soporte explicitas y una capa visible de identidad o reputacion. Ninguna señal aislada basta por si sola; lo importante es la coherencia del conjunto.

La funcion del marketplace es hacer visibles esas señales para reducir compras a ciegas y mejorar la calidad de la decision.',
      false,
      40
    )
) as seed(category_slug, article_type, audience, slug, title, summary, body, is_featured, sort_order)
join public.help_center_categories c on c.slug = seed.category_slug
on conflict (slug) do update
set
  title = excluded.title,
  summary = excluded.summary,
  body = excluded.body,
  article_type = excluded.article_type,
  audience = excluded.audience,
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order,
  published_at = excluded.published_at,
  updated_at = now();
