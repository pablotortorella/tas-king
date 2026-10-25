# Caso real de referencia para Cuentas Claras (reporte interno)

Fecha de la medición: 2026-10-24. Sirve para decidir con datos reales qué tamaño, qué formas de reparto y qué casos límite tiene que resolver la herramienta, porque este export es el uso principal previsto del producto.

**Privacidad.** Este documento contiene solo conteos, proporciones y tiempos. No incluye nombres, descripciones, importes, textos de categorías ni fechas exactas. El archivo original vive fuera del repositorio y no se copia. Las pruebas del repo siguen usando datos sintéticos.

**Cómo se midió.** Con el parser y el planificador de importación de la app (`splitwise-csv.js` y `buildImportPlan`) ejecutados en Node, y con `searchLedger` sobre las filas ya parseadas. No se midió en un Worker real ni contra D1: los límites de Cloudflare citados abajo se recuerdan y **no están verificados**.

## 1. Forma del archivo

| Dato | Valor |
|---|---|
| Idioma de las columnas | Español (Fecha, Descripción, Categoría, Coste, Moneda, una columna por persona) |
| Personas | 2 |
| Moneda | Una sola |
| Filas de movimiento | 2.485 |
| Filas de resumen («Saldo total») | 1 (ver el hallazgo de la sección 2) |
| Líneas vacías | 4 (una tras el encabezado y una antes del resumen, entre otras) |
| Incidentes del parser en las filas de movimiento | 0 |
| Antigüedad | 3,5 años, 43 meses con datos |
| Orden | Ascendente por fecha |
| Peso del CSV | unos 180 KB, 73 bytes por fila |
| Descripciones con coma o comillas | 31 (se leen bien) |
| Descripciones con emoji | 15 (se leen bien) |
| Descripción más larga | 59 caracteres (el límite de la app es 240) |
| Filas repetidas exactas (fecha, descripción e importe) | 1 clave, 2 filas: duplicados legítimos posibles; no hay que deduplicar por contenido |

**Ritmo.** 58 filas por mes en promedio (mínimo 31, máximo 87) y hasta 11 en un día. Por año: 512 en 2023 (desde abril), 585 en 2024, 745 en 2025 y 644 en 2026 hasta octubre. Esto da unas 770 por año, así que se llega a unos 4.000 movimientos a fines de 2028 y a unos 5.000 hacia fines de 2029.

## 2. Hallazgo crítico: la fila de resumen no se reconoce

El export real trae la fila de saldo con la **fecha de exportación en la primera celda** y «Saldo total» en la segunda, con el importe y la moneda en blanco o en celdas con espacios y los saldos en las columnas de las personas. El detector actual (`isSummary` en `splitwise-csv.js`) solo reconoce «saldo total» en la **primera** celda o con la primera vacía, que es la forma del fixture sintético y de la E2E.

Consecuencias comprobadas con el archivo real:

- El parser informa **0 filas de resumen** y **1 movimiento de más**, con importe 0 y dos efectos distintos de cero.
- El plan advierte «el archivo no incluye una fila de saldos para comparar», así que **la conciliación no corre**.
- Si se confirmara, los saldos importados quedarían **duplicados**: la fila colada vale exactamente lo que deberían valer los saldos reales (la suma de las 2.485 filas reales coincide con el resumen).

**Estado:** corregido en el PR #92 (pendiente de integrar). Con el arreglo, el mismo archivo da 0 filas de más, 1 resumen, 0 advertencias y diferencias de conciliación en cero para las dos personas; sin él, fallan las 3 pruebas nuevas. Hay que integrarlo antes de importar datos reales. La prueba debe usar un CSV sintético de la misma forma: fecha en la primera celda, descripción «Saldo total», importe y moneda en blanco, saldos opuestos en las columnas de las personas. Conviene reconocer también las variantes en inglés («Total balance») y exigir que el resumen no se importe nunca como movimiento.

## 3. Cómo se reparte

| Patrón | Filas | Proporción |
|---|---|---|
| Mitad y mitad | 2.378 | 95,7 % |
| 100 % a una persona (pagos o préstamos cargados como gasto) | 103 | 4,1 % |
| Otro reparto | 4 | 0,2 % |
| Sin efecto en ninguna persona | 1 | 0,04 % |

- Quién queda a favor está equilibrado: 47 % la primera persona y 53 % la segunda. En esta pareja quien paga va alternando, por lo que mostrar «quién pagó» o «a favor de» tiene valor real al buscar.
- De los 103 repartos al 100 %, 26 están a cargo de la primera persona y 77 de la segunda. Se distinguen por estructura (un efecto igual al total), sin mirar el texto, lo que no contradice la regla de no clasificar filas por su descripción.
- **Centavos.** Solo el 0,6 % de los totales tiene centavos, pero el 15 % de las filas tiene medios pesos en los efectos (381 filas, por dividir totales impares). La moneda necesita **dos decimales**.
- El export arrastra un saldo de la planilla anterior como un gasto común en la primera fila. Con este uso, la «apertura con saldos» no es necesaria.

## 4. Categorías

- 41 categorías distintas, 1 sola con una única fila y 6 con sufijo «- Otro» (subcategorías genéricas).
- La categoría genérica concentra el 34 % de las filas y las 6 más usadas cubren el 72 %.
- Hoy la app guarda la categoría de los importados, la busca y la muestra solo en el detalle. No aparece en la lista, no se puede filtrar y los movimientos propios no tienen categoría.

## 5. Repetición

33 descripciones aparecen al menos 6 veces y cubren 415 filas, el 17 % del total. Son cobros periódicos (suscripciones y servicios) que se cargan a mano cada mes. Es una oportunidad futura (movimientos recurrentes) y queda fuera del alcance actual.

## 6. Escala y rendimiento

Mediciones con las 2.485 filas ya parseadas, en Node y sin red:

| Consulta de búsqueda | CPU |
|---|---|
| Una palabra frecuente | 131 ms |
| Dos palabras | 391 ms |
| Un nombre de persona | 92 ms |
| Un importe | 137 ms |
| Una categoría | 128 ms |
| Sin coincidencias | 131 ms |

- **La búsqueda es lo caro.** Cada consulta normaliza todos los textos y formatea todos los importes, y la de dos palabras repite el trabajo (frase completa y luego cada término). Un prototipo que normaliza una sola vez por petición baja unas 100 veces (medido en datos sintéticos con reglas simplificadas; hay que conservar el comportamiento actual con pruebas).
- **Derivar los efectos es barato:** 13 ms con 5.000 movimientos y 24 ms con 15.000 (datos sintéticos).
- **Lectura de D1.** Cada vista lee hoy todo el libro: unas 7.500 filas con estos datos (3 por movimiento importado). Es aceptable ahora; a ~5.000 movimientos serían unas 15.000 por vista.
- **Buscar un nombre de persona devuelve los 2.485 movimientos.** Con dos personas, todo movimiento involucra a ambas, así que la coincidencia por participante no filtra nada.

## 7. Importación a esta escala

- 7.456 sentencias de escritura, en unos 125 lotes de 60, cada uno en su propia transacción. La importación **no es atómica**: se apoya en un lote «pendiente» que se limpia si falla. La cantidad de llamadas puede chocar con el límite de subconsultas por petición de Cloudflare (**no verificado**) y tarda varios segundos.
- La vista previa guarda el CSV parseado completo en una sola fila de D1: 650 KB para estas 2.485 filas, unos 262 bytes por fila. Si D1 limita las filas a 2 MB (**no verificado**), el techo práctico es de unas 7.600 filas, mucho antes del tope de 2 MiB del archivo (unas 28.500 filas con este formato). Un archivo mayor fallaría sin un mensaje claro.
- No hay incidentes en el archivo (salvo el resumen), así que el flujo de decisiones por fila no se ejercita con este caso.

## 8. Qué informa esto

| Decisión | Qué dice el caso real | Estado |
|---|---|---|
| Modelo de efectos (`entry_effects`) | Derivar efectos es barato; el costo está en la búsqueda y en la lectura completa del libro, no en el almacenamiento | **Decidido en el explore:** conservar los dos caminos, sin `entry_effects` |
| Búsqueda | 90–390 ms por consulta hoy; con índice por petición debería bajar mucho | A confirmar: arreglo en JavaScript primero, SQL con umbral medible |
| Paginación en SQL | A 2.500 filas no urge; se acerca a ~5.000 en unos tres años | Diferida, con una medición como disparador |
| Importación | Necesita prueba a escala y mensajes claros de límite; hoy no es atómica | A decidir: atomicidad y manejo de errores |
| Fila de resumen | Defecto que bloquea la conciliación | Corregido en el PR #92; falta integrarlo |
| Decimales de COP | Hacen falta dos | Resuelto por evidencia |
| Categoría | Existe pero es poco visible, y un tercio es genérica | A decidir: mostrarla en la lista, catálogo para movimientos propios, filtros |
| Buscar por persona | Con dos personas devuelve todo | A decidir qué significa buscar por persona |
| Repartos al 100 % | 4 % de las filas; detectables por estructura | A decidir si se rotulan |
| Apertura con saldos | No hace falta para este caso | Diferir |
| Movimientos recurrentes | 17 % de las filas | Fuera de alcance por ahora |

## 9. Pendiente de verificar

- Límites de D1 y de Workers (tamaño de fila, subconsultas por petición, CPU por petición) en el plan que se use.
- Formato de la fila de resumen en otros idiomas y otras versiones de Splitwise (solo se vio el español).
- Una importación de 2.485 filas contra D1 local, con un CSV sintético de la misma forma.
- Que el arreglo de la búsqueda conserve exactamente las coincidencias actuales.
