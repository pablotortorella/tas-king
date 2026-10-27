## Why

`plataforma-homesuite-minima` entrega identidad, grupos privados e invitaciones,
pero Cuentas Claras sigue siendo un estado vacío. Para que dos personas registren
dinero y entiendan quién le debe qué a quién hace falta el primer modelo
financiero: un libro por grupo, movimientos con invariantes verificables y
saldos derivados de ellos.

Este change es el núcleo del corte B de `docs/HOMESUITE_CUENTAS_CLARAS_STORY_MAP.md`
y cubre la historia HG-06. La importación de Splitwise, la búsqueda unificada y la
gestión de personas fuera de la lista inicial quedan en changes separados, como
pide `docs/PRODUCT_BACKLOG.md` («no se mezclarán autenticación, modelo financiero
y parser de importación en un solo change»).

La forma visual y el recorrido salen del rediseño «Cuentas Claras» hecho en
Claude Design (10 pantallas guardadas en `docs/diseno/cuentas-claras/`); este change usa las pantallas 1, 4,
6, 7, 8 y 9. Ese lienzo es referencia de intención, no un contrato de píxeles.

## What Changes

- Al crear un grupo se crea, en la misma transacción, su libro de Cuentas Claras
  con una moneda predeterminada y un participante vinculado a la persona titular.
- Un libro admite participantes identificados por nombre. Un participante con
  historia no se elimina: se desactiva.
- Se registran tres tipos de movimiento: gasto, ingreso y transferencia, cada uno
  con una única moneda y todos sus importes como enteros en la unidad menor.
- Gastos e ingresos se reparten de forma igual, exacta, porcentual o por partes,
  con una regla determinista y visible para los residuos.
- Un movimiento puede corregirse (nueva revisión) o anularse (queda visible, deja
  de contar). No hay borrado desde la interfaz normal.
- Toda escritura monetaria acepta una clave de idempotencia y detecta cambios
  concurrentes mediante la revisión del libro; un conflicto nunca se resuelve por
  «gana el último».
- Se calculan saldos netos por participante y moneda, la explicación de cada saldo
  movimiento por movimiento y sugerencias de transferencia derivadas. Nada de esto
  se guarda como deuda.
- La interfaz web incluye: nuevo grupo, saldos con selector de moneda, agregar
  movimiento (gasto, ingreso, transferencia), detalle con historial, «por qué»
  de un saldo y un libro de dos paneles en escritorio. Es móvil primero, accesible
  y respeta el esquema de color claro u oscuro del dispositivo.

### Non-goals

- Importar de Splitwise y elegir un punto de partida (`importacion-splitwise-inicial`).
- Búsqueda libre sobre el historial (`busqueda-movimientos-unificada`). Aquí el
  historial se lista por fecha sin buscador.
- Vincular participantes a cuentas, comentarios, exportación, archivo del grupo y
  roles finos (`colaboracion-y-exportacion-del-libro`).
- Apertura con saldos no cero, conversión de moneda, categorías, recurrentes,
  adjuntos y préstamos o deudas como entidades.
- Fijar la paleta o el nombre de los temas de la suite (HT-01 y HT-02 del backlog
  se exploran después). Este change sólo exige contraste y respeto del esquema.

## Capabilities

### Added Capabilities

- `libro-cuentas-claras`: libro por grupo, participantes y moneda predeterminada.
- `movimientos-cuentas-claras`: gasto, ingreso, transferencia, repartos, monedas,
  revisiones, anulación, idempotencia y concurrencia.
- `saldos-cuentas-claras`: saldo neto por participante y moneda, explicación y
  sugerencias derivadas.
- `interfaz-cuentas-claras`: recorridos móviles y de escritorio, accesibilidad y
  esquema de color.

## Impact

- `apps/app/`: nuevas migraciones D1, módulos de libro, movimientos, repartos y
  saldos, rutas `/api/expenses/*` y la interfaz de Cuentas Claras.
- Depende de que `plataforma-homesuite-minima` termine el grupo 3 de su
  `tasks.md` (creación de grupos y membresías). Hasta entonces este change no
  puede aplicarse.
- Pruebas unitarias y de propiedades para repartos y saldos; integración D1 para
  atomicidad e idempotencia; E2E con identidades sintéticas.
- No modifica TasKing ni `apps/site/`.
