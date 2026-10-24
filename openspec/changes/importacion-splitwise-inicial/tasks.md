## 1. Modelo de datos

- [ ] 1.1 Migración: `entry_effects` con relleno de movimientos existentes y verificación de suma cero por libro y moneda.
- [ ] 1.2 Migración: `import_batches`, `import_rows`, `import_assumptions` y columnas de procedencia.
- [ ] 1.3 Cambiar el cálculo de saldos y explicación para agregarse desde `entry_effects`.

## 2. Parser y previsualización

- [ ] 2.1 Parser CSV con columnas fijas y participantes dinámicos; separar filas de movimiento y fila de resumen. Pruebas con el fixture sintético.
- [ ] 2.2 Validaciones por fila con número de fila original y motivo (fecha, importe, moneda, suma de efectos).
- [ ] 2.3 Conteos y saldos previstos por moneda.
- [ ] 2.4 Mapeo de personas: existente, nueva o corregida; impedir duplicados.

## 3. Incidentes, conciliación y confirmación

- [ ] 3.1 Resoluciones cancelar, supuesto explícito y excluir, con registro de autor.
- [ ] 3.2 Conciliación por persona y moneda, con diferencia atribuible o «sin fila atribuible».
- [ ] 3.3 Confirmación idempotente por `(libro, huella)`, aplicación en tramos reanudables.
- [ ] 3.4 Resumen del lote: conteos, supuestos y filas no importadas.

## 4. Interfaz

- [ ] 4.1 Punto de partida: importar o empezar en cero (sin opción de saldos anteriores).
- [ ] 4.2 Pantalla de importación: pasos, mapeo, incidentes, conciliación, confirmar y cancelar sin guardar.
- [ ] 4.3 Movimientos importados con procedencia («Importado de Splitwise · fila N») y la inferencia rotulada.

## 5. Verificación

- [ ] 5.1 Tests: segunda carga del mismo archivo no duplica; cancelar no escribe; fila de resumen no se importa.
- [ ] 5.2 Test de integración: saldo final igual al previsto en la previsualización, por moneda.
- [ ] 5.3 E2E con fixture sintético: importar, resolver dos incidentes, conciliar y agregar un movimiento nuevo.
- [ ] 5.4 Revisión de que no hay datos reales en fixtures, seeds ni bases de desarrollo.

## 6. Documentación e integración

- [ ] 6.1 Actualizar el CSV de ejemplo y el contrato de API.
- [ ] 6.2 Validar OpenSpec en modo estricto, correr pruebas y abrir PR.
