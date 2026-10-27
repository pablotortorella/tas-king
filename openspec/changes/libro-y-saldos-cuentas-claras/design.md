## Context

El MVP (`docs/HOMESUITE_CUENTAS_CLARAS_MVP.md`) fija el vocabulario, las
invariantes y la dirección del modelo, y deja a esta fase OpenSpec el esquema
físico y varias decisiones (sección 17). `apps/app/` ya tiene Worker Hono, D1,
usuarios, sesiones y grupos; este change agrega el dominio financiero sobre
`groups` y `memberships` sin tocar su contrato.

Referencia visual (en `docs/diseno/cuentas-claras/`): lienzo «Cuentas Claras» (Claude Design), pantallas 1,
4, 6, 7, 8 y 9. Datos de demostración sintéticos: Pablo, Ana, Laura y Mateo.

## Goals / Non-Goals

**Goals:** invariantes que el servidor valida y los tests prueban; saldos
explicables; escrituras atómicas, idempotentes y sin pérdida silenciosa;
interfaz móvil que resuelve el caso frecuente (un pagador, todos participan,
reparto igual) en pocos toques.

**Non-goals:** los listados en `proposal.md`.

## Decisions

### D1. Importes enteros en unidad menor, con tabla de monedas

Todo importe se guarda como entero con signo en la unidad menor de su moneda. Una
tabla `currencies(code, minor_exponent)` define el exponente; los cálculos nunca
usan coma flotante. COP, USD y EUR se validan primero, pero el modelo admite
exponentes 0 y 3. Un saldo nunca suma monedas distintas.

### D2. Un movimiento, dos conjuntos de partes

Para expresar de forma simétrica «quién puso o recibió dinero» y «a quién le
corresponde el efecto»:

| Tabla | Contenido | Invariante |
|---|---|---|
| `expense_ledgers` | grupo, moneda predeterminada, `revision` monótona, estado | un libro por grupo |
| `ledger_participants` | libro, nombre visible, usuario opcional, activo | nombre único por libro entre activos |
| `ledger_entries` | libro, tipo, moneda, importe, fecha, descripción, nota, estado, revisión actual | importe > 0 |
| `entry_cash_parties` | movimiento, participante, importe, sentido (`in`/`out`) | suma por sentido = importe |
| `entry_allocations` | movimiento, participante, importe | suma = importe (sólo gasto e ingreso) |
| `entry_revisions` | movimiento, número, autor, instante, instantánea JSON | inmutable |
| `idempotency_keys` | clave, libro, huella del cuerpo, respuesta | única por libro y clave |

Gasto: `cash_parties` son quienes pagaron. Ingreso: quienes recibieron.
Transferencia: un origen (`out`) y un destino (`in`) del mismo importe, sin
asignaciones. Las tablas de partes guardan sólo la versión vigente; la historia
vive en `entry_revisions`. El efecto de saldo es la fórmula del MVP, sección 8.

### D3. Saldos como consulta agregada, no como proyección guardada

El saldo se calcula con una agregación indexada sobre movimientos vigentes por
`(libro, moneda, participante)`. No hay columna de saldo editable. Si una medición
posterior exige una caché, será derivada, reconstruible y con prueba de igualdad.
`importacion-splitwise-inicial` propone que esa agregación lea `entry_effects` (efecto
por participante escrito junto a las partes); conviene decidirlo antes de aplicar
este change para no migrar dos veces.

### D4. Repartos en una función pura

`splitAmount(total, method, inputs)` vive en un módulo sin acceso a D1. Devuelve
importes enteros cuya suma es exactamente el total. Residuo: método del mayor
resto; los empates se resuelven por orden estable de id de participante. La
interfaz muestra «$1 de residuo asignado a X» cuando ocurre.

### D5. Idempotencia y concurrencia

Cada POST/PATCH monetario exige `Idempotency-Key`. La misma clave con el mismo
cuerpo devuelve la respuesta original; con otro cuerpo, 422. Las ediciones envían
la revisión del libro que vieron; si cambió, la respuesta es 409 con el estado
vigente, sin aplicar nada. La escritura de movimiento, partes, revisión,
incremento de `revision` y clave va en un solo `db.batch()`.

### D6. Sugerencias deterministas, no obligaciones

Por moneda: acreedores y deudores ordenados por monto descendente y luego por id;
se empareja el mayor con el mayor hasta agotar. Produce a lo sumo n−1
transferencias y el mismo resultado ante los mismos saldos. Se calcula al leer;
«Registrar» abre una transferencia prellenada, no guarda una deuda.
(Minimizar el número de transferencias en general es un problema difícil; se
adopta una heurística simple y explicable. No verificado en esta sesión con
fuente citable.)

### D7. API bajo `/api/expenses`

Rutas conceptuales del MVP, sección 10: libros, participantes, movimientos,
revisiones y saldos. Las respuestas de escritura incluyen el movimiento
confirmado y la nueva `revision` del libro para que el cliente actualice su estado
sin recargar colecciones. Autorización en servidor por membresía del grupo.

### D8. Interfaz

- Rutas bajo `/cuentas-claras`, un solo documento con estado en cliente.
- Redacción de saldos: «te deben» / «debés» para la persona autenticada; el signo
  y la palabra acompañan siempre al importe (nunca sólo color).
- Selector de moneda como control segmentado; cada moneda tiene su propio saldo.
- Escritorio: panel de saldos y sugerencias junto al listado de movimientos;
  en móvil se apilan.
- Colores como variables CSS con una paleta clara y otra oscura seleccionadas por
  `prefers-color-scheme`. Los valores del lienzo son provisionales y se verificaron
  sólo por cálculo de contraste; la identidad visual de la suite se decide en HT-01.

### D9. Presupuesto de llamadas

Abrir un libro: una lectura de libro y participantes, una de saldos y una de
movimientos recientes, independientes del número de participantes o movimientos
(sin N+1). Una escritura: un `db.batch()`. Se fija con tests de conteo según
`docs/PERFORMANCE-PRACTICES.md`; cualquier excepción se justifica.

## Risks / Trade-offs

- Guardar sólo la versión vigente en las tablas de partes obliga a escribir una
  instantánea por revisión; es más escritura a cambio de lecturas simples.
- La heurística de sugerencias puede dar más transferencias que el mínimo
  posible; se acepta por previsibilidad.
- Un solo documento de interfaz crece rápido; se modulariza desde el principio
  siguiendo ADR-017.

## Migration Plan

Los grupos creados antes de este change reciben un libro vacío en la migración,
con la moneda predeterminada COP y un participante para su titular. No hay
movimientos que migrar. Revertir el despliegue oculta la interfaz; las tablas no
se deshacen automáticamente.

## Open Questions

Decisiones que el rediseño ya dio por tomadas y deben confirmarse en `explore`:

1. **Exponente de COP.** La interfaz muestra COP sin decimales; el CSV de ejemplo
   usa dos. ¿Se almacena con exponente 2 y se muestra redondeado, o se usa 0?
   (Que ISO 4217 asigna 2 decimales a COP es recordado, no verificado aquí.)
2. **Receptores y pagadores múltiples.** El modelo los admite; la interfaz inicial
   muestra uno solo (corte C amplía). ¿Alcanza?
3. **Algoritmo de sugerencias** (D6) y si debe ofrecerse una alternativa.
4. **Redondeo.** ¿Mayor resto con desempate por id, o asignar el residuo siempre
   a quien pagó?
5. **Ventana de edición** de un miembro sobre su propio movimiento (sección 17 del
   MVP). Este change supone que sólo la persona titular corrige movimientos ajenos.
6. **Redacción** «te deben / debés» y su variante neutra para cuando haya más de
   una persona usuaria con distinta convención de tratamiento.
7. **Fuente externa de un ingreso.** El lienzo la muestra como «de: Inquilino»;
   aquí se guarda como parte de la descripción. ¿Merece un campo propio?
8. **Efecto por movimiento.** ¿Se agrega desde las partes (D3) o desde una tabla
   `entry_effects` como propone la importación? Decidir en `explore` con ambos
   changes a la vista.
