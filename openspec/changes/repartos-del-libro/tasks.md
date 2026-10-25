## 1. Regla pura de reparto

- [x] 1.1 Crear `apps/app/src/split.js` con `splitAmount` (métodos `equal`, `exact`, `percent`, `shares` y `fixed`), sin variables libres ni dependencias, y verificar con pruebas unitarias de los ejemplos del spec: 100,00 entre tres, 100,01 entre tres, 50/30/20, 2/1/1 y «fijo de 10,00 con dos personas sin fijo» (10,00 / 45,00 / 45,00).
- [x] 1.2 Agregar una prueba de propiedades (miles de casos generados, para monedas de 0, 2 y 3 decimales y para los cinco métodos) y verificar que siempre se cumple: la suma es exactamente el total, ninguna asignación es cero o negativa, y el resultado no depende del orden en que llegan las entradas sino solo del orden del grupo que se declara.
- [x] 1.3 Implementar las validaciones con sus mensajes (porcentajes que no suman 100, importes exactos con otra suma, valores negativos o ilegibles con la persona indicada, todas las partes en cero, sin beneficiarias, fijos que superan el total, todos con fijo que no suman el total, y sin resto para repartir) y verificar con una prueba por cada escenario de rechazo del spec.
- [x] 1.4 Comprobar que el reparto igual produce los mismos importes que `splitEqually` para el mismo orden, con una prueba de equivalencia sobre casos generados, y que el residuo informado coincide con la unidad menor sobrante.

## 2. Servidor

- [x] 2.1 Hacer que `parseEntryForm` lea `splitMethod`, `percent_<id>`, `parts_<id>`, `fixed_<id>` y `share_<id>` y devuelva la especificación del reparto (método, personas elegidas y texto ingresado) en lugar de asignaciones calculadas, y verificar con pruebas unitarias del lector del formulario para los cinco métodos.
- [x] 2.2 En `saveEntry`, calcular las asignaciones con `splitAmount` usando el orden del grupo (`participantsFor`), ignorar cualquier importe calculado que envíe el navegador y conservar la compatibilidad con las llamadas que pasan asignaciones ya resueltas, y verificar con pruebas de integración D1 que un movimiento con importes manipulados se guarda con los que resultan del método.
- [x] 2.3 Incorporar `split: { method, beneficiaries, inputs }` a la instantánea de cada revisión (alta y corrección) y verificar con una prueba de integración que la revisión guarda el método y que repetir la misma clave de idempotencia sigue devolviendo la respuesta original.
- [x] 2.4 Hacer que la pantalla de corrección lea la instantánea de la revisión vigente y reabra el formulario con ese método y esos datos, y deduzca igual o exacto cuando no hay método guardado (movimientos anteriores o importados), y verificar con pruebas de integración de los tres escenarios de reapertura del spec.
- [x] 2.5 Hacer que el resumen del historial (`revisionSummary`) incluya «forma de reparto» cuando cambian el método o sus datos, y verificar con una prueba que un cambio de igual a 50 % / 50 % no diga «Sin cambios de contenido».

## 3. Formulario

- [x] 3.1 Rediseñar la sección de reparto de `renderEntryForm` con los cinco métodos como opciones, los campos propios de cada uno y el índice de orden del grupo en cada persona, conservando los nombres de campo actuales, y verificar que las pruebas E2E existentes del formulario siguen pasando.
- [x] 3.2 Mostrar solo los campos del método elegido con las clases y el patrón `:has` ya usados (sin estilos en línea, por la CSP) y verificar con una prueba E2E que cambiar de método cambia los campos visibles y que los controles miden al menos 44 px en 390 px de ancho, en claro y oscuro.
- [x] 3.3 Agregar el atajo «lo debe todo una persona» como opción de interfaz que deja una sola beneficiaria con reparto igual, y verificar con una prueba E2E que Ana paga 100,00, se elige «lo debe todo Beto», y los saldos quedan en +100,00 y −100,00.

## 4. Vista previa con la misma regla

- [x] 4.1 Servir `split.js` en `/split.js` como `text/javascript` publicando el texto de la función pura con `export`, y verificar que la respuesta tiene el tipo correcto y que su texto se evalúa de forma aislada, con una prueba sobre la aplicación en Node y una E2E contra el Worker real (el entorno de integración de Workers no permite evaluar texto como código, por eso la evaluación aislada no va allí).
- [x] 4.2 Pasar `client.js` a módulo que importa la regla desde `/split.js`, eliminar su copia del reparto igual y mostrar el efecto previsto, el residuo y los mensajes de datos faltantes, y verificar con una prueba E2E sin errores de consola ni violaciones de CSP.
- [x] 4.3 Agregar una prueba de paridad que evalúe el texto servido y compare su resultado con el de la función importada sobre miles de casos de los cinco métodos, y verificar que falla si se altera una sola línea de la función servida.
- [x] 4.4 Verificar con una prueba E2E, para cada método, que los importes de la vista previa son los mismos que muestra el movimiento guardado.

## 5. Cierre

- [x] 5.1 Actualizar el requisito «Repartos exactos con residuo determinista» del borrador `libro-y-saldos-cuentas-claras` para que remita a la capability `reparto-de-movimientos`, y verificar con `openspec validate repartos-del-libro --strict` y la validación del borrador.
- [ ] 5.2 Ejecutar `npm run test:homesuite-app`, `npm run test:homesuite-app:integration`, `npm run test:e2e:homesuite-app` y `npm run test:all` y verificar que pasan completos.
