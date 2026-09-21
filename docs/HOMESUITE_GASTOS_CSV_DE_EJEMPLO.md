# HomeSuite Gastos — CSV de ejemplo de Splitwise

**Estado:** fixture sintético de referencia para diseño y futuras pruebas

**Fecha:** 2026-09-21

El archivo [splitwise-export-example.csv](../test/fixtures/splitwise-export-example.csv)
es un ejemplo creado a mano para conservar la forma observada de un export CSV de
Splitwise. No contiene ninguna fila, nombre, descripción, fecha ni importe de un
export real. Sus participantes son personajes de *Don Quijote*, obra de dominio
público.

## Forma del archivo

| Columna | Tipo y formato | Regla de ejemplo |
|---|---|---|
| `Fecha` | fecha ISO `AAAA-MM-DD` | `2026-01-03` |
| `Descripción` | texto UTF-8 | si contiene una coma, se encierra entre comillas dobles CSV |
| `Categoría` | texto | es información de origen; no impone una taxonomía a HomeSuite |
| `Coste` | decimal positivo con punto | `80000.00`; no usa separador de miles |
| `Moneda` | código ISO 4217 de tres letras | `COP` |
| columnas posteriores | una por participante, encabezada con su nombre en origen | decimal con signo: efecto individual de la fila en su saldo |

Las cinco primeras columnas son fijas. Las columnas de participantes son dinámicas:
un archivo puede tener dos o más, y HomeSuite debe reconocerlas a partir de los
encabezados en vez de asumir los dos nombres de este fixture. En el ejemplo, la
suma de los efectos individuales de cada fila es cero porque hay dos participantes
y cada movimiento conserva el balance neto del grupo.

## Operaciones representadas

Las filas ficticias ilustran gastos compartidos con pagadores alternados, un pago
entre participantes, un ingreso compartido, un adelanto y un pago parcial. Esas
etiquetas viven en `Descripción` o `Categoría`: el importador futuro debe preservar
el efecto firmado de las columnas de participantes y no inventar una obligación,
préstamo o tipo financiero adicional a partir de su texto.

El fixture sirve para la previsualización, el mapeo de participantes y pruebas de
parseo. No sustituye la conciliación contra los saldos que vengan en cada export
ni fija todos los formatos que Splitwise pudiera emitir para otros idiomas,
monedas o números de participantes.

## Privacidad

Los exports personales no entran al repositorio, fixtures, seeds ni bases de
datos de desarrollo. Si aparece una nueva variante de formato, se agrega otro
archivo sintético mínimo que demuestre sólo la estructura necesaria.
