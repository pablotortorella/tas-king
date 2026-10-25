## Context

Hoy el reparto vive en tres lugares que no comparten código:

- `parseEntryForm` (`ledger-ui.js`) lee `splitMethod` (`equal` o `exact`), llama a `splitEqually` (`finance.js`) o parsea `share_<id>` y construye las asignaciones.
- La vista previa del navegador (`client.js`, desde el PR #89) reimplementa el reparto igual y la suma de importes exactos.
- Al corregir, `renderEntryForm` deduce «igual o exacto» comparando las asignaciones guardadas con `splitEqually`. El método ingresado no se conserva.

`saveEntry` (`ledger.js`) guarda en `entry_revisions.snapshot_json` la instantánea `{ ...details, ...draft, status }`. Las asignaciones viven en `entry_allocations` con importes positivos, y cada movimiento tiene `current_revision`. No hay columna donde guardar un método. Las pruebas E2E existentes fijan los nombres de campo del formulario (`splitMethod`, `share_<id>`, `beneficiary`, `payer`), que se conservan.

Ver `proposal.md` para el motivo y `specs/reparto-de-movimientos/spec.md` para el comportamiento exigido.

## Goals / Non-Goals

**Goals:**

- Una sola regla de reparto, probada con propiedades, que el servidor y el navegador ejecuten con el mismo código.
- Que agregar un método nuevo en el futuro no obligue a tocar la vista previa.
- Reabrir un movimiento con el método y los datos que se ingresaron, sin migración de esquema.
- Conservar los nombres de campo del formulario y las pruebas existentes.

**Non-Goals:**

- Cambiar cómo se guardan las asignaciones (`entry_allocations`) ni cómo se calculan los saldos.
- Los repartos por ajuste, el itemizado, varios pagadores y las transferencias.

## Decisions

### D1. Una función pura `splitAmount`

`splitAmount({ totalMinor, units, method, inputs, order })` devuelve `{ allocations, residue }` o un error con el motivo. Es una función sin dependencias, sin acceso a D1 ni al DOM, y recibe el orden estable de las personas como dato. `inputs` es un mapa de identificador de persona a texto ingresado más la lista de personas elegidas.

- **Por qué.** Hoy hay dos implementaciones (`splitEqually` en el servidor y una copia en `client.js`) que pueden divergir. Con cinco métodos y residuo, la divergencia sería inevitable.
- **Alternativas.** Mantener un cálculo en cada lado con pruebas cruzadas: descartada, porque obliga a duplicar la regla y a mantener cuatro pruebas por método. Una consulta al servidor para cada vista previa: descartada, porque agrega latencia y una llamada por tecla.

### D2. Aritmética entera, mayor resto y orden del grupo

- Todo en enteros con `BigInt` para el producto `total × peso`: porcentajes y partes se leen en centésimas, así `33,33 %` es `3333` sobre `10000`.
- Cada persona recibe `floor(total × peso / suma de pesos)`. Lo que falta para llegar al total se reparte de a una unidad menor, empezando por el mayor resto de la división y resolviendo empates por el orden del grupo.
- El reparto igual es el caso en que todos los pesos son iguales: las primeras personas del orden reciben la unidad sobrante, como hoy. Lo único que cambia es el orden de referencia (ver abajo), y solo para movimientos nuevos: los ya guardados conservan sus importes.
- «Algunos fijos»: se restan los fijos del total y el resto se reparte igual entre las personas sin fijo con la misma regla.
- **Orden del grupo, no del formulario.** El formulario muestra primero a la persona autenticada. Cada persona lleva un índice de orden (`data-order`, su posición en `participantsFor`) y el servidor usa ese mismo orden leyéndolo de la base. Así el residuo no depende de cómo se dibuje la pantalla.
- **Alternativa.** Ordenar por identificador: descartada, porque los identificadores son aleatorios y la asignación del residuo resultaría arbitraria.

### D3. El servidor recalcula siempre

`parseEntryForm` deja de construir las asignaciones a mano y llama a `splitAmount` con el método y los datos que llegan. Lo que el navegador envíe como importes calculados se ignora. La función que valida el borrador (`validateEntryDraft`) sigue siendo la última barrera de suma y de signos.

### D4. La regla viaja al navegador desde el mismo archivo

El módulo `split.js` contiene solo la función pura. El servidor la importa y la ruta `/split.js` devuelve su texto con `Content-Type: text/javascript`. `client.js` pasa a cargarse como módulo y la importa. La CSP (`script-src 'self'`) lo permite porque es del mismo origen.

- **Cómo se sirve.** El Worker no tiene archivos estáticos. La función se escribe sin variables libres y se publica con `Function.prototype.toString()` precedido de `export`.
- **Prueba de paridad.** Una prueba pide `/split.js`, evalúa ese texto de forma aislada y compara su resultado con el de la función importada sobre miles de casos generados, para los cinco métodos. Si algún día el empaquetador transforma la función, la prueba falla.
- **Alternativas.** Importar el archivo como texto con una regla de Wrangler (`Text`): descartada, porque obliga a mantener el mismo código en dos formatos. Mantener la copia en `client.js` con una prueba que compare ambas: descartada por duplicar. Generar el cliente con un paso de compilación: descartada, porque el proyecto no tiene compilación y agregarla supera el alcance de este cambio.

### D5. El método se guarda en la instantánea de la revisión

La instantánea de cada revisión incorpora `split: { method, beneficiaries, inputs }`, donde `inputs` guarda el texto tal como se escribió. Al editar, el servidor lee la instantánea de la revisión vigente (`current_revision`) y la pasa al formulario.

- **Por qué.** La instantánea ya es inmutable y se exporta en el JSON del libro, así que el historial de métodos queda gratis y no hace falta una migración. Una consulta más en la pantalla de edición no afecta el presupuesto de lectura, porque esa pantalla ya consulta las revisiones.
- **Alternativa.** Una columna `split_json` en `ledger_entries`: descartada, porque necesita una migración (con riesgo de chocar con la numeración de otras ramas) y duplica lo que ya guarda la revisión.
- **Sin método guardado** (movimientos previos o importados): se deduce como hoy, igual si las asignaciones lo son y exacto en caso contrario. No se escribe nada de forma retroactiva.

### D6. Nombres de campo: se conservan los existentes y se suman los nuevos

`splitMethod` admite `equal`, `exact`, `percent`, `shares` y `fixed`. Los datos viajan en `share_<id>` (importes exactos, como hoy), `percent_<id>`, `parts_<id>` y `fixed_<id>`. `beneficiary` sigue marcando a las personas elegidas. En «algunos fijos», quienes tienen `fixed_<id>` completo son fijos y el resto de las elegidas comparte el resto. Los formularios y pruebas actuales siguen funcionando sin cambios.

### D7. El atajo es azúcar de interfaz

«Lo debe todo una persona» marca como única beneficiaria a esa persona y usa el método igual. No existe en el servidor ni en la regla como método propio, así que no hay un contrato más que mantener.

### D8. El historial incluye la forma de reparto

`revisionSummary` compara también `split` entre revisiones y agrega «forma de reparto» a la lista de lo que cambió. Sin eso, un cambio de igual a 50 % / 50 % diría «Sin cambios de contenido».

### D9. «Algunos fijos» rechaza los casos ambiguos

Si los fijos suman exactamente el total y quedan personas sin fijo, esas personas pagarían cero. Se rechaza con un mensaje en lugar de guardar una asignación de cero que probablemente sea un error de carga. Si nadie tiene fijo, equivale a «igual».

## Risks / Trade-offs

- **El empaquetador transforma la función servida** → La prueba de paridad evalúa el texto servido y lo compara con la función importada; además `/split.js` se prueba en el Worker de integración.
- **Hoy el residuo de un reparto igual sigue el orden en que llegan las personas desde el formulario (la persona autenticada primero); con este cambio sigue el orden del grupo** → Solo afecta a movimientos nuevos con residuo, y por centavos. Los guardados no cambian. Una prueba fija la nueva regla y otra que los importes ya guardados se reabren igual.
- **La vista previa depende de que el script cargue como módulo** → Si el módulo falla, el formulario sigue guardando con el servidor; la vista previa simplemente no aparece. Una prueba E2E cubre que no hay errores de consola.
- **Más estados en el formulario** (cinco métodos, cada uno con sus campos) → Se muestran solo los campos del método elegido, y los controles mantienen el mínimo táctil de 44 px y las etiquetas accesibles que ya exige el diseño.
- **Confusión entre «partes» y «porcentajes»** → Los rótulos usan ejemplos en el texto de ayuda («2 adultos y 1 chico») y la vista previa muestra siempre los importes resultantes.

## Migration Plan

No hay migración de datos ni de esquema. Los movimientos existentes siguen válidos y se reabren por deducción. El cambio se puede desplegar sin coordinar con la base de datos. Para revertirlo basta volver al código anterior: las instantáneas nuevas llevan un campo `split` adicional que el código anterior ignora.

## Open Questions

- Los rótulos exactos de los métodos y los textos de ayuda en el formulario (se afinan en el diseño visual, sin cambiar los requisitos).
- Si conviene limitar las partes a números enteros en la primera versión (hoy se admiten hasta dos decimales). No cambia los requisitos ni las tareas.
