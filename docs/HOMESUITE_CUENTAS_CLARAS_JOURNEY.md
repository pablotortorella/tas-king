# HomeSuite Cuentas Claras — User Journey de entrada y migración

**Estado:** validado como guía de producto; Story Map y backlog separados

**Fecha:** 2026-09-21

## Persona, situación y resultado

Una persona ya coordina cuentas compartidas en Splitwise y quiere pasar su grupo
familiar a HomeSuite sin perder el sentido de los movimientos ni la confianza en
los saldos. Después seguirá registrando gastos, ingresos compartidos (por ejemplo,
un alquiler) y transferencias entre participantes.

El momento de éxito no es solo «se cargó el archivo»: cada integrante puede
reconocer su saldo por moneda, entender qué movimientos lo explican y continuar
usando el grupo sin volver a Splitwise.

## Tres puntos de partida permitidos

1. **Traer movimientos de Splitwise.** La persona carga un CSV del formato de
   exportación de Splitwise, sin importar si proviene de un grupo o una relación
   directa. Revisa cómo quedará antes de confirmar. Se incorporan todas las
   líneas válidas, con procedencia y efecto exacto en el saldo. Las inferencias
   sobre pagador o reparto no sustituyen ese dato original.
2. **Empezar en cero.** No hace falta inventar un movimiento de apertura; todos
   los participantes comienzan con saldo neto cero en cada moneda.
3. **Empezar con saldos no cero.** La persona registra una apertura con fecha,
   participantes e importes por moneda. Es un hecho inicial auditable, no una
   edición libre del saldo actual. La suma de posiciones iniciales debe ser cero
   por moneda: si alguien comienza en +100, otras posiciones suman -100.

También es posible traer solo movimientos posteriores a una apertura, siempre
que haya un corte temporal claro. Importar toda la historia y además cargar sus
saldos finales como apertura duplicaría el dinero: el flujo debe impedirlo o
advertirlo antes de confirmar.

## Recorrido propuesto para discutir

| Momento | Qué intenta hacer la persona | Qué necesita ver para confiar | Riesgo o fricción |
|---|---|---|---|
| Decide cambiar | Dejar Splitwise sin perder su grupo | Opciones claras: importar, empezar en cero o cargar apertura | Creer que debe reconstruir todo a mano |
| Prepara el punto de partida | Exportar el grupo o anotar saldos y fecha de corte | Instrucciones breves y alcance de cada opción | Olvidar movimientos fuera del grupo o una moneda |
| Reconoce a las personas | Vincular nombres del origen con participantes, invitar a una persona y confirmar su acceso | Vista de correspondencias y una invitación aceptada | Duplicar personas por nombres o emails distintos |
| Revisa antes de guardar | Ver cantidad de movimientos y saldo resultante, sin revisar cada línea | Comparación con el saldo de origen; incidentes con número de fila y motivo | Omitir silenciosamente líneas o contar dos veces la historia |
| Decide ante un incidente | Cancelar, resolver con un supuesto explícito o importar sólo el subconjunto seguro | Qué filas cambiarán, cuáles quedarán fuera y efecto de cada alternativa | Alterar o excluir dinero sin que sea visible |
| Confirma el inicio | Guardar todas las líneas válidas o el subconjunto elegido | Resumen del lote, filas no importadas, supuestos y procedencia localizable | Reintentos que duplican movimientos; apertura solapada |
| Empieza a usarlo | Cargar un gasto, un ingreso o una transferencia nuevos | Saldo actualizado e historial único que distingue origen | Separar importados de nuevos en dos productos inconexos |
| Gana confianza | Usar búsqueda libre; consultar, corregir y exportar | Resultados conjuntos por texto, nombres y montos, con marca «Importado» | No encontrar una operación antigua |

Este journey describe la experiencia; no decide aún pantallas, esquema de datos ni
orden de implementación. El Story Map posterior tendrá una columna por actividad
y cortes verticales de entrega, empezando por el reemplazo usable de Splitwise.

## Reglas de confianza que emergen del recorrido

- Previsualizar y conciliar antes de escribir; nunca asumir que un archivo válido
  técnicamente representa un saldo correcto.
- Un incidente se muestra con el número de fila del archivo, su motivo y la
  alternativa elegida. La persona puede cancelar, resolverlo con un supuesto
  explícito o importar sólo las filas no afectadas; las omitidas quedan listadas
  claramente en el resumen. Una diferencia global que no pueda atribuirse a una
  fila se presenta como tal, sin inventar una causa.
- Mantener separado el balance de cada moneda y exigir suma cero por moneda.
- Evitar duplicados si se carga dos veces el mismo archivo o se reintenta una
  importación; mostrar qué ya estaba presente.
- Conservar fecha, descripción y procedencia de cada línea importada. Si no se
  puede reconstruir con certeza su pagador o reparto original, mantener su
  efecto exacto sin bloquear la importación ni inventar un tipo equivalente.
- Historial y búsqueda reúnen movimientos importados y propios; la marca de
  origen es visible en cada resultado importado.
- La búsqueda inicial es un único campo libre: normaliza mayúsculas, acentos y
  puntuación, y encuentra palabras en textos y participantes, además de montos
  —total y efecto individual—. Los resultados explican qué coincidió.
- Una apertura no cero y los movimientos importados pueden coexistir solo cuando
  representan períodos distintos. El balance actual sigue derivándose de hechos
  auditables; nunca se edita directamente.
- Comparar saldos netos por participante y moneda, no obligaciones entre pares:
  HomeSuite no conserva una entidad deuda por cada movimiento.

## Decisiones y preguntas que quedan abiertas

1. ¿Qué fecha de corte te resultaría natural para cambiar: hoy, inicio de mes o
   después de saldar un período?
2. ¿Cuándo conviene mostrar por defecto una inferencia de pagador o reparto para
   un movimiento importado, y cómo se indica que es una inferencia?
3. ¿Qué supuestos concretos permitiremos en la primera versión para resolver una
   fila con incidente, además de corregir el mapeo de una persona?

El diseño y las pruebas usarán datos sintéticos, nunca archivos privados en el
repositorio. [Splitwise explica la exportación por grupo o relación y el signo de
las columnas de balance](https://kb.splitwise.com/account-issues/how-do-i-export-my-splitwise-data);
también ofrece backup JSON a usuarios Pro. Su
[API pública documenta grupos y movimientos](https://dev.splitwise.com/), pero
una conexión directa no es requisito de este primer recorrido.

## Documentos relacionados

- [Brief de exploración](HOMESUITE_CUENTAS_CLARAS_EXPLORACION.md)
- [Especificación funcional inicial](HOMESUITE_CUENTAS_CLARAS_MVP.md)
- [User Story Map](HOMESUITE_CUENTAS_CLARAS_STORY_MAP.md)
- [Versión visual navegable](../visual/journey.html) · [PDF para revisión](../visual/journey.pdf)
