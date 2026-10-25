# Decisiones del explore de Cuentas Claras (2026-10-24)

Registro de lo decidido en la conversación de `/opsx:explore` sobre el modelo de efectos, la importación, las categorías, la búsqueda y los repartos. Se apoya en [CASO-REAL-INTERNO.md](CASO-REAL-INTERNO.md) (cifras de un export real, sin datos personales) y en [ANALISIS-APLICACION.md](ANALISIS-APLICACION.md) (cuatro changes contra el código real). Los ejemplos de este documento son inventados.

Cada decisión indica **qué se decidió**, **por qué** y **qué implica**. «Confirmada» significa que la persona titular del producto la aceptó expresamente en la conversación.

## 1. Modelo de datos

### D1. Los movimientos importados son movimientos normales — confirmada

Un movimiento importado es un movimiento como cualquier otro: tipo, pagadores, reparto, revisiones, anulación, corrección y categoría. Lo único que lo distingue es su procedencia (lote y número de fila).

- **Por qué.** Se quiere que cualquier movimiento se pueda corregir o anular sin distinguir su origen, y que el histórico previo a la importación sea equivalente a lo que se cargue después.
- **Reemplaza.** La decisión D2 del change `importacion-splitwise-inicial` («el efecto firmado es el dato y el pagador es una anotación»), la tabla de efectos de importación (`splitwise_import_effects`) y la idea de editar solo una capa descriptiva con historial aparte.
- **Implica.** Un solo camino de almacenamiento. No se crea la tabla `entry_effects` (se decidió antes y sigue en pie: derivar los efectos es barato). Los datos de importaciones de prueba ya existentes en entornos de desarrollo o staging se convierten o se descartan.

### D2. Regla de conversión de una fila a movimiento — confirmada

El archivo de Splitwise trae el efecto neto de cada persona, no quién pagó ni cómo se repartió. Se infiere así, y todo lo inferido se marca como **inferido** y es editable:

- Tipo: gasto.
- Pagan quienes quedan **a favor** (efecto positivo). Cada pagador paga su efecto más su propia parte; las partes propias de los pagadores suman el total menos la suma de los efectos positivos (se reparten en proporción al efecto y el residuo va al último).
- Quienes quedan **en contra** deben exactamente su efecto.
- Fila sin efecto en nadie (un gasto que no mueve saldos): lo paga y lo consume la misma persona; se elige una y se marca como inferido.
- Si la suma de los efectos positivos supera el total, la fila no es representable como gasto y se trata como incidente.
- Un reparto al 100 % a una persona es indistinguible de una transferencia. Se carga como gasto inferido, y una limpieza posterior puede proponer convertirlo en transferencia.
- El efecto original queda **exacto por construcción**. Se conserva además la fila cruda como auditoría de origen.

**Evidencia.** Con un export real de unas 2.500 filas y dos personas, el 100 % de las filas se convierte en un gasto normal con los mismos efectos, comprobado con el validador de la propia app. Se necesita una prueba de propiedad para el caso general (cualquier cantidad de personas).

### D3. Un solo camino de almacenamiento y sin `entry_effects` — confirmada

Los efectos se siguen derivando al leer a partir de partes y asignaciones. A los volúmenes de este caso la derivación cuesta menos de 25 ms con 15.000 movimientos (datos sintéticos). El costo real está en otra parte (ver D8).

## 2. Importación

### D4. Importación por etapas, reanudable y de publicación atómica — confirmada

```
 1. Subir el CSV  -> revisión (personas, incidentes, saldos a conciliar)
 2. Confirmar     -> carga por tandas de unas 300 filas, con progreso
                     ("importando 1.200 de 2.485"); los movimientos
                     permanecen ocultos al libro mientras dura
 3. Publicar      -> todos aparecen juntos; si se cancela o falla, se
                     borra lo cargado y el libro queda como estaba
```

- La carga es idempotente por (lote, número de fila): se puede reintentar sin duplicar.
- Los lotes abandonados los limpia el cron diario que ya existe.
- La vista previa se guarda **por fila** y no como un único bloque: desaparece el techo de unas 7.600 filas (si D1 limita las filas a 2 MB, no verificado) y la revisión puede paginar.
- La conciliación compara contra el archivo **en el momento de importar**. Las ediciones posteriores son intencionales y quedan en el historial.
- Con D1 cada fila pasa de 3 a unas 5–6 sentencias de escritura (movimiento, revisión inicial, partes y reparto).

### D5. La fila de resumen debe reconocerse — defecto, no decisión

El export real trae «Saldo total» en la **segunda** celda y la fecha de exportación en la primera. El detector actual solo reconoce la forma sin fecha, así que hoy esa fila se importaría como un movimiento de importe 0 con efectos grandes y la conciliación no correría. Se corrige con una prueba antes de importar datos reales, reconociendo también las variantes en inglés y garantizando que el resumen nunca se importe como movimiento.

### D6. Comentarios del archivo — confirmada

El export actual no trae columna de comentarios. Si algún export la trae, su texto se importa como **nota** del movimiento (campo de hasta 1.000 caracteres), no en la descripción.

### D7. Punto de partida del grupo — confirmada

La elección va en el formulario de creación: «Empezar en cero» (por defecto), «Traer de Splitwise» (lleva directo a importar) y «Saldos anteriores» (deshabilitada, «próximamente»). Un saldo de arranque se carga hoy como un movimiento normal. El libro vacío muestra un botón grande para agregar el primer movimiento y la opción de traer el historial, y solo mientras no hay movimientos (modo onboarding). Se mantiene el test existente, que pasa con la opción por defecto.

## 3. Búsqueda y lista

### D8. Búsqueda: arreglo en JavaScript y SQL diferido — confirmada

- Ahora: normalizar los textos una sola vez por petición (de 90–390 ms a pocos milisegundos con el export real) y mantener «Ver más» de a 40. El arreglo debe conservar exactamente las coincidencias actuales, con pruebas.
- Más adelante, solo si se cumple alguno de estos disparadores: SQL con paginación real y saldos agregados cuando el libro supere **5.000 movimientos** (a ritmo de unos 770 por año, hacia fines de 2029) o cuando abrir el libro supere **300 ms de CPU** medidos en uso real.

### D9. Buscar por persona — confirmada

Con dos personas, buscar un nombre devolvía todos los movimientos. Se usan **dos criterios con rótulos distintos**: «Pagó X» (con una insignia **inferido** si el pagador fue deducido en una importación) y «Participa X». En transferencias: «Entregó X» y «Recibió X».

### D10. Tras guardar, corregir o anular — confirmada

Se vuelve a la **lista** con un mensaje de éxito y una franja transitoria «Recién agregado» arriba, que muestra el movimiento afectado aunque su fecha sea antigua. La lista mantiene su orden por fecha. La página de detalle sigue disponible desde la lista. Cambia el comportamiento que hoy fijan dos pruebas E2E (registrar, corregir y anular, y la de diseño), que hay que actualizar.

## 4. Categorías

### D11. Tabla de categorías por grupo — confirmada

- Cada grupo (hogar) tiene su propia tabla de categorías con nombre, grupo (padre), ícono y estado. Los movimientos apuntan a una categoría.
- **Lista inicial propia**, inspirada en el catálogo de Splitwise (43 categorías en 7 grupos: Casa, Comidas y bebidas, Entretenimiento, Sin categoría, Transporte, Utilidades y Vida) y mejorada. Se copia al crear el grupo.
- **Normalización de nombres:** se ignoran mayúsculas, acentos y espacios sobrantes para evitar duplicados. Se muestra el nombre tal como se escribió la primera vez. Hay unicidad por (grupo, nombre normalizado).
- Al importar se reconocen las categorías por nombre normalizado y se crean las que falten. Las subcategorías «Otro» llegan aplanadas al export («Casa - Otro»): se reconstruye su grupo desde el nombre.
- Renombrar, fusionar y reagrupar son cambios sobre una sola fila de la tabla; una categoría fusionada puede quedar como alias de la nueva.
- **Mejoras a trabajar en una pasada propia** sobre el contenido de la lista: suscripciones, servicio doméstico, viajes, ingresos por alquiler, pagos entre integrantes y la ubicación de Hotel y Seguro.
- Se evitó acoplar el producto a la lista de Splitwise: el export localiza los nombres según el idioma y la lista oficial no pudo verificarse con una fuente estable.

### D12. Recategorización masiva — confirmada

Una **operación de fondo** aplica una categoría a un conjunto de movimientos, con auditoría y un identificador de lote para **deshacer** el lote completo. Se dispara desde:

1. **Selección sobre una búsqueda** (primera versión).
2. **Clasificar rápido**: un movimiento por vez, con sugerencia si la hay y atajos de teclado (primera versión).
3. Asistente de consistencia («la misma descripción tiene varias categorías»): segunda etapa.
4. Reglas automáticas: más adelante.

**Evidencia.** En el export real alrededor de un tercio de las filas tiene la categoría genérica, y solo el 23 % de ellas comparte descripción con otra; sugerir por palabras acierta el 94 % cuando sugiere, pero solo cubre el 22 % de esas filas. Quedan unas 650 decisiones manuales: la herramienta tiene que hacerlas rápidas, no pretender automatizarlas.

## 5. Repartos

### D13. Métodos de reparto — confirmada

| Método | Datos | Regla |
|---|---|---|
| Igual | Quiénes participan | Partes iguales |
| Importes exactos | Un importe por persona | Deben sumar el total |
| Porcentajes | Un % por persona | Deben sumar 100 |
| Partes | Un número de partes por persona (por defecto 1) | Proporcional a las partes |
| **Algunos fijos + el resto en partes iguales** | Importe fijo para algunas personas | Quien tiene fijo paga solo ese importe; el resto (total menos fijos) se reparte en partes iguales entre quienes no tienen fijo. Se rechaza si los fijos superan el total |
| Atajo «lo debe todo una persona» | La persona | Todo el importe a esa persona |

- **Residuo de centavos:** método del mayor resto; los empates se resuelven por orden estable de persona. La vista previa lo muestra («queda 1 centavo para X»).
- **Una sola regla** que corre igual en el servidor y en la vista previa del navegador, para que nunca muestren números distintos.
- Cada movimiento **guarda el método y los datos de entrada** en su revisión para reabrirse tal como se cargó.
- El «por ajuste» de Splitwise se descartó a favor de la variante «algunos fijos»: es más clara y cubre el caso del consumo individual. El «reembolso» de Splitwise ya lo cubre el tipo Ingreso; el itemizado queda para más adelante.

## 6. Cambios de OpenSpec propuestos

Orden recomendado (cada uno se apoya en el anterior):

1. `repartos-del-libro`: D13. Autónomo.
2. `categorias-del-libro`: D11.
3. `importacion-como-movimientos`: D1, D2, D4, D5, D6 y D7. Reemplaza el borrador `importacion-splitwise-inicial`.
4. `recategorizacion-masiva`: D12.
5. `lista-y-busqueda-del-libro`: D8, D9 y D10. Actualiza el borrador `busqueda-movimientos-unificada`.

Los borradores `libro-y-saldos-cuentas-claras` y `colaboracion-y-exportacion-del-libro` se reconcilian con el código real más adelante: proponen una API `/api/expenses` y concurrencia por revisión del libro que el código no tiene.

## 7. Aplazado

Comentarios en un movimiento (segunda etapa), nombre corto del producto, saldos anteriores como asistente, itemizado, movimientos recurrentes, conversión en bloque de pagos al 100 % en transferencias, asistente de consistencia, reglas de categorización, reenviar invitación, desactivar participantes y archivar con saldos como cierre de ciclo.

## 8. Pendiente de verificar y riesgos

- Límites de D1 y de Workers (tamaño de fila, subconsultas y CPU por petición) en el plan que se use.
- Formato de la fila de resumen en otros idiomas y versiones de Splitwise.
- La fórmula del reparto «por ajuste» de Splitwise no se pudo confirmar; no es necesaria porque se eligió otra variante.
- La prueba de propiedad de la conversión de filas para más de dos personas.
- Una importación completa de 2.485 filas por etapas contra D1 local con un CSV sintético de la misma forma.
- Migraciones nuevas (categorías y partes de importados) pueden chocar en numeración con otras ramas.

## 9. Correcciones hechas durante el explore

- Se afirmó al inicio que el modelo de efectos condicionaba los comentarios y la atribución de diferencias en la importación. No es cierto: los comentarios se enganchan al id del movimiento y la atribución sale de las filas del archivo.
- La estimación de lectura de D1 por vista (6 filas por movimiento) era pesimista: con dos personas son unas 3.
- La primera propuesta de editar los importados «en una capa aparte» quedó sin efecto por D1.
