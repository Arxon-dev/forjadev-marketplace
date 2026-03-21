# Seller Product Operations

## Objetivo

La gestion avanzada de producto seller ya no depende solo del formulario general de ficha. Cada producto dispone ahora de un espacio operativo propio en `/seller/products/[id]`.

## Regla de negocio principal

- La ficha y la release ya no se consideran la misma operacion.
- La metadata del producto se edita en `/seller/products/[id]/edit`.
- Las releases se publican desde `/seller/products/[id]`.
- La release del buyer siempre es la `active`.
- Una release nueva nace como `pending` y no sustituye a la activa hasta aprobarse.

## Lifecycle de releases

- `pending`: subida nueva del seller en revision. Visible para seller y admin. No la descarga el buyer.
- `active`: release vigente del producto. Es la que usa la descarga buyer.
- `historical`: release previamente activa. Se conserva para trazabilidad y puede reactivarse como rollback.
- `retired`: release retirada del ciclo operativo. No se expone al buyer y no puede reactivarse.

## Guardrails

- Solo el owner seller del producto puede abrir `/seller/products/[id]` y `/seller/products/[id]/edit`.
- El flujo de release exige:
  - version no vacia
  - ZIP obligatorio
  - version unica por producto
  - una sola release `pending` por producto
  - una sola release `active` por producto
- Si falla la subida del ZIP o el registro del archivo:
  - se elimina el archivo ya subido si existe
  - se elimina la version creada para evitar releases huerfanas
- No se reemplaza un ZIP en sitio:
  - para corregir una `pending`, primero se retira y luego se sube otra
  - para rollback, se reactiva una `historical`
  - la `active` no se retira directamente; primero debe existir otra activa

## Alcance actual

- Vista operativa por producto
- Publicacion de releases con changelog y ZIP
- Historial de versiones y assets
- Estados `pending / active / historical / retired`
- Activacion de historicas y retirada segura de releases no activas
- Soporte accionable por producto en `/seller/products/[id]/support`
- Cola privada del producto con:
  - estado del ticket
  - prioridad
  - ultima actividad
  - quien espera respuesta
  - ultimo mensaje
  - continuidad al detalle del ticket con vuelta al workspace del producto
- Capa comercial por producto en `/seller/products/[id]/promotions`
- Gestion contextual de:
  - campanas del producto
  - cupones del producto
  - vigencia y estado comercial
  - impacto reciente basico del producto
  - continuidad con el workspace seller
- Continuidad postventa por producto dentro del workspace seller
- Lectura compacta de:
  - tickets esperando seller
  - disputas activas ligadas al producto
  - refunds emitidos
  - licencias revocadas
  - senales abiertas de riesgo postventa
- Capa compartida de inteligencia por producto para seller/admin
- Lectura accionable de:
  - traccion comercial reciente
  - conversion
  - ingresos
  - friccion operativa y riesgo
  - siguiente accion sugerida
- Mismo panel visible desde:
  - `/seller/products/[id]`
  - `/seller/products/[id]/support`
- La vista seller muestra senales operativas y no evidencia privada del buyer
- Resumen de revision y rendimiento de 30 dias

## Pendiente para una fase posterior

- eliminacion o reemplazo de releases
- aprobacion granular por release en cola admin dedicada
- descargas internas de assets para seller desde esta misma vista
- analitica comercial mas profunda por promo o cupon
