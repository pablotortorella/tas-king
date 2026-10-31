## 1. Modelo de datos

- [ ] 1.1 Migración D1: monedas, libros, participantes, movimientos, partes de efectivo, asignaciones, revisiones y claves de idempotencia, con índices y `CHECK` de importe positivo.
- [ ] 1.2 Migrar grupos existentes: libro vacío (COP) y participante vinculado al titular.
- [ ] 1.3 Crear libro y participante titular dentro de la misma transacción que crea el grupo.

## 2. Dominio puro

- [ ] 2.1 `splitAmount` para igual, exacto, porcentaje y partes, con residuo determinista; tests de propiedades (suma exacta, 0/2/3 decimales).
- [ ] 2.2 Funciones de efecto de saldo por tipo de movimiento y validadores de invariantes.
- [ ] 2.3 Algoritmo de sugerencias por moneda; test: mismos saldos, mismo resultado; los saldos resultantes quedan en cero.

## 3. API

- [ ] 3.1 Participantes: listar, crear por nombre, renombrar, desactivar (nunca eliminar con historia).
- [ ] 3.2 Movimientos: crear gasto, ingreso y transferencia con `Idempotency-Key`, en un solo `db.batch()`.
- [ ] 3.3 Corrección con revisión, anulación con motivo opcional y detección de conflicto por revisión del libro (409).
- [ ] 3.4 Saldos, explicación de un saldo y sugerencias, separados por moneda.
- [ ] 3.5 Autorización por membresía y aislamiento entre libros; pruebas negativas.

## 4. Interfaz

- [ ] 4.1 Nuevo grupo: nombre, propósito, moneda, participantes por nombre.
- [ ] 4.2 Saldos con selector de moneda, barras divergentes, «suman $0», sugerencias.
- [ ] 4.3 Agregar movimiento: gasto, ingreso y transferencia, con efecto previsto antes de confirmar.
- [ ] 4.4 Detalle con reparto, historial de revisiones, editar y anular.
- [ ] 4.5 «Por qué» de un saldo con acumulado y comprobación de suma.
- [ ] 4.6 Libro de dos paneles en escritorio y apilado en móvil.
- [ ] 4.7 Variables de color claro/oscuro con `prefers-color-scheme`; verificar contraste AA de cada par.

## 5. Verificación

- [ ] 5.1 Tests de conteo de llamadas D1 (apertura de libro y escritura).
- [ ] 5.2 E2E: gasto igual entre cuatro, ingreso de alquiler, transferencia que invierte un saldo, anulación visible, conflicto de edición, aislamiento entre dos grupos.
- [ ] 5.3 E2E en móvil del caso frecuente con una mano.
- [ ] 5.4 Revisión manual en staging con dos cuentas.

## 6. Documentación e integración

- [ ] 6.1 Actualizar `docs/STATUS.md` y el contrato de API.
- [ ] 6.2 Validar OpenSpec en modo estricto, correr pruebas y abrir PR.
