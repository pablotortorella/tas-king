## Context

El archivo de Splitwise trae, por fila, fecha, descripción, categoría, coste,
moneda y un efecto firmado por cada participante (columnas dinámicas); puede traer
además una fila de resumen. Está descrito en
`docs/HOMESUITE_CUENTAS_CLARAS_CSV_DE_EJEMPLO.md`. Reglas de confianza:
`docs/HOMESUITE_CUENTAS_CLARAS_JOURNEY.md` y el Story Map.

Se desconoce el comportamiento de otros idiomas, monedas o números de columnas;
el fixture sintético sólo fija la forma observada.

## Goals / Non-Goals

**Goals:** que la persona vea y apruebe qué entra antes de guardar; que el saldo
migrado sea verificable; que ningún dinero se omita, invente o duplique de forma
silenciosa.

**Non-goals:** los listados en `proposal.md`.

## Decisions

### D1. Preparar, revisar y confirmar son tres pasos distintos

`POST /imports` recibe el CSV y crea un lote en estado `preview`: se parsea,
valida y se guardan filas y hallazgos, pero ningún movimiento. `PUT
/imports/:id/mapping` y `.../incidents/:row` registran las decisiones. `POST
/imports/:id/confirm` aplica el lote. Cancelar descarta el lote sin tocar el libro.

### D2. El efecto firmado es el dato; la inferencia es una anotación

Un movimiento importado se guarda con su efecto exacto por participante en
`entry_effects(entry_id, participant_id, amount)`. «Quién pagó» y «cómo se
repartió», cuando son inequívocos, se muestran como inferencia rotulada y nunca
sustituyen el efecto. Para que haya un único camino de cálculo, los saldos de
todo movimiento (también los creados en HomeSuite) se agregan desde
`entry_effects`, que se escribe en el mismo `db.batch()` que sus partes y se
valida contra ellas. Esto ajusta D3 de `libro-y-saldos-cuentas-claras`: si ese
change aún no se aplicó, la tabla se incorpora allí.

### D3. Lote, filas y procedencia

| Tabla | Contenido |
|---|---|
| `import_batches` | libro, origen (`splitwise-csv`), huella SHA-256 del archivo, estado (`preview`, `applying`, `applied`, `canceled`), conteos, autor, instantes |
| `import_rows` | lote, número de fila original, datos parseados, estado (`valid`, `incident`, `summary`, `excluded`), motivo |
| `import_assumptions` | lote, fila, tipo, valor, autor |
| `ledger_entries.import_batch_id`, `.source_row` | procedencia por movimiento |

### D4. Idempotencia del lote

Un lote se identifica por `(libro, huella del archivo)`. Subir el mismo archivo
otra vez devuelve el lote existente y, si ya se aplicó, informa qué movimientos
ya estaban presentes. Confirmar dos veces aplica una vez.

### D5. Aplicación del lote

La confirmación escribe movimientos, efectos y procedencia. Si el lote excede lo
que D1 acepta en una sola operación, se aplica en tramos con estado
`applying` y se reanuda de forma idempotente por `(lote, fila)`; el libro no se
considera importado hasta `applied`. Los límites reales de `db.batch()` en D1 no
están verificados en esta sesión y deben medirse antes de fijar el tamaño de tramo.

### D6. Conciliación sin ajustes ocultos

La conciliación compara, por persona y moneda, el saldo del origen (fila de
resumen, si existe) con el que resultaría de lo que se importará, y atribuye la
diferencia a filas excluidas o a supuestos. Si la diferencia no puede atribuirse
a ninguna fila se muestra como «diferencia sin fila atribuible». Jamás se crea un
movimiento de ajuste.

### D7. Incidentes y supuestos de la primera versión

Un incidente es una fila cuyo efecto no puede determinarse con certeza (falta el
efecto de un participante, la suma no es cero, la moneda no es un código válido,
la fecha o el importe no se pueden leer). Resoluciones: cancelar el lote; incluir
la fila con un supuesto explícito (p. ej. completar el efecto faltante para que la
fila sume cero, o leer una moneda mal escrita como la predeterminada); o excluir la
fila. Cada elección queda registrada y aparece en el resumen del lote.

### D8. Privacidad de datos de prueba

Las pruebas usan sólo archivos sintéticos mínimos que demuestren la estructura
necesaria. Los archivos subidos se parsean en memoria y sólo persisten filas y
huella del lote, no el archivo original.

## Risks / Trade-offs

- Exportes con formato distinto al fixture fallarán en la previsualización con un
  error comprensible; se aceptará cada variante con un fixture sintético nuevo.
- Mostrar inferencias de pagador sin rótulo induciría a creer que son dato de
  origen; el rótulo es parte del contrato de interfaz.
- Guardar el efecto por participante duplica información derivable de las partes
  de los movimientos nuevos; se valida en el mismo batch para evitar divergencias.

## Migration Plan

Aditivo: tablas nuevas y dos columnas nulas en `ledger_entries`. Los movimientos
existentes reciben sus `entry_effects` en una migración de relleno verificable
(la suma por moneda de todos los libros debe ser cero antes y después).

## Open Questions

1. **Forma del movimiento importado.** Se propone conservar sólo el efecto y mostrar
   la inferencia como tal. El lienzo hoy muestra «pagó Ana» en tarjetas importadas
   sin rotularlo como inferencia; debería corregirse.
2. **Supuestos disponibles** ante una fila con incidente, más allá de los dos del
   lienzo (completar el efecto de Mateo; leer «COL» como COP).
3. **Tamaño máximo** de archivo y de filas, y qué hace la interfaz al excederlo.
4. **Decimales y locales.** El fixture usa punto decimal y sin separador de miles;
   no se verificó qué emite Splitwise en otros idiomas.
5. **Reimportación incremental.** Fuera de este change; la huella exacta del
   archivo no detecta un export más nuevo del mismo grupo.
6. **Mapeo de personas con nombres ambiguos** (dos columnas casi iguales).
