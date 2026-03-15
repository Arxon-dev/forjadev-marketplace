# ForjaDev Marketplace — Elite Implementation Plan (v3 final)

## Estado actual

- ✅ Next.js **16.1.6** + Tailwind v4
- ✅ 11 tablas en Supabase con RLS + políticas
- ✅ Supabase client/server + tipos TS
- ✅ Homepage conectada a Supabase
- ✅ Git + GitHub + CI básico

---

## Fase 1 — Auth SSR con `@supabase/ssr`

```bash
npm install @supabase/ssr
```

#### [MODIFY] [client.ts](file:///e:/Rust_Web/forjadev-marketplace/src/lib/supabase/client.ts)
- `createBrowserClient()` de `@supabase/ssr`

#### [MODIFY] [server.ts](file:///e:/Rust_Web/forjadev-marketplace/src/lib/supabase/server.ts)
- `createServerClient()` con `cookies()` — **solo lectura** en Server Components
- Escritura de cookies en Route Handlers y proxy

#### [NEW] `src/proxy.ts`
- Refresca tokens de sesión cada request
- Protege `/dashboard`, `/seller` → redirige a `/login`

#### [NEW] `src/app/auth/callback/route.ts`
- Intercambio de código → sesión (aquí sí se escriben cookies)

---

## Fase 2 — Registro / Login UI premium

#### [NEW] `src/components/auth/auth-form.tsx`
- Componente layout reutilizable (glassmorphism card)

#### [MODIFY] [register/page.tsx](file:///e:/Rust_Web/forjadev-marketplace/src/app/register/page.tsx)
- Formulario: email, username, contraseña, confirmar contraseña
- **Post-signup inteligente:**
  - Si email confirmation ON → pantalla "revisa tu correo" + link a login
  - Si confirmation OFF → redirect a `/dashboard` solo si sesión existe
  - Nunca asumir que hay sesión inmediata

#### [MODIFY] [login/page.tsx](file:///e:/Rust_Web/forjadev-marketplace/src/app/login/page.tsx)
- Email + contraseña → `signInWithPassword()` → redirect `/dashboard`

#### [MODIFY] [site-header.tsx](file:///e:/Rust_Web/forjadev-marketplace/src/components/layout/site-header.tsx)
- Avatar + nombre si hay sesión, botones auth si no, logout

---

## Fase 3 — Perfil automático via trigger

#### [NEW] `supabase/migrations/0002_auto_create_profile.sql`
- Trigger `AFTER INSERT ON auth.users`
- **Robustez:**
  - Copia `email` desde `new.email`
  - Extrae `username` y `display_name` de `new.raw_user_meta_data` si existen
  - Usa `COALESCE` para defaults si faltan metadatos
  - Nunca rompe si `raw_user_meta_data` es null o incompleto
  - Role por defecto: `'buyer'`

---

## Fase 4 — Panel vendedor conectado

#### [MODIFY] [dashboard/page.tsx](file:///e:/Rust_Web/forjadev-marketplace/src/app/dashboard/page.tsx)
- Panel comprador: mis descargas, perfil, datos de cuenta

#### [MODIFY] [seller/page.tsx](file:///e:/Rust_Web/forjadev-marketplace/src/app/seller/page.tsx)
- Listado de mis productos + stats
- Si `role !== 'seller'` → muestra **onboarding** en lugar de bloquear

#### [NEW] `src/app/seller/onboarding/page.tsx`
- Formulario "Solicitar cuenta de vendedor":
  - Nombre de tienda, slug, bio
  - Al completar: crea row en `vendors` + actualiza `profiles.role = 'seller'`
  - Redirect a `/seller` ya como vendedor

#### [NEW] `src/app/seller/new/page.tsx`
- Crear producto (título, descripción, precio, imagen, ZIP)

#### [NEW] `src/app/seller/[id]/edit/page.tsx`
- Editar producto existente

#### [NEW] `src/components/seller/product-form.tsx`
- Formulario reutilizable (shared new/edit)

#### [NEW] `src/components/seller/seller-stats.tsx`
- Stats: productos, descargas, ingresos

---

## Fase 5 — Storage (imágenes + ZIPs)

### Buckets (Supabase Dashboard)
- `product-images` — público, max 5MB
- `product-files` — privado, max 100MB, acceso solo via signed URL

#### [NEW] `supabase/migrations/0003_storage_policies.sql`
- `product-images`: lectura pública, escritura solo vendedores
- `product-files`: lectura bloqueada — solo via API route del servidor

#### [NEW] `src/lib/supabase/storage.ts`
- **Rutas estructuradas:** `{vendorId}/{productId}/{versionId}/{filename}`
- **Nombres únicos:** UUID prefix + nombre original sanitizado
- `uploadProductImage()`, `uploadProductFile()`, `getSignedDownloadUrl()`

#### [NEW] `src/components/ui/file-upload.tsx`
- Drag & drop con preview y progress bar
- **Validación doble (cliente + servidor):**
  - Cliente: MIME type, extensión, tamaño antes de subir
  - Servidor: re-validar MIME y tamaño al recibir

---

## Fase 6 — Protección real de descargas

#### [NEW] `src/app/api/download/[productId]/route.ts`
1. Verifica usuario autenticado via cookies
2. Consulta producto en DB
3. **Valida acceso completo:**
   - Producto `moderation_status === 'approved'` **O** usuario es vendedor/dueño **O** admin
   - Si producto de pago → verifica que exista order del usuario
   - Si gratuito → acceso directo
4. Genera signed URL temporal (60s) desde Storage
5. Registra en `public.downloads`
6. Retorna `{ url }` JSON

#### [MODIFY] Product detail page
- Botón "Descargar" → `/api/download/[id]`
- Sin auth → login, sin compra → precio

---

## Fase 7 — Deploy en Railway (sin Docker)

#### [MODIFY] [next.config.mjs](file:///e:/Rust_Web/forjadev-marketplace/next.config.mjs)
- `output: "standalone"`

#### [NEW] `railway.toml`
- Config básica (build/start commands)

#### Fix ESLint + CI (Next.js 16)

#### [MODIFY] [package.json](file:///e:/Rust_Web/forjadev-marketplace/package.json)
- `"lint": "eslint ."` (reemplaza `"next lint"`)
- `"build": "npm run lint && next build"`

#### [NEW] `eslint.config.mjs`
- Flat Config ESLint 9 + `eslint-config-next`

#### [MODIFY] [ci.yml](file:///e:/Rust_Web/forjadev-marketplace/.github/workflows/ci.yml)
- Lint: `npx eslint .`

---

## Verification Plan

| Fase | Test |
|------|------|
| 1-2 | Register → mensaje "revisa correo" o redirect según config. Login → header muestra usuario. `/seller` sin auth → `/login` |
| 3 | Registro nuevo usuario → `profiles` row automática con email + metadata |
| 4 | Buyer en `/seller` → ve onboarding. Completa → es seller. Crea producto → aparece en listado |
| 5 | Upload imagen → preview + URL en bucket. Upload ZIP → archivo en `product-files/{vendor}/{product}` |
| 6 | Descargar gratis aprobado → OK. Pago sin compra → bloqueado. Producto no aprobado → bloqueado (salvo dueño/admin) |
| 7 | Push a main → Railway deploya → sitio accesible |
