# Importar Splitwise en Cuentas Claras

**Estado:** implementado en `feature/homesuite-splitwise-import`; sin despliegue.

## Recorrido

1. En el grupo, el titular abre **Importar Splitwise** y selecciona un CSV
   exportado para ese grupo o relación directa.
2. HomeSuite muestra participantes, movimientos válidos, incidentes por número
   de fila, filas de resumen y saldos calculados antes de confirmar.
3. El titular relaciona cada nombre del archivo con un participante existente o
   crea uno nuevo. Ante cada incidente elige excluir la fila; si únicamente falta
   la moneda, puede asumir explícitamente la moneda predeterminada del libro.
4. La revisión muestra los movimientos que se guardarán, los supuestos, las filas
   excluidas y la diferencia entre los saldos fuente e importados por moneda.
5. El titular confirma. Una diferencia o la ausencia de saldo fuente exige
   reconocimiento explícito. HomeSuite no crea ajustes ocultos.

Un **incidente** es una fila que no puede importarse automáticamente, por
ejemplo porque no indica moneda, contiene una fecha imposible o sus efectos no
suman cero. La pantalla muestra el número de fila y el motivo. Sólo la ausencia
de moneda admite usar explícitamente la moneda predeterminada; los demás casos
se excluyen y esa decisión queda registrada en el lote.

Un movimiento importado guarda fecha, descripción, categoría, coste, moneda,
fila original, lote y efectos firmados por participante. Se muestra en la misma
cronología, búsqueda, balance y exportación que los movimientos nuevos. Una
inferencia incierta sobre pagador o reparto no reemplaza los efectos originales.

La [ayuda oficial de Splitwise](https://kb.splitwise.com/account-issues/how-do-i-export-my-splitwise-data)
explica que las cifras bajo cada persona representan el efecto sobre su saldo,
y que `Cost` es el total de la transacción.

## Límites de esta entrega

- CSV de hasta 2 MiB, con las cinco columnas base en español o inglés y después
  una columna por participante. Se admiten las monedas de Sudamérica (ARS, BOB,
  BRL, CLP, COP, FKP, GYD, PEN, PYG, SRD, UYU y VES), MXN, USD, EUR, JPY y KWD,
  con 0, 2 o 3 decimales según ISO 4217.
- Una importación confirmada por libro. Repetir exactamente el mismo archivo
  devuelve el lote existente; archivos incrementales distintos se bloquean para
  impedir solapamientos hasta diseñar una reimportación controlada.
- Si ya hay movimientos propios, todas las filas importadas deben ser anteriores
  al primer movimiento propio vigente. El sistema rechaza un período solapado.
- Las previsualizaciones vencen en una hora y el mantenimiento diario elimina las
  vencidas. Una importación interrumpida queda invisible hasta confirmarse; los
  lotes pendientes antiguos se purgan al día siguiente.
- El resumen de Splitwise puede omitir moneda. Se compara si el archivo contiene
  una sola; con varias monedas se informa que no es comparable.

El [CSV sintético de referencia](../test/fixtures/splitwise-export-example.csv)
ilustra la forma esperada. No se almacenan exports personales en el repositorio ni
en fixtures de prueba.
