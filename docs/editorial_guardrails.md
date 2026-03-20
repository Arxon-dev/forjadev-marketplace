# Editorial Guardrails

## Preview Strategy
- Las previews editoriales viven bajo rutas admin dedicadas:
  - `/admin/editorial/categories/[id]/preview`
  - `/admin/editorial/articles/[id]/preview`
  - `/admin/editorial/policies/[id]/preview`
- Solo `admin` autenticado puede abrirlas.
- No usan rutas publicas ni query params de preview compartibles.
- La composicion visual reutiliza la misma estructura base de las paginas publicas para evitar divergencia entre preview y produccion.

## Editorial States
- `draft`: visible solo para admin y disponible en preview.
- `published`: visible en la capa publica.
- `archived`: fuera de la capa publica, pero conservado para trazabilidad interna y preview admin.
- `help_center_categories.is_public` queda como campo legacy temporal. La fuente de verdad editorial pasa a ser `status`.

## Published Slug Policy
- Los identificadores publicos de contenido vivo son estables.
- No se permite cambiar:
  - `help_center_categories.slug`
  - `help_center_articles.slug`
  - `marketplace_policy_pages.policy_key`
  mientras el contenido siga `published`.
- Si hace falta renombrar contenido publicado, primero debe retirarse a `draft` o `archived`.
- Esta restriccion evita enlaces rotos desde help, producto, footer, ordenes, licencias y futura indexacion.

## Public Visibility Rules
- Solo contenido `published` se sirve en:
  - `/help`
  - `/help/[categorySlug]`
  - `/help/article/[slug]`
  - `/policies`
  - `/policies/[policyKey]`
- Un draft o archived nunca debe aparecer en la capa publica aunque exista preview admin.

## QA Workflow
- Ejecutar `npm run verify:editorial-guardrails` con la app disponible localmente.
- La verificacion cubre:
  - acceso anonimo bloqueado
  - acceso buyer no admin bloqueado
  - acceso admin permitido
  - preview admin funcional
  - drafts no publicos
  - slugs publicados bloqueados
