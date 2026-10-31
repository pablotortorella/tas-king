## Purpose

Define cómo se trae a un libro de Cuentas Claras el historial exportado de Splitwise: la revisión previa, la conversión de cada fila en un movimiento equivalente a los que se cargan en la aplicación, la conciliación de saldos y la carga por etapas con publicación atómica.

## ADDED Requirements

### Requirement: La importación se previsualiza antes de escribir movimientos

El sistema SHALL aceptar un CSV con el formato de exportación de Splitwise, de un grupo o de una relación directa, y SHALL mostrar su previsualización sin crear movimientos visibles: personas reconocidas, filas de movimiento, filas de resumen, incidentes y saldos previstos por persona y moneda. Solo la persona titular SHALL poder importar. Cancelar durante la previsualización SHALL descartarla sin dejar movimientos.

#### Scenario: Previsualizar un archivo válido

- **WHEN** la persona titular sube un CSV con 36 movimientos y una fila de resumen
- **THEN** ve 36 filas válidas, 1 fila de resumen y los saldos previstos, y el libro no cambió

#### Scenario: Cancelar la previsualización

- **WHEN** la persona titular cancela
- **THEN** no queda ningún movimiento y la previsualización se descarta

#### Scenario: Un integrante intenta importar

- **WHEN** un integrante que no es titular intenta subir un archivo
- **THEN** el servidor lo rechaza

#### Scenario: Revisión de un archivo grande

- **WHEN** el archivo tiene miles de filas
- **THEN** la previsualización funciona sin depender del tamaño total del archivo y las secciones largas se muestran paginadas

### Requirement: La fila de resumen no se importa como movimiento

El sistema SHALL reconocer la fila de saldos del export, tanto con la etiqueta en la primera celda como con la fecha de exportación en la primera y la etiqueta en la segunda sin coste, y SHALL usarla para conciliar. Una fila con coste NO SHALL tratarse como resumen aunque su descripción sea «Saldo». La fila de resumen NO SHALL guardarse como movimiento.

#### Scenario: Resumen con la fecha en la primera celda

- **WHEN** el archivo termina con una fila de fecha, «Saldo total», importe en blanco y los saldos de cada persona
- **THEN** se reconoce como resumen, no se importa como movimiento y se concilia contra ella

#### Scenario: Movimiento llamado Saldo

- **WHEN** una fila tiene descripción «Saldo» y un coste
- **THEN** se trata como un movimiento común

### Requirement: Las personas del archivo se mapean de forma explícita

Cada persona del archivo SHALL asociarse a una persona existente del libro o a una nueva antes de confirmar. El sistema NO SHALL asociar dos columnas del archivo a la misma persona sin que se confirme. Las personas nuevas SHALL permanecer ocultas hasta la publicación.

#### Scenario: Nombre igual al de una persona del libro

- **WHEN** el archivo trae una columna cuyo nombre coincide con el de una persona del libro
- **THEN** el mapeo la propone y la persona titular la confirma o la cambia

#### Scenario: Persona nueva

- **WHEN** la persona titular elige crear una persona para una columna
- **THEN** esa persona no aparece en el libro hasta que se publica la importación

### Requirement: Cada fila válida se convierte en un movimiento normal con los mismos efectos

Cada fila válida SHALL guardarse como un gasto de la persona titular equivalente a uno cargado en la aplicación: con pagadores, reparto y una revisión inicial, y con el efecto de cada persona idéntico al del archivo. Los pagadores y el reparto SHALL inferirse así: pagan quienes quedan a favor, cada pagador cubre su propia parte para que sus aportes sumen el total, y quienes quedan en contra deben exactamente su efecto. Una fila sin efecto en nadie SHALL guardarse como un gasto pagado y consumido por una misma persona. Una fila cuyos efectos positivos superen el total NO SHALL guardarse: SHALL tratarse como incidente.

#### Scenario: Reparto parejo entre dos personas

- **WHEN** una fila tiene total 100,00 y efectos +50,00 y −50,00
- **THEN** se guarda un gasto de 100,00, pagado por quien tiene +50,00, repartido 50,00 y 50,00, con el efecto original

#### Scenario: Todo a cargo de una persona

- **WHEN** una fila tiene total 100,00 y efectos +100,00 y −100,00
- **THEN** se guarda un gasto de 100,00 pagado por quien tiene +100,00 y asignado por completo a la otra persona

#### Scenario: Varias personas a favor

- **WHEN** una fila tiene dos personas con efecto positivo y una con efecto negativo
- **THEN** se guarda un gasto con dos pagadores cuyos aportes suman el total y cuyos efectos reproducen los del archivo

#### Scenario: Fila sin efecto

- **WHEN** una fila tiene un total mayor que cero y efectos cero para todas las personas
- **THEN** se guarda un gasto pagado y consumido por una misma persona, marcado como inferido

#### Scenario: Efecto mayor que el total

- **WHEN** el efecto positivo de una fila supera su total
- **THEN** la fila se informa como incidente y no se guarda

#### Scenario: El saldo importado es el del archivo

- **WHEN** se publica una importación
- **THEN** el saldo de cada persona en el libro, por la suma de los movimientos importados, es igual al que resulta de los efectos del archivo

### Requirement: Lo inferido se marca y se puede corregir

Un movimiento importado cuyo pagador y reparto fueron inferidos SHALL mostrarse con una marca de inferido en su detalle y en las coincidencias de búsqueda por pagador. Una corrección que cambie el pagador o el reparto SHALL quitar la marca. Los movimientos importados SHALL poder corregirse, anularse y categorizarse igual que los demás, sin distinción de origen.

#### Scenario: Ver la marca

- **WHEN** se abre un movimiento importado
- **THEN** se indica que el pagador y el reparto fueron inferidos y de qué fila del archivo provienen

#### Scenario: Corregir el pagador

- **WHEN** la persona corrige quién pagó un movimiento importado
- **THEN** se crea una revisión y la marca de inferido desaparece

#### Scenario: Anular un movimiento importado

- **WHEN** la persona titular anula un movimiento importado
- **THEN** deja de contar en los saldos, queda visible como anulado y la anulación queda en su historial

### Requirement: Los incidentes indican fila, motivo y resolución

Una fila cuyo efecto no puede determinarse con certeza SHALL señalarse con su número de fila y su motivo. La persona titular SHALL poder excluirla o, cuando solo falta la moneda, usar la moneda predeterminada del grupo. Las filas no afectadas SHALL poder importarse y nada SHALL omitirse en silencio.

#### Scenario: Falta la moneda

- **WHEN** la fila 27 no trae moneda y la persona titular elige usar la del grupo
- **THEN** la fila se importa con ese supuesto, que queda registrado en el resumen del lote

#### Scenario: Fila excluida

- **WHEN** la persona titular excluye la fila 12
- **THEN** la fila no se importa y queda listada como no importada con su motivo

### Requirement: La conciliación compara saldos sin ajustes ocultos

Antes de confirmar, el sistema SHALL comparar por persona y moneda el saldo del resumen del archivo con el que resultaría de la importación y SHALL mostrar las diferencias. El sistema NO SHALL crear movimientos de ajuste para cerrarlas y SHALL exigir una confirmación explícita cuando haya diferencias o falte el resumen. La comparación SHALL hacerse contra los efectos del archivo en el momento de importar; las correcciones posteriores son intencionales y quedan en el historial de cada movimiento.

#### Scenario: Sin diferencias

- **WHEN** el resumen coincide con los efectos importados
- **THEN** la conciliación muestra diferencia cero para cada persona y no pide confirmación adicional

#### Scenario: Diferencia por filas excluidas

- **WHEN** hay filas excluidas
- **THEN** la conciliación muestra la diferencia por persona y exige confirmarla

#### Scenario: Archivo sin resumen

- **WHEN** el archivo no trae fila de saldos
- **THEN** se advierte que no hay saldos para comparar y se exige confirmarlo

### Requirement: La carga es por etapas, reanudable y de publicación atómica

Tras confirmar, la carga SHALL ejecutarse por tandas con un indicador de progreso. Los movimientos y las personas cargados SHALL permanecer ocultos al libro hasta una publicación final que los muestre todos juntos. Si la carga se interrumpe, la persona titular SHALL poder reanudarla desde donde quedó. Cancelar, fallar sin remedio o abandonar la carga por más de un día SHALL descartar todo lo cargado y dejar el libro como estaba.

#### Scenario: Progreso

- **WHEN** se confirma una importación de 2.485 filas
- **THEN** la persona titular ve el avance («importando 1.200 de 2.485») hasta que termina

#### Scenario: Los movimientos no se ven a medias

- **WHEN** la carga va por la mitad
- **THEN** el libro, los saldos, la búsqueda y la exportación no incluyen ningún movimiento de la importación

#### Scenario: Reanudar

- **WHEN** se cierra la pestaña a mitad de la carga y se vuelve a abrir la importación
- **THEN** la carga continúa desde la última fila cargada sin duplicar movimientos

#### Scenario: Publicación atómica

- **WHEN** termina la última tanda
- **THEN** todos los movimientos aparecen en el libro en un único paso y los saldos reflejan la importación completa

#### Scenario: Cancelar

- **WHEN** la persona titular cancela durante la carga
- **THEN** se descarta lo cargado, incluidas las personas y categorías nuevas, y el libro queda como estaba

#### Scenario: Carga abandonada

- **WHEN** una carga pendiente supera un día sin avanzar
- **THEN** el mantenimiento diario la descarta

### Requirement: Importar dos veces el mismo archivo no duplica movimientos

Una importación SHALL identificarse por libro y huella del archivo. Subir otra vez el mismo archivo, reintentar una tanda o repetir la confirmación SHALL producir un único conjunto de movimientos e informar qué ya estaba presente. Un libro SHALL admitir un solo lote publicado.

#### Scenario: Subir el mismo archivo

- **WHEN** se sube un archivo ya importado en el libro
- **THEN** se informa que ya fue importado y no se crean movimientos nuevos

#### Scenario: Reintento de una tanda

- **WHEN** una tanda se envía dos veces por una falla de conexión
- **THEN** los movimientos de esa tanda existen una sola vez

#### Scenario: Segundo archivo distinto

- **WHEN** el libro ya tiene una importación publicada y se intenta publicar otra
- **THEN** el servidor la rechaza e indica que las reimportaciones incrementales no están disponibles

### Requirement: Cada movimiento importado conserva su procedencia

Cada movimiento importado SHALL conservar su lote y el número de su fila de origen, y SHALL conservar la fila cruda del archivo como auditoría. Las listas y el detalle SHALL mostrar «Importado de Splitwise» con ese número. El resumen del lote SHALL conservar supuestos, filas excluidas y conciliación.

#### Scenario: Ver el origen

- **WHEN** se abre un movimiento importado
- **THEN** se muestra el origen, el número de fila y, si hubo, el supuesto aplicado

#### Scenario: Resumen del lote

- **WHEN** se abre el resumen de un lote publicado
- **THEN** se ven la cantidad importada, los supuestos, las filas excluidas y la conciliación

### Requirement: Los comentarios del archivo se importan como nota

Si una fila del archivo trae texto de comentario, el sistema SHALL guardarlo como nota del movimiento, en texto plano, y NO SHALL incorporarlo a la descripción.

#### Scenario: Fila con comentario

- **WHEN** una fila trae un texto de comentario
- **THEN** el movimiento importado lo muestra en su nota y su descripción es la del archivo

### Requirement: Una importación no se solapa con movimientos propios

El sistema SHALL rechazar una importación cuyas filas incluyan fechas iguales o posteriores a la del primer movimiento propio del libro, explicando el corte de fechas, para no contar dos veces un mismo período. Los movimientos importados NO SHALL contar como propios para esta regla.

#### Scenario: Archivo que se solapa

- **WHEN** el libro tiene un movimiento propio del 1 de marzo y el archivo trae filas del 15 de marzo
- **THEN** el servidor rechaza la importación e indica desde qué fecha hay solapamiento

### Requirement: El tamaño máximo se informa con claridad

El sistema SHALL rechazar un archivo que supere el tamaño máximo con un mensaje que indique el límite, antes de procesarlo, y NO SHALL fallar sin explicación en una importación válida de miles de filas.

#### Scenario: Archivo demasiado grande

- **WHEN** se sube un archivo de más de 2 MiB
- **THEN** el servidor lo rechaza e indica el límite de 2 MiB

### Requirement: Las pruebas no usan datos reales

Los fixtures, los seeds y las bases de desarrollo SHALL usar únicamente archivos sintéticos con la estructura mínima necesaria, incluida la forma real de la fila de resumen.

#### Scenario: Nueva variante de formato

- **WHEN** aparece una variante de exportación
- **THEN** se agrega un archivo sintético mínimo que la represente y ningún export personal
