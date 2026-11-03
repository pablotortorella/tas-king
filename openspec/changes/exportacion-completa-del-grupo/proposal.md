## Why

Una persona que guarda sus cuentas en HomeSuite tiene que poder llevarse todo lo que guardó, en un formato que se entienda sin la aplicación. `docs/HOMESUITE_DATA_LIFECYCLE.md` lo exige antes de aceptar datos reales (punto 1 de «Exportación y eliminación») y es también la condición previa de la eliminación de grupos.

Hoy existe una exportación parcial (`GET /groups/:id/ledger/export.json` y `export.csv`, enlazadas en la pantalla del grupo) que no cumple la letra del contrato:

- El JSON (`schemaVersion: 3`) incluye libro, personas, categorías, movimientos con partes y efectos, revisiones, eventos y filas de importación, pero **no** el nombre, la descripción, el emoji ni el color del grupo, ni los integrantes y sus roles, ni las invitaciones, las uniones de personas, las recategorizaciones, la auditoría de la plataforma o los saldos. El formato no está documentado en ningún lado (`ANALISIS-APLICACION.md` todavía dice «2»).
- El CSV trae `participante_id` pero **no el nombre**: sin el JSON no se entiende.
- No hay prueba de **fidelidad** (exportar y recalcular los saldos, que pide el contrato) y no queda registro de que alguien exportó.
- Las páginas legales dicen que «la exportación completa […] aún no se ofrece».

Decisiones tomadas por Pablo el 2026-11-02 que este cambio respeta: antes de eliminar un grupo la aplicación ofrece exportar (lo cubre `eliminacion-de-grupos`, que depende de este cambio) y la exportación existente cubre a cualquier integrante (así lo dice el MVP, §4).

## What Changes

- **JSON completo y versionado** (`schemaVersion: 4`): agrega grupo, integrantes con rol y fecha de ingreso, invitaciones (sin email), uniones de personas, recategorizaciones, eventos de auditoría de la plataforma del grupo y los saldos calculados. Mantiene lo que ya exporta. Contenido por rol: la persona titular recibe todo; un integrante recibe lo que ve en la aplicación (sin invitaciones ni auditoría de la plataforma).
- **Formato documentado como contrato:** `docs/HOMESUITE_CUENTAS_CLARAS_EXPORTACION.md` describe cada sección, el significado de los campos, la regla de versionado (los cambios aditivos no suben la versión mayor; quien lee ignora lo desconocido) y cómo recalcular los saldos.
- **Prueba de fidelidad:** una prueba de integración exporta un grupo con redondeos, uniones y anulaciones, recalcula los saldos desde el JSON con las funciones de dominio y exige coincidencia exacta por persona y moneda.
- **CSV legible:** agrega el nombre de cada persona y de quien cargó el movimiento. Sigue siendo una fila por efecto con la versión vigente y la protección contra fórmulas; el JSON es la exportación completa.
- **Auditoría de exportaciones:** cada exportación JSON deja un evento `ledger_exported` en `platform_audit_events` con formato y revisión del libro, sin subir la revisión del libro.
- **Nombre del archivo** con el grupo y la fecha, y una pantalla de exportación única con ambas descargas, pensada para el teléfono.
- **Límite de uso** para las exportaciones (son lecturas que escriben una fila de auditoría).
- **Textos legales** actualizados (ver más abajo).

### Non-goals

- Importar de vuelta un JSON exportado ni restaurar un grupo desde la exportación: el MVP lo declara operación, no interfaz.
- Emails de integrantes e invitados en la exportación (dato personal de terceras personas que hoy no sale; ver `design.md`).
- Exportar comentarios (no existen) o adjuntos.
- Paginar o transmitir por partes la exportación; se mide con el caso real y se decide después.
- Eliminar el grupo (`eliminacion-de-grupos`).
- Un archivo comprimido con varios CSV separados (`colaboracion-y-exportacion-del-libro` los proponía; ver `design.md`).

## Capabilities

### New Capabilities

- `exportacion-del-grupo`: contenido y formato del JSON y del CSV, contenido por rol, fidelidad de saldos, auditoría de exportaciones y su presentación en pantalla.

### Modified Capabilities

<!-- Ninguna: openspec/specs/ no contiene capacidades de Cuentas Claras. El cambio colaboracion-y-exportacion-del-libro, todavía activo, propone una capacidad solapada (exportacion-y-archivo-del-libro); ver design.md. -->

## Impact

- `apps/app/src/ledger.js` (`exportLedger`), `ledger-ui.js` (`ledgerCsv`), `index.js` (rutas de exportación y límite), `overview-ui.js` (enlaces), una pantalla nueva de exportación y `group-ui.js` o el módulo de rutas que corresponda.
- Sin migración: todo se arma con tablas existentes. `platform_audit_events` ya admite acciones nuevas.
- `docs/HOMESUITE_CUENTAS_CLARAS_EXPORTACION.md` (nuevo), `docs/diseno/.../ANALISIS-APLICACION.md` (corregir «2»), `docs/HOMESUITE_DATA_LIFECYCLE.md`, `docs/productos/CUENTAS-CLARAS.md`, glosario, STATUS y backlog.
- `apps/site/public/privacidad.html` y `terminos.html`.
- Pruebas: unitarias del formato, integración D1 de contenido por rol y fidelidad, y E2E de la pantalla en 390 px y escritorio.

## Dependencias y orden

Orden de los cinco cambios de esta serie:

1. `alertas-minimas-homesuite`. Independiente.
2. **`exportacion-completa-del-grupo`** (este). No depende de ningún otro cambio de la serie; puede hacerse en paralelo con el 1.
3. `salir-y-quitar-integrantes`. Usa esta exportación en su pantalla de salida (si todavía no existe, enlaza la exportación actual).
4. `eliminacion-de-grupos`. **Depende de este cambio**: ofrece la exportación antes de eliminar y la deja disponible para la persona titular durante la ventana de 30 días.
5. `baja-de-cuenta-homesuite`. Indirecta: la baja le pide a la persona que exporte sus grupos antes.

## Relación con los respaldos de 90 días

La exportación **no es un respaldo** ni lo sustituye: es una copia entendible para la persona usuaria, generada a pedido, mientras que el respaldo diario en R2 (retención de 90 días) es una copia de infraestructura para recuperación. Exportar no modifica los respaldos y los respaldos no sirven como exportación. La documentación del formato lo aclara, y los textos legales siguen diciendo que lo eliminado puede persistir en copias de seguridad hasta 90 días.

## Auditoría

Cada exportación JSON registra en `platform_audit_events` el evento `ledger_exported` con quién exportó, el grupo, el formato y la revisión del libro en ese momento. Se usa la auditoría de la plataforma y no la línea de tiempo del libro (`ledger_events`) porque `recordLedgerChange` sube `expense_ledgers.revision`, y exportar no debe invalidar vistas previas ni la comprobación de «exportación a la revisión vigente» que usa `eliminacion-de-grupos`. La exportación CSV también se registra, con `format: "csv"`.

## Permisos de titular y de integrante

Cualquier integrante puede exportar el grupo (como hoy). El contenido depende del rol: la persona titular recibe además invitaciones (sin email) y auditoría de la plataforma; un integrante recibe lo que ve en la aplicación. Quien no es integrante recibe 404 sin datos, igual que quien no inició sesión recibe el pedido de entrar. Un grupo archivado se puede exportar.

## Móvil

Una pantalla de exportación única (desde el grupo y desde Administrar grupo) con dos botones de al menos 44 px: «Descargar todo (JSON)» y «Descargar movimientos (CSV)», y una línea que explica la diferencia. Se verifica en 390 px y escritorio que no hay desborde horizontal, que la descarga se inicia en el navegador del teléfono y que el nombre del archivo es reconocible.

## Páginas legales

Tareas de actualización, descritas en el punto 6 de `tasks.md` y marcadas como **texto legal que revisa Pablo**:

- `terminos.html`: reemplazar «La exportación completa y eliminación autónoma de grupos aún no se ofrecen desde la interfaz» por un texto que diga que cualquier integrante puede exportar el grupo (JSON completo y CSV) y que la eliminación autónoma se describe aparte cuando exista.
- `privacidad.html`: en «Cuentas Claras» y en «Conservación […] y tus derechos», describir qué incluye la exportación (sin emails de otras personas) y que no sustituye las copias de seguridad; mantener la frase sobre el plazo de 90 días de las copias; actualizar «Última actualización».
- Ninguno de los dos textos se publica sin la lectura de Pablo; no se afirma aprobación por haberlos escrito.
