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

---
