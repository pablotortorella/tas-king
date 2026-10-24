## 1. Datos

- [ ] 1.1 Migración: `search_text` con relleno y el índice `(ledger_id, occurred_on DESC, id DESC)`.
- [ ] 1.2 Función de normalización (mayúsculas, acentos, puntuación) con pruebas unitarias.

## 2. API

- [ ] 2.1 Escritura: mantener `search_text` en crear y corregir movimiento, dentro del mismo `db.batch()`.
- [ ] 2.2 Ruta de búsqueda con términos Y, montos, cursor y conteo total.
- [ ] 2.3 Motivos de coincidencia por término y marca de origen importado.
- [ ] 2.4 Test de conteo de llamadas D1: independiente del número de resultados.

## 3. Interfaz

- [ ] 3.1 Campo de búsqueda con etiqueta accesible y botón para borrar.
- [ ] 3.2 Tarjeta de resultado con motivos resaltados y marca de origen.
- [ ] 3.3 Encabezado «N de M» y paginación.

## 4. Verificación

- [ ] 4.1 Unitarias: acentos, mayúsculas, puntuación y montos.
- [ ] 4.2 Integración: propios e importados en una sola lista, aislamiento entre libros.
- [ ] 4.3 E2E en móvil: buscar por nombre, monto y palabra sobre ambos orígenes.
- [ ] 4.4 Validar OpenSpec en modo estricto, correr pruebas y abrir PR.
