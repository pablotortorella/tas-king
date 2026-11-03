## Why

El formulario de movimientos solo reparte en partes iguales o con importes exactos (`parseEntryForm` acepta `equal` y `exact`). Cargar «60 % / 40 %», «2 adultos y 1 chico» o «Ana paga solo su postre y el resto lo reparten Beto y Carla» obliga a calcular importes a mano, y al corregir un movimiento el reparto se reconstruye desde los importes: el método elegido se pierde. El borrador `libro-y-saldos-cuentas-claras` ya prometía porcentajes y partes, que no existen. Se decidió en el explore (D13 de `docs/diseno/cuentas-claras/DECISIONES-EXPLORE.md`) cerrarlo ahora, porque quien migra desde Splitwise espera esos métodos.

## What Changes

- Se suman tres métodos de reparto a gastos e ingresos: **Porcentajes**, **Partes** y **Algunos fijos + el resto en partes iguales**. Se conservan **Igual** e **Importes exactos**.
- Se agrega el atajo **«lo debe todo una persona»**, que elige a esa persona como única beneficiaria.
- Una **regla única de reparto** calcula los importes. El servidor la usa para guardar y el navegador para la vista previa, de modo que lo que se ve antes de guardar es exactamente lo que se guarda.
- Los residuos de centavos se asignan por el método del **mayor resto**, con empate por el orden estable de las personas del grupo, y la vista previa los muestra.
- Cada movimiento **guarda el método y los datos que se ingresaron** en su revisión, y al corregir se reabre tal como se cargó. Los movimientos anteriores, que no guardan método, se reabren como igual o exacto.
- El historial de revisiones indica cuando cambió la forma de reparto aunque los importes no cambien.
- Sin cambios en el esquema de datos ni migraciones: el método se guarda en la instantánea de la revisión.

### Non-goals

- Los repartos por **ajuste** (sumar o restar a una persona sobre un reparto igual) y el **itemizado** de una cuenta: el primero se descartó a favor de «algunos fijos» y el segundo queda para más adelante.
- Las **transferencias**, que no se reparten.
- Reparto con varios pagadores o varios receptores.
- Conversión entre monedas.

## Capabilities

### New Capabilities

- `reparto-de-movimientos`: cómo se reparten los gastos e ingresos entre las personas del libro: métodos, validaciones, residuo, coincidencia entre vista previa y guardado, y reapertura del método al corregir.

### Modified Capabilities

<!-- Ninguna capability vigente cambia: openspec/specs/ solo contiene landing-publica-homesuite y tip-diario. -->

## Impact

- `apps/app/src/`: módulo nuevo de la regla pura de reparto; `ledger-ui.js` (lectura del formulario, formulario de movimiento, resumen del historial); `ledger.js` (instantánea de la revisión); `client.js` y la ruta que sirve el script (vista previa con la misma regla); `index.js` (servir la regla al navegador y leer el método al editar).
- Pruebas unitarias y de propiedades de la regla, integración D1 para la persistencia y la reapertura, y E2E del formulario.
- Depende de que se integren las ramas que contienen el libro, el formulario con vista previa y el script del navegador: la cadena #68 → #71 → #75 → #76 → #81 y los PR #88 → #89 → #90.
- Reemplaza el requisito «Repartos exactos con residuo determinista» del borrador `libro-y-saldos-cuentas-claras`, que habrá que reconciliar.
