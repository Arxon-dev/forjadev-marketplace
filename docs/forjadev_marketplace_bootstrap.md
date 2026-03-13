# ForjaDev Marketplace — arranque guiado paso a paso

## Objetivo
Crear la base de una aplicación web tipo marketplace de plugins/mapas/herramientas para juegos, usando:
- GitHub
- Railway
- Supabase
- IDE con IA
- sistema de `AGENTS.md` + `skills`

Este documento está pensado para alguien que quiere seguir pasos exactos, sin asumir conocimientos previos.

---

## 1) Estructura que vamos a crear

```text
forjadev-marketplace/
├─ .github/
│  └─ workflows/
│     └─ ci.yml
├─ .vscode/
│  └─ extensions.json
├─ docs/
│  ├─ product-vision.md
│  ├─ routes.md
│  ├─ database.md
│  └─ deployment.md
├─ skills/
│  ├─ skill-product-manager.md
│  ├─ skill-ui-design-system.md
│  ├─ skill-auth-and-roles.md
│  ├─ skill-products-and-files.md
│  ├─ skill-orders-and-licenses.md
│  ├─ skill-admin-moderation.md
│  ├─ skill-supabase-db.md
│  └─ skill-railway-deploy.md
├─ supabase/
│  └─ migrations/
│     └─ 0001_initial_schema.sql
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx
│  │  ├─ globals.css
│  │  ├─ login/
│  │  │  └─ page.tsx
│  │  ├─ register/
│  │  │  └─ page.tsx
│  │  ├─ dashboard/
│  │  │  └─ page.tsx
│  │  ├─ products/
│  │  │  ├─ page.tsx
│  │  │  └─ [slug]/
│  │  │     └─ page.tsx
│  │  └─ seller/
│  │     └─ page.tsx
│  ├─ components/
│  │  ├─ ui/
│  │  │  ├─ button.tsx
│  │  │  ├─ card.tsx
│  │  │  └─ badge.tsx
│  │  ├─ layout/
│  │  │  ├─ site-header.tsx
│  │  │  ├─ site-footer.tsx
│  │  │  └─ sidebar.tsx
│  │  └─ marketplace/
│  │     ├─ hero.tsx
│  │     ├─ product-card.tsx
│  │     └─ section-title.tsx
│  ├─ lib/
│  │  ├─ cn.ts
│  │  ├─ supabase/
│  │  │  ├─ client.ts
│  │  │  └─ server.ts
│  │  └─ constants.ts
│  └─ types/
│     └─ database.ts
├─ .env.example
├─ .gitignore
├─ AGENTS.md
├─ components.json
├─ next.config.ts
├─ package.json
├─ postcss.config.js
├─ tailwind.config.ts
├─ tsconfig.json
└─ README.md
```

---

## 2) AGENTS.md (archivo raíz principal)

Crea un archivo en la raíz llamado exactamente:

`AGENTS.md`

Pega dentro esto:

```md
# AGENTS.md — ForjaDev Marketplace

## Product summary
This project is a web marketplace for game server plugins, custom maps, tools, assets and server-management resources.
The first target niche is Rust, but the codebase must be prepared to support more games later.

## Primary stack
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Postgres, Auth, Storage, RLS)
- Railway (deployment)
- GitHub (version control + Actions)

## Product goals
1. Allow creators to publish free and paid digital products.
2. Allow users to browse, buy, download and review products.
3. Allow admins to review and moderate listings.
4. Keep security strong around access to downloads and private seller/admin data.

## Non-negotiable rules
- Use feature-based organization where reasonable.
- Use TypeScript everywhere.
- No business logic directly inside UI components when it can be moved to helpers/actions.
- Keep components small and reusable.
- Never expose admin keys in the frontend.
- Treat all file access as protected by authorization checks.
- All database changes must be represented as SQL migrations in `/supabase/migrations`.
- All major new features must update the relevant docs in `/docs`.

## UX principles
- Clean, premium, dark-first interface.
- Clear visual hierarchy.
- Marketplace first: products must always feel central.
- Admin pages should be efficient, dense and practical.
- Seller pages should feel like a professional dashboard.
- Avoid clutter and avoid excessive animations.

## Core user roles
- guest
- buyer
- seller
- admin

## MVP features
- Authentication
- Public product catalogue
- Product detail page
- Seller dashboard
- Product submission form
- Product versioning
- Orders
- Download access control
- Reviews
- Admin moderation

## Design language
Use the design system and tokens defined by `skills/skill-ui-design-system.md`.

## Workflow for the AI IDE
When implementing work:
1. Read this AGENTS.md first.
2. Read the most relevant file inside `/skills` for the requested task.
3. Respect the architecture and naming conventions.
4. Before editing database logic, read `/docs/database.md` and existing migrations.
5. Prefer incremental, reviewable changes.

## Naming conventions
- kebab-case for folders/files where standard in Next.js app routes
- PascalCase for React component names
- camelCase for variables and functions
- SQL table names in snake_case

## Definition of done
A task is done only when:
- code compiles
- lint passes
- the UI matches the intended design quality
- auth/permissions are respected
- docs are updated if architecture changed
```

---

## 3) Skills que debes crear

### 3.1 skill-product-manager.md
Crea el archivo:

`skills/skill-product-manager.md`

Pega esto:

```md
# Skill: Product Manager

## Purpose
Keep the marketplace aligned with the business goal: publish, discover, buy, download and manage digital products.

## Scope
- product catalogue
- product detail pages
- search and filtering
- seller dashboard flows
- review submission flow
- version/changelog UX

## Rules
- Every feature must support both free and paid products unless explicitly excluded.
- Rust is the initial niche, but avoid hard-coding game-specific logic where not needed.
- Product pages must clearly show title, category, creator, price, compatibility, media, description, changelog and reviews.
- Every seller-facing flow should minimize friction.

## Output style
When asked to build a feature, produce:
1. brief feature summary
2. route/files to create
3. database impact
4. UI components needed
5. step-by-step implementation
```

### 3.2 skill-ui-design-system.md
Crea el archivo:

`skills/skill-ui-design-system.md`

Pega esto:

```md
# Skill: UI Design System

## Goal
Create a premium marketplace UI that feels modern, dark, clean and trustworthy.

## Visual direction
- dark-first
- premium SaaS / marketplace aesthetic
- strong spacing
- rounded cards
- subtle borders
- restrained glow usage
- clear hierarchy
- desktop-first but responsive

## Brand personality
- professional
- technical
- premium
- gamer/dev friendly
- efficient, not flashy

## Color tokens
Use these CSS variables and keep them consistent:
- background: #0B1020
- background-soft: #12192B
- surface: #111827
- surface-2: #172033
- text: #F3F4F6
- text-soft: #AAB4C5
- primary: #5B8CFF
- primary-hover: #7AA2FF
- accent: #7C3AED
- success: #10B981
- warning: #F59E0B
- danger: #EF4444
- border: rgba(255,255,255,0.08)

## Typography
- Inter or Geist Sans style
- big bold headings
- readable body text
- avoid tiny low-contrast text

## Components rules
### Buttons
- Primary: filled, high contrast, medium-large radius
- Secondary: subtle background, bordered
- Ghost: transparent, used sparingly
- Danger: only for destructive actions

### Cards
- rounded-2xl
- subtle border
- soft shadow
- slightly brighter hover state

### Inputs
- dark surface
- clear focus ring in primary color
- visible labels
- supportive helper/error text

### Navigation
- top header for public marketplace
- left sidebar for seller/admin dashboards
- mobile menu must be simple and collapsible

## Layout rules
- max width containers on public pages
- dashboard grid with left navigation + content panel
- plenty of spacing between sections
- use section titles with small descriptive text

## Product card requirements
- thumbnail
- title
- author
- category
- price/free badge
- rating placeholder
- compatibility/version snippet

## Product detail page sections
- hero header
- gallery/media
- buy/download card
- description
- changelog
- compatibility
- reviews
- related products

## Do not
- do not use neon everywhere
- do not over-animate
- do not mix many accent colors
- do not create cluttered dashboards
```

### 3.3 skill-auth-and-roles.md
Crea el archivo:

`skills/skill-auth-and-roles.md`

Pega esto:

```md
# Skill: Auth and Roles

## Goal
Implement secure authentication and role-aware access using Supabase Auth and database roles.

## Roles
- buyer
- seller
- admin

## Rules
- Never trust client-only role checks.
- Store role information in the database.
- Protect dashboard routes.
- Protect seller-only actions.
- Protect admin-only moderation pages.
```

### 3.4 skill-products-and-files.md
Crea el archivo:

`skills/skill-products-and-files.md`

Pega esto:

```md
# Skill: Products and Files

## Goal
Create product creation/editing, image uploads, version uploads and secure file delivery.

## Rules
- Product files must not be exposed publicly by default.
- Images may be public if intended for catalogue browsing.
- ZIP/resource downloads must be gated by ownership or permissions.
- Each released file should belong to a product version.
```

### 3.5 skill-orders-and-licenses.md
Crea el archivo:

`skills/skill-orders-and-licenses.md`

Pega esto:

```md
# Skill: Orders and Licenses

## Goal
Handle free and paid acquisition flows for digital products.

## Rules
- Support free checkout and paid checkout architecture.
- Keep an order history for each user.
- Link downloads to purchased or owned products.
- Prepare schema for future license keys even if v1 is simple.
```

### 3.6 skill-admin-moderation.md
Crea el archivo:

`skills/skill-admin-moderation.md`

Pega esto:

```md
# Skill: Admin Moderation

## Goal
Allow admins to review, approve, reject, hide and manage listings.

## Rules
- Every product has a moderation status.
- Rejections should store a reason.
- Hidden products should not appear in the public marketplace.
- Keep audit trails for important admin actions.
```

### 3.7 skill-supabase-db.md
Crea el archivo:

`skills/skill-supabase-db.md`

Pega esto:

```md
# Skill: Supabase DB

## Goal
Design a normalized schema with strong RLS and migration-first workflow.

## Rules
- Create SQL migrations for every schema change.
- Enable RLS on user-owned tables.
- Write policies explicitly.
- Prefer append-only audit logs for critical actions.
- Separate public product visibility from private seller/admin data.
```

### 3.8 skill-railway-deploy.md
Crea el archivo:

`skills/skill-railway-deploy.md`

Pega esto:

```md
# Skill: Railway Deploy

## Goal
Keep deployment simple, reproducible and environment-aware.

## Rules
- Use Railway environments for staging and production.
- Keep secrets out of code.
- Use GitHub Actions for CI before production deploy.
- Document required env vars in `.env.example`.
```

---

## 4) Documentos internos del proyecto

### docs/product-vision.md
```md
# Product Vision

## Initial product
A marketplace where creators can publish Rust plugins, maps and server tools.

## Long-term vision
Expand to more games and categories.

## Marketplace pillars
- discoverability
- trust
- secure downloads
- creator monetization
- moderation quality
```

### docs/routes.md
```md
# Routes

## Public
- /
- /products
- /products/[slug]
- /login
- /register

## Authenticated
- /dashboard
- /seller

## Future
- /admin
- /checkout
- /orders
- /account
- /support
```

### docs/database.md
```md
# Database Overview

## Core tables
- profiles
- vendors
- products
- product_versions
- product_files
- categories
- reviews
- orders
- order_items
- downloads
- audit_logs

## Security notes
- RLS on all user-owned tables
- public catalogue data separated from restricted data where helpful
- secure file access checks for downloads
```

### docs/deployment.md
```md
# Deployment

## Providers
- GitHub for source control and CI
- Supabase for database/auth/storage
- Railway for app deployment

## Environments
- staging
- production

## Notes
- all required variables must exist in Railway
- CI should pass before production deployment
```

---

## 5) Schema SQL inicial

Crea el archivo:

`supabase/migrations/0001_initial_schema.sql`

Pega esto:

```sql
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  username text unique,
  display_name text,
  avatar_url text,
  role text not null default 'buyer' check (role in ('buyer','seller','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  store_name text not null,
  slug text not null unique,
  bio text,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  slug text not null unique,
  short_description text,
  description text,
  price_cents integer not null default 0,
  currency text not null default 'EUR',
  is_free boolean not null default true,
  moderation_status text not null default 'draft' check (moderation_status in ('draft','pending','approved','rejected','hidden')),
  compatibility text,
  featured_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  version text not null,
  changelog text,
  created_at timestamptz not null default now()
);

create table if not exists public.product_files (
  id uuid primary key default gen_random_uuid(),
  product_version_id uuid not null references public.product_versions(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size_bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  total_cents integer not null default 0,
  currency text not null default 'EUR',
  status text not null default 'completed' check (status in ('pending','completed','failed','refunded')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  price_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  downloaded_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.vendors enable row level security;
alter table public.products enable row level security;
alter table public.product_versions enable row level security;
alter table public.product_files enable row level security;
alter table public.reviews enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.downloads enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_own" on public.profiles
for select to authenticated
using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
for update to authenticated
using (auth.uid() = id);

create policy "vendors_select_public" on public.vendors
for select to authenticated, anon
using (true);

create policy "vendors_insert_own" on public.vendors
for insert to authenticated
with check (user_id = auth.uid());

create policy "vendors_update_own" on public.vendors
for update to authenticated
using (user_id = auth.uid());

create policy "products_select_public_approved" on public.products
for select to authenticated, anon
using (moderation_status = 'approved');

create policy "products_insert_seller" on public.products
for insert to authenticated
with check (
  exists (
    select 1 from public.vendors v
    where v.id = vendor_id and v.user_id = auth.uid()
  )
);

create policy "products_update_own" on public.products
for update to authenticated
using (
  exists (
    select 1 from public.vendors v
    where v.id = vendor_id and v.user_id = auth.uid()
  )
);

create policy "product_versions_select_public_via_product" on public.product_versions
for select to authenticated, anon
using (
  exists (
    select 1 from public.products p
    where p.id = product_id and p.moderation_status = 'approved'
  )
);

create policy "product_files_no_public_select" on public.product_files
for select to authenticated
using (false);

create policy "reviews_select_public" on public.reviews
for select to authenticated, anon
using (true);

create policy "reviews_insert_authenticated" on public.reviews
for insert to authenticated
with check (user_id = auth.uid());

create policy "orders_select_own" on public.orders
for select to authenticated
using (user_id = auth.uid());

create policy "order_items_select_own" on public.order_items
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.user_id = auth.uid()
  )
);

create policy "downloads_select_own" on public.downloads
for select to authenticated
using (user_id = auth.uid());

create policy "audit_logs_none" on public.audit_logs
for select to authenticated
using (false);
```

---

## 6) Archivos base del proyecto Next.js

### package.json
```json
{
  "name": "forjadev-marketplace",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@supabase/supabase-js": "latest",
    "clsx": "latest",
    "lucide-react": "latest",
    "next": "latest",
    "react": "latest",
    "react-dom": "latest",
    "tailwind-merge": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "autoprefixer": "latest",
    "eslint": "latest",
    "eslint-config-next": "latest",
    "postcss": "latest",
    "tailwindcss": "latest",
    "typescript": "latest"
  }
}
```

### .env.example
```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### .gitignore
```gitignore
node_modules
.next
.env
.env.local
.DS_Store
```

### README.md
```md
# ForjaDev Marketplace

Marketplace web para plugins, mapas y herramientas digitales.

## Stack
- Next.js
- Supabase
- Railway
- GitHub
```

### src/lib/cn.ts
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## 7) Sistema visual base

### src/app/globals.css
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #0b1020;
  --background-soft: #12192b;
  --surface: #111827;
  --surface-2: #172033;
  --text: #f3f4f6;
  --text-soft: #aab4c5;
  --primary: #5b8cff;
  --primary-hover: #7aa2ff;
  --accent: #7c3aed;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --border: rgba(255, 255, 255, 0.08);
}

html, body {
  background: var(--background);
  color: var(--text);
}

body {
  min-height: 100vh;
}

.container-shell {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 20px;
}
```

### src/components/ui/button.tsx
```tsx
import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className, ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
        variant === "primary" && "bg-[var(--primary)] text-white hover:opacity-95",
        variant === "secondary" && "border border-white/10 bg-white/5 text-white hover:bg-white/10",
        variant === "ghost" && "bg-transparent text-white hover:bg-white/5",
        variant === "danger" && "bg-[var(--danger)] text-white hover:opacity-95",
        className
      )}
      {...props}
    />
  );
}
```

### src/components/ui/card.tsx
```tsx
import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]",
        className
      )}
      {...props}
    />
  );
}
```

### src/components/ui/badge.tsx
```tsx
import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[var(--text-soft)]",
        className
      )}
      {...props}
    />
  );
}
```

---

## 8) Layout y páginas iniciales

### src/app/layout.tsx
```tsx
import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "ForjaDev Marketplace",
  description: "Marketplace de plugins, mapas y herramientas digitales"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
```

### src/components/layout/site-header.tsx
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-white/5 backdrop-blur">
      <div className="container-shell flex h-16 items-center justify-between">
        <Link href="/" className="text-lg font-bold text-white">
          ForjaDev
        </Link>

        <nav className="hidden gap-6 md:flex">
          <Link href="/products" className="text-sm text-[var(--text-soft)] hover:text-white">
            Productos
          </Link>
          <Link href="/seller" className="text-sm text-[var(--text-soft)] hover:text-white">
            Vender
          </Link>
          <Link href="/dashboard" className="text-sm text-[var(--text-soft)] hover:text-white">
            Dashboard
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost">Entrar</Button>
          </Link>
          <Link href="/register">
            <Button>Crear cuenta</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
```

### src/components/marketplace/hero.tsx
```tsx
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="container-shell py-20">
      <div className="max-w-3xl">
        <p className="mb-4 text-sm font-medium text-[var(--primary)]">
          Marketplace premium para creadores
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white md:text-6xl">
          Publica, vende y descarga plugins, mapas y herramientas para servidores.
        </h1>
        <p className="mt-6 max-w-2xl text-base text-[var(--text-soft)] md:text-lg">
          Empieza con Rust y prepara la plataforma para escalar a más juegos y categorías.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button>Explorar productos</Button>
          <Button variant="secondary">Quiero vender</Button>
        </div>
      </div>
    </section>
  );
}
```

### src/components/marketplace/product-card.tsx
```tsx
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProductCardProps {
  title: string;
  author: string;
  category: string;
  price: string;
  compatibility: string;
}

export function ProductCard({ title, author, category, price, compatibility }: ProductCardProps) {
  return (
    <Card className="overflow-hidden p-4 hover:bg-white/[0.07]">
      <div className="mb-4 aspect-[16/9] rounded-xl bg-white/5" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-[var(--text-soft)]">por {author}</p>
        </div>
        <Badge>{price}</Badge>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Badge>{category}</Badge>
        <Badge>{compatibility}</Badge>
      </div>
    </Card>
  );
}
```

### src/app/page.tsx
```tsx
import { SiteHeader } from "@/components/layout/site-header";
import { Hero } from "@/components/marketplace/hero";
import { ProductCard } from "@/components/marketplace/product-card";

export default function HomePage() {
  return (
    <main>
      <SiteHeader />
      <Hero />

      <section className="container-shell pb-20">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Productos destacados</h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Una vista previa del catálogo inicial.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <ProductCard title="Elite Raid Controller" author="Elite" category="Plugin" price="€24.99" compatibility="Rust" />
          <ProductCard title="Custom Desert Arena" author="MapForge" category="Mapa" price="Gratis" compatibility="Rust" />
          <ProductCard title="Admin Toolkit Pro" author="ForjaDev" category="Herramienta" price="€14.99" compatibility="Rust" />
        </div>
      </section>
    </main>
  );
}
```

### src/app/products/page.tsx
```tsx
import { SiteHeader } from "@/components/layout/site-header";

export default function ProductsPage() {
  return (
    <main>
      <SiteHeader />
      <section className="container-shell py-16">
        <h1 className="text-3xl font-bold text-white">Productos</h1>
        <p className="mt-3 text-[var(--text-soft)]">
          Aquí irá el listado completo con filtros, búsqueda y categorías.
        </p>
      </section>
    </main>
  );
}
```

### src/app/products/[slug]/page.tsx
```tsx
interface Props {
  params: { slug: string };
}

export default function ProductDetailPage({ params }: Props) {
  return (
    <main className="container-shell py-16">
      <h1 className="text-3xl font-bold text-white">Producto: {params.slug}</h1>
      <p className="mt-3 text-[var(--text-soft)]">
        Aquí irá la ficha completa del producto.
      </p>
    </main>
  );
}
```

### src/app/login/page.tsx
```tsx
export default function LoginPage() {
  return (
    <main className="container-shell py-16">
      <h1 className="text-3xl font-bold text-white">Entrar</h1>
    </main>
  );
}
```

### src/app/register/page.tsx
```tsx
export default function RegisterPage() {
  return (
    <main className="container-shell py-16">
      <h1 className="text-3xl font-bold text-white">Crear cuenta</h1>
    </main>
  );
}
```

### src/app/dashboard/page.tsx
```tsx
export default function DashboardPage() {
  return (
    <main className="container-shell py-16">
      <h1 className="text-3xl font-bold text-white">Dashboard</h1>
    </main>
  );
}
```

### src/app/seller/page.tsx
```tsx
export default function SellerPage() {
  return (
    <main className="container-shell py-16">
      <h1 className="text-3xl font-bold text-white">Área de vendedor</h1>
    </main>
  );
}
```

---

## 9) CI básico

Crea el archivo:

`.github/workflows/ci.yml`

Pega esto:

```yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm install

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build
```

---

## 10) Orden exacto de trabajo para el usuario

1. Crea una carpeta en tu ordenador llamada `forjadev-marketplace`.
2. Abre esa carpeta con tu IDE con IA.
3. Crea la estructura de carpetas exactamente como aparece en este documento.
4. Crea el archivo `AGENTS.md` y pega su contenido.
5. Crea la carpeta `skills` y pega todos los archivos skill.
6. Crea la carpeta `docs` y pega los documentos.
7. Crea `package.json`, `.env.example`, `.gitignore`, `README.md`.
8. Crea los archivos base de `src`.
9. Crea el SQL inicial en `supabase/migrations/0001_initial_schema.sql`.
10. Ejecuta `npm install`.
11. Ejecuta `npm run dev`.
12. Sube todo a GitHub.
13. Crea proyecto en Supabase.
14. Crea proyecto en Railway.
15. Añade variables de entorno.

---

## 11) Qué haremos después

Después de este arranque, el siguiente bloque será:
1. conectar Supabase de verdad
2. crear login/registro real
3. crear perfiles y roles
4. crear dashboard vendedor
5. crear formulario de alta de producto
6. crear subida de imágenes y ZIPs
7. crear moderación admin
8. preparar checkout

---

## 12) Nota de seguridad

- No pongas `SUPABASE_SERVICE_ROLE_KEY` en el frontend.
- Los archivos ZIP no deben ser públicos por defecto.
- Las policies RLS deben revisarse en cada iteración.
- El admin debe tener rutas separadas y protegidas.

