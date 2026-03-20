# AGENTS.md

## Proyecto
ForjaDev Marketplace

## Resumen operativo
ForjaDev Marketplace es un marketplace avanzado de recursos digitales para juegos, con foco inicial en Rust y arquitectura preparada para crecer hacia otros juegos y verticales.

El proyecto ya no debe tratarse como un MVP simple. El estado actual incluye, entre otras capas activas:

- catalogo publico y producto detallado
- checkout para productos y bundles
- ordenes, licencias, descargas y redescargas protegidas
- soporte buyer/seller y disputas
- seller workspace por producto
- lifecycle de releases `pending / active / historical / retired`
- promociones y cupones por producto
- editorial admin con previews y guardrails
- help center y policies publicas
- moderacion, auditoria y riesgo

## Fuente de verdad documental obligatoria
Antes de cualquier analisis, propuesta, implementacion, modificacion, refactor, generacion de archivos o decision tecnica, revisar y aplicar siempre la documentacion ubicada en:

`E:\Rust_Web\forjadev-marketplace\docs`

### Documentos obligatorios
- `E:\Rust_Web\forjadev-marketplace\docs\database.md`
- `E:\Rust_Web\forjadev-marketplace\docs\deployment.md`
- `E:\Rust_Web\forjadev-marketplace\docs\editorial_guardrails.md`
- `E:\Rust_Web\forjadev-marketplace\docs\phase_1_discovery_upgrade_plan.md`
- `E:\Rust_Web\forjadev-marketplace\docs\product-vision.md`
- `E:\Rust_Web\forjadev-marketplace\docs\routes.md`
- `E:\Rust_Web\forjadev-marketplace\docs\seller_product_operations.md`
- `E:\Rust_Web\forjadev-marketplace\docs\SEO.md`
- `E:\Rust_Web\forjadev-marketplace\docs\support_trust_architecture.md`
- `E:\Rust_Web\forjadev-marketplace\docs\verification.md`

## Comportamiento obligatorio
- Esta carpeta `/docs` es la base permanente del proyecto.
- No contradecir la documentacion.
- No asumir requisitos fuera de la documentacion sin indicarlo explicitamente.
- Si hay conflictos, lagunas o ambiguedades entre documentos, detener la propuesta y senalarlos primero.
- Toda implementacion debe respetar vision de producto, arquitectura, rutas, SEO, despliegue, operaciones seller, verificacion y guardrails editoriales.
- Toda nueva propuesta debe mantener coherencia con la fase actual del proyecto y con el roadmap existente.

## Prioridad en caso de conflicto
Si hubiera conflicto entre documentos, usar este orden de prioridad:

1. `product-vision.md`
2. `routes.md`
3. `database.md`
4. `seller_product_operations.md`
5. `SEO.md`
6. `support_trust_architecture.md`
7. `verification.md`
8. `deployment.md`
9. `editorial_guardrails.md`
10. `phase_1_discovery_upgrade_plan.md`

## Stack principal
- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase: Postgres, Auth, Storage, RLS
- Railway
- GitHub Actions

## Roles del producto
- `guest`
- `buyer`
- `seller`
- `admin`

## Principios de producto
- Marketplace first: el producto, la confianza y la capacidad operativa deben sentirse centrales.
- Buyer journey serio: comprar, acceder, descargar, redescargar y pedir soporte debe ser claro y fiable.
- Seller operations serias: publicar, versionar, mantener, soportar y promocionar un producto debe poder hacerse sin friccion innecesaria.
- Trust visible: policies, help center, licencias, soporte y moderacion deben reforzar la confianza del comprador.
- Seguridad por defecto: descargas, datos privados, panel admin y flujos seller deben estar protegidos por permisos reales.

## Reglas no negociables
- Usar TypeScript en toda la aplicacion.
- No meter logica de negocio importante dentro de componentes UI si puede vivir en helpers, actions, route handlers o modulos de dominio.
- Nunca exponer claves admin ni secretos en frontend.
- Tratar todo acceso a archivos como protegido por autorizacion real.
- Toda modificacion de base de datos debe representarse en `/supabase/migrations`.
- Toda feature importante debe revisar y actualizar la documentacion relevante en `/docs`.
- Toda ruta nueva debe comprobar impacto en `routes.md`, permisos, SEO y continuidad de producto.
- Toda regla nueva de seller, buyer o admin debe comprobar impacto en QA y verificacion.
- No cerrar tareas con soluciones parciales si rompen la vision global del marketplace.

## UX y calidad
- La UI debe sentirse premium, clara y operativa, no solo bonita.
- Buyer, seller y admin deben tener jerarquia visual coherente con su contexto.
- Los estados vacios, bloqueos, errores y permisos denegados son parte del producto, no un detalle secundario.
- Evitar clutter, duplicidad de flujos y pantallas desconectadas.
- Cualquier flujo importante debe dejar claro que paso acaba de ocurrir y cual es el siguiente paso natural.

## Modo de trabajo
- Antes de escribir codigo, validar alineacion con la documentacion.
- Antes de proponer cambios estructurales, revisar impacto en rutas, datos, SEO y operaciones seller.
- Mantener consistencia entre backend, frontend, producto y posicionamiento SEO.
- Si una decision tiene implicaciones no obvias, explicarlas antes de consolidarla.
- Preferir cambios incrementales, verificables y revisables.
- Si aparece una contradiccion entre codigo y documentacion, corregirla o dejarla senalada explicitamente.

## Flujo obligatorio para trabajo tecnico
1. Revisar `AGENTS.md`.
2. Revisar la documentacion obligatoria relevante en `/docs`.
3. Revisar rutas, datos, permisos y scripts existentes antes de asumir comportamiento.
4. Implementar con el menor cambio correcto que mantenga coherencia global.
5. Validar con `lint`, `build` y QA funcional cuando aplique.
6. Actualizar documentacion si cambia la arquitectura, el comportamiento o la fuente de verdad operativa.

## Skills del repositorio
Cuando el trabajo lo requiera, revisar la skill mas relevante dentro de `/skills`, incluyendo:

- `skill-product-manager.md`
- `skill-ui-design-system.md`
- `skill-auth-and-roles.md`
- `skill-products-and-files.md`
- `skill-orders-and-licenses.md`
- `skill-admin-moderation.md`
- `skill-supabase-db.md`
- `skill-railway-deploy.md`
- `skill-referencia-codefling.md`
- `skill-comportamiento.md`

## Convenciones
- `kebab-case` para rutas y archivos donde aplique en Next.js
- `PascalCase` para componentes React
- `camelCase` para variables y funciones
- `snake_case` para tablas SQL y columnas de base de datos

## Definition of done
Una tarea solo esta realmente terminada cuando:

- el codigo compila
- `lint` pasa
- el comportamiento respeta permisos y roles reales
- no rompe rutas, datos ni coherencia de producto
- la UI queda a la altura de la calidad esperada
- la documentacion relevante queda alineada si hubo cambio arquitectonico u operativo
- existe verificacion funcional reproducible cuando la criticidad del flujo lo requiere

## Regla final
ForjaDev no se construye como una suma de CRUDs aislados.
Cada cambio debe reforzar el marketplace como sistema coherente para buyer, seller y admin.
