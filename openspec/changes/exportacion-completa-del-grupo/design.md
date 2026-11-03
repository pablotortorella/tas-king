## Context

Ver `proposal.md` para el motivo. Estado verificado en `main` (1553229):

- `exportLedger` (`apps/app/src/ledger.js`) arma el JSON en memoria con `readLedger` más consultas a `entry_revisions`, `ledger_events`, `splitwise_import_batches` e `import_source_rows`, respetando lo oculto (lotes sin publicar). `schemaVersion: 3`. No incluye saldos ni nada de `groups`, `memberships`, `invitations`, `platform_audit_events`, `person_merges` o `recategorization_*`.
- `ledgerCsv` (`ledger-ui.js`) escribe una fila por efecto de la versión vigente, con BOM, comillas y protección contra fórmulas (`'` delante de `= + @ -`). Columnas: `id, fecha, tipo, descripcion, nota, moneda, total_menor, estado, revision, participante_id, efecto_menor, origen, lote, fila_origen, categoria, forma_pago`.
- Las rutas son `GET /groups/:groupId/ledger/export.json|csv`, abiertas a cualquier integrante; responden `Cache-Control: private, no-store` y `Content-Disposition` con nombre fijo. No dejan registro de la exportación y los GET no pasan por el límite de mutaciones.
- `recordLedgerChange` sube `expense_ledgers.revision` en cada escritura que la usa; las vistas previas de importación y recategorización comparan esa revisión.
- Exportar con el caso real (~2.500 filas) fue razonable contra D1 local; **no está medido contra D1 remota**.

## Goals / Non-Goals

**Goals:**
- Una exportación que contenga todo lo que la persona vio y aportó, documentada y verificable.
- Fidelidad demostrable: los saldos se recalculan desde el archivo.
- Que exportar quede auditado sin tocar la revisión del libro.

**Non-Goals:** los de `proposal.md`.

## Decisions

### D1. El JSON es la exportación completa; el CSV es la vista legible

Se conserva el modelo actual: un JSON con todo y un CSV de una fila por efecto de la versión vigente. Se le agregan nombres al CSV (`participante`, `cargado_por`) además del id, para que se entienda sin el JSON. No se parte el CSV en varios archivos (movimientos, aportes y repartos, como proponía `colaboracion-y-exportacion-del-libro`): sería más para mantener y para descargar en el teléfono, y el JSON ya cubre el análisis completo. Es una propuesta por decidir (Open Questions 2).

### D2. `schemaVersion: 4`, aditivo, con la regla escrita

Las secciones nuevas se agregan sin quitar ni renombrar las de la versión 3, y se suma `balances`. Aun así se sube a 4 porque aparecen secciones y semántica nueva (contenido por rol). La regla que se documenta: una **versión mayor nueva** solo cuando se quita o cambia el significado de un campo; los agregados no la suben; quien lee ignora lo desconocido. Secciones:

`schemaVersion`, `exportedAt`, `ledgerRevision`, `exportedBy` {`userId`, `role`}, `group` {`id`, `name`, `description`, `avatarEmoji`, `avatarColor`, `createdAt`, `archivedAt`}, `members` [{`userId`, `displayName`, `role`, `joinedAt`, `participantId`}], `invitations` [{`id`, `status`, `createdAt`, `resolvedAt`, `inviterUserId`, `targetParticipantId`}] (solo titular), `participants`, `personMerges` (con sus elementos), `categories`, `entries`, `revisions`, `events`, `auditEvents` (solo titular), `recategorizations`, `imports`, `importSourceRows`, `balances` [{`currency`, `participantId`, `amountMinor`}].

`balances` es **derivado**: se exporta para que quien lee pueda comprobar su propio recálculo, y el documento lo marca como tal.

### D3. Sin emails en la exportación

El email de un integrante o de una persona invitada es un dato personal de otra persona que hoy no sale de la aplicación y que la política de privacidad no promete entregar a todos. Se identifica a cada integrante por `userId` y `displayName` (que los demás integrantes ya ven). Las invitaciones se exportan con estado, fechas y persona vinculada, pero sin el email. Si Pablo decide incluirlos, debe actualizarse la política (Open Questions 3).

### D4. Contenido por rol: lo que se ve en la aplicación

Todo integrante exporta lo que la aplicación ya le muestra (grupo, personas, categorías, movimientos, revisiones, eventos del libro, importaciones). Las invitaciones y la auditoría de la plataforma solo salen para la persona titular, porque un integrante no las ve (en Personas solo ve la lista). Una sola función arma el documento y filtra por rol; no hay dos exportadores.

### D5. Fidelidad: recalcular desde el archivo con el dominio

Una prueba de integración crea un grupo con importes que no dividen exacto (100,00 entre 3), una unión de personas, una anulación, dos monedas y un lote importado; exporta; vuelve a calcular los saldos desde `entries` vigentes con las mismas funciones puras (`finance.js`/`split.js`) y exige igualdad exacta con `balances` y con los saldos que muestra la aplicación. Una segunda prueba exporta con el rol de integrante y verifica la ausencia de `invitations` y `auditEvents`. Una tercera comprueba que el JSON valida contra el esquema documentado.

### D6. La auditoría usa `platform_audit_events`, no `ledger_events`

`recordLedgerChange` sube la revisión del libro. Una exportación no cambia el libro y no debe invalidar vistas previas en curso ni hacer fallar la comprobación «hay una exportación a la revisión vigente» de `eliminacion-de-grupos`. El evento `ledger_exported` (`entity_type: "group"`) lleva en `metadata_json` `{ format, ledgerRevision }`. La revisión se lee **antes** de armar el archivo y se guarda esa: si el libro cambia durante la lectura, la revisión registrada es la anterior y la comprobación posterior exigirá otra exportación (falla segura).

### D7. Límite de uso, sin pedir que exporte la misma persona cien veces

Cada exportación escribe una fila y arma el documento en memoria. Se aplica el limitador existente de mutaciones a las rutas de exportación (60 por minuto por identidad es más que suficiente) y se responde 429 con el mensaje habitual. Se mide el tamaño y el tiempo con el caso real en staging antes de aceptar (Open Questions 4).

### D8. Una pantalla de exportación, con las dos descargas

`GET /groups/:groupId/ledger/export` muestra qué contiene cada archivo y los dos botones. Se enlaza desde la pantalla del grupo (reemplaza los dos enlaces sueltos) y desde Administrar grupo. Las rutas `export.json` y `export.csv` se conservan. El nombre del archivo es `cuentas-claras-<slug>-<AAAA-MM-DD>.json|csv`; el `slug` ya está normalizado para URLs, de modo que no hace falta escapar nada extra en la cabecera.

### D9. Documento de formato como contrato

`docs/HOMESUITE_CUENTAS_CLARAS_EXPORTACION.md` explica cada sección, los tipos, la semántica de importes en unidad menor con moneda explícita, cómo recalcular saldos y la regla de versionado. Es la fuente que la prueba de esquema lee para no desfasarse.

## Risks / Trade-offs

- [Un archivo grande armado en memoria puede exceder el tiempo o la memoria del Worker con mucho más que ~2.500 filas] → se mide en staging con el caso real; si hace falta, otro cambio para paginar o transmitir por partes.
- [Incluir nombres de integrantes amplía lo que sale] → son los mismos nombres que la aplicación ya muestra a cualquier integrante; los emails quedan fuera.
- [Subir a versión 4 puede confundir a quien procesa archivos viejos] → el documento registra los cambios entre 3 y 4 y la regla aditiva.
- [Escribir una fila de auditoría en un GET] → es la única escritura, queda limitada por el limitador y no toca el libro.
- [Un CSV con nombres facilita copiar los datos] → los nombres ya están a la vista de todo integrante.

## Migration Plan

Sin migración de esquema. Despliegue compatible hacia adelante: el Worker nuevo responde `schemaVersion: 4` y las rutas conservan sus direcciones. Reversión: volver al Worker anterior; los eventos `ledger_exported` ya escritos quedan inofensivos en `platform_audit_events`.

## Relación con `colaboracion-y-exportacion-del-libro`

Este cambio absorbe su capacidad `exportacion-y-archivo-del-libro` en lo que a exportar se refiere (archivar y restaurar ya existen por otros cambios). La recomendación sobre ese cambio activo está en el reporte del PR y en `salir-y-quitar-integrantes`/`eliminacion-de-grupos`, que cubren lo que quedaba de «revocar miembros» y de «eliminación definitiva».

## Open Questions

Propuestas por decidir (con su valor por defecto):

1. **Quién exporta:** cualquier integrante (hoy y MVP §4). Por defecto se mantiene.
2. **CSV:** una sola tabla con nombres agregados, sin archivo de repartos aparte. Por defecto.
3. **Emails de integrantes e invitados en el JSON:** excluidos. Por defecto; incluirlos exige cambiar la política de privacidad.
4. **Escala:** el límite de tamaño y el uso de streaming se deciden tras medir contra D1 remota con el caso real (~2.500 filas). Por defecto no se pagina.
5. **Auditar también las exportaciones CSV:** sí, con `format: "csv"`. Por defecto.
6. **Descarga de «mis datos» de la cuenta** (perfil, membresías) fuera de los grupos: no entra aquí; se evalúa en `baja-de-cuenta-homesuite`.
