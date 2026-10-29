## 1. Datos y reglas

- [x] 1.1 Migración `0012_payment_method.sql` con CHECK, y prueba de integración de que la base rechaza un valor fuera de la lista.
- [x] 1.2 `payment-methods.js` con la lista y la validación, con pruebas unitarias.
- [x] 1.3 Guardar la forma de pago (alta y corrección) con «ausente = no tocar», rechazo de valores desconocidos y sin forma en las transferencias; verificar con pruebas de integración, incluidas la instantánea, anular, recategorizar y exportar.

## 2. Pantallas

- [x] 2.1 Selector «Forma de pago (opcional)» en el formulario, etiqueta en el detalle y «forma de pago» en el historial; verificar con pruebas unitarias.
- [x] 2.2 Columna `forma_pago` en el CSV al final; actualizar la prueba de orden de columnas.

## 3. Verificación y documentos

- [x] 3.1 Recorrido E2E: elegir, corregir, quitar, ver el historial, exportar; a 390 px en claro y oscuro sin desborde, con control de 44 px y contraste.
- [x] 3.2 Glosario y backlog actualizados.
- [ ] 3.3 Probar en staging con Pablo y desplegar (migración antes del Worker).
