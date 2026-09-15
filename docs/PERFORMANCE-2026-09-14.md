# Comprobación de performance posterior a v2.2.0 — 2026-09-14

## Alcance y método

Pablo ejecutó tres rondas en su tablero habitual de producción: crear una tarjeta con solo
título, editar el título, asignar y quitar una etiqueta existente. Se usó Chromium con
Performance y capturas activadas, sin limitación artificial de CPU/red. La captura de
`wrangler tail tas-king --format json` se cruzó con las peticiones de cada grabación.

Las escrituras quedaron registradas entre 19:27:45 y 19:34:50, America/Bogota
(00:27:45–00:34:50 UTC del 15 de septiembre). Se pidieron pausas de 15 segundos desde cada
cambio visible para separar acciones y sincronización; no se trataron como intervalos exactos
ni controlados. La captura del Worker se cerró al terminar. No se desplegaron cambios durante
la medición. Se detuvo en tres rondas por decisión del usuario: más muestras no eran necesarias
para elegir el siguiente trabajo.

## Resultados

| Acción | Servidor R1 / R2 / R3 (ms) | Mediana servidor (ms) | Petición Chromium R1 / R2 / R3 (ms) | Mediana petición (ms) |
|---|---|---:|---|---:|
| Crear | 711 / 665 / 654 | 665 | 872,7 / 880,9 / 857,0 | 872,7 |
| Editar | 1859 / 618 / 639 | 639 | 2140,8 / 924,0 / 845,7 | 924,0 |
| Asignar etiqueta | 491 / 485 / 488 | 488 | 606,6 / 590,9 / 609,6 | 606,6 |
| Quitar etiqueta | 399 / 399 / 399 | 399 | 530,4 / 609,3 / 612,7 | 609,3 |

Las 12 escrituras respondieron HTTP 200. La CPU del Worker por escritura fue de 3–10 ms;
`cf.colo` fue MIA, que identifica el punto de entrada y no la ubicación de D1. La edición de
la primera ronda tardó 1859 ms en servidor; las siguientes fueron 618 y 639 ms. No se descartó
la observación lenta ni se le atribuyó una causa específica sin evidencia.

## Qué se comprobó

- Cada acción usó una escritura en el flujo inmediato. Las tres lecturas globales de tarjetas,
  etiquetas y objetivos ocurrieron después. Las pilas de llamadas de Chromium muestran
  `pollTick → loadCards` como origen de la lectura de tarjetas, seguida de etiquetas/objetivos.
- No se eliminó ese tráfico de fondo: se quitó del camino obligatorio de guardado. No hubo
  relectura individual de tarjeta en estos guardados simples. Abrir el modal pidió el historial.
- La latencia del servidor sigue siendo relevante y excede ampliamente su tiempo de CPU.
  Esta evidencia no permite atribuirla a una consulta D1 específica.

## Decisión

Aplicar primero patrones respaldados por la revisión de código: agrupar preparación de
usuario/rol, reutilizar la identidad ya verificada y eliminar la consulta por cada checklist.
Proteger esos costos con tests automáticos. Si persisten demoras, instrumentar etapas del
backend para elegir la siguiente optimización. Ver [el criterio de performance](PERFORMANCE-PRACTICES.md).

## Limitaciones

- Una sesión, un tablero, un navegador y tres muestras por acción. Las medianas son
  descriptivas; no representan un p95 ni permiten generalizar a otros entornos.
- Servidor es la duración del middleware; Chromium es `ResourceSendRequest → ResourceFinish`.
  Ninguno equivale a clic/Enter hasta el cambio visible.
- Se leyeron las tres grabaciones y se extrajeron las peticiones. Al completar el análisis,
  los archivos originales ya no estaban en las rutas compartidas; no se completó la inspección
  visual. La medición de acción a pantalla sigue pendiente, sin bloquear mejoras estructurales.
- La línea base de 1,8–2,1 s del [11 de septiembre](PERFORMANCE-2026-09-11.md) incluía escritura
  y tres recargas reconstruidas de logs. No comparar directamente ese valor con una petición
  de esta tabla para anunciar un porcentaje de mejora percibida.
- No se midieron guardados con adjuntos, checklists u objetivos ni tableros grandes. El
  beneficio de la consulta de ítems se prueba estructuralmente, no con estos tiempos.

El informe conserva los valores agregados. No se incorporan al repositorio las grabaciones
con contenido del tablero, cookies, cabeceras ni logs con identidad de usuario.
