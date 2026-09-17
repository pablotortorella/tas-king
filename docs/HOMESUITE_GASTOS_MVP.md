# HomeSuite Gastos — especificación funcional del MVP

**Estado:** especificación de producto inicial; implementación no iniciada

**Fecha:** 2026-09-16

**Objetivo:** reemplazar Splitwise para familias, viajes, amigos y proyectos

## 1. Resultado buscado

Una persona debe poder crear un grupo, incorporar participantes, registrar quién
pagó y para quién, consultar balances confiables y registrar pagos para saldar.
El grupo debe poder reconstruir y exportar la historia sin depender de HomeSuite.

El MVP responde esta pregunta:

> ¿Quién aportó dinero, a quién le correspondía el gasto y quién le debe cuánto a
> quién, por moneda?

No intenta responder todavía cuánto puede gastar el hogar, cómo evoluciona su flujo
de caja o si una categoría excedió un presupuesto.

## 2. Alcance

### Incluido

- grupos para familia, viaje, amigos o proyecto;
- miembros con acceso y participantes sin cuenta;
- invitación segura por email;
- gastos con uno o varios pagadores;
- reparto igual, exacto, porcentual o por partes;
- moneda por operación y moneda predeterminada del libro;
- balances por participante y moneda;
- pagos directos para saldar;
- corrección y anulación con historial;
- nota y comentarios básicos por operación;
- actividad del grupo;
- exportación CSV y JSON;
- archivo del grupo;
- experiencia móvil y actualización optimista;
- idempotencia, auditoría y backups restaurables.

### Fuera del MVP

- presupuesto, flujo de caja y patrimonio;
- conexión con bancos o tarjetas;
- ejecución real de pagos;
- ingresos salariales y proyecciones;
- categorías analíticas avanzadas;
- gastos recurrentes;
- conversión automática o cotizaciones de moneda;
- simplificación automática de deudas;
- OCR o escaneo inteligente de recibos;
- notificaciones push o email de actividad;
- adjuntos de comprobantes, salvo nueva evidencia de que son imprescindibles;
- importación automática desde Splitwise;
- listas de compras y automatizaciones entre productos.

Los elementos fuera del MVP pueden explorarse después; no deben condicionar la
interfaz inicial ni introducir conceptos sin uso presente.

## 3. Vocabulario

- **Espacio:** contexto compartido de HomeSuite, por ejemplo “Familia” o “Viaje a
  Cartagena”. Puede contener recursos de varias herramientas.
- **Libro:** recurso de Gastos que contiene participantes y operaciones. En la
  primera interfaz, crear un grupo crea un espacio y su primer libro.
- **Miembro:** usuario autenticado con acceso al espacio.
- **Participante:** persona incluida en pagos, repartos o balances. Puede no tener
  cuenta HomeSuite.
- **Gasto:** operación donde determinados participantes aportaron dinero y el costo
  se asignó entre beneficiarios.
- **Pago para saldar:** transferencia directa entre dos participantes que reduce la
  deuda, sin cambiar el gasto histórico.
- **Anulación:** operación compensatoria o estado explícito que invalida otra sin
  eliminar su rastro.
- **Balance:** aporte menos parte asignada, calculado para un participante y moneda.

## 4. Roles y permisos

### Propietario

- renombra y archiva el grupo;
- administra roles y miembros;
- crea, modifica y anula operaciones;
- administra participantes;
- exporta toda la información;
- transfiere la propiedad antes de abandonar el grupo.

### Miembro

- consulta libro, participantes, balances y actividad;
- crea gastos y pagos para saldar;
- modifica o anula sus propias operaciones;
- comenta operaciones;
- exporta la información visible del libro.

### Participante sin cuenta

- aparece en operaciones y balances;
- no tiene acceso ni permisos;
- puede vincularse después a un usuario mediante invitación confirmada.

La posibilidad de que un miembro edite operaciones ajenas queda limitada al
propietario en el MVP. Toda corrección conserva autor, fecha y versión anterior.

## 5. Recorridos principales

### 5.1 Crear un grupo

1. La persona elige “Nuevo grupo”.
2. Ingresa nombre, propósito opcional y moneda predeterminada.
3. HomeSuite crea espacio, membresía de propietario, libro y participante vinculado
   al propietario en una única operación lógica.
4. Se abre el estado vacío con acciones para agregar gasto o participantes.

### 5.2 Incorporar personas

El propietario puede:

- invitar un miembro por email mediante token de un solo uso, revocable y con
  vencimiento; o
- crear un participante sin cuenta ingresando únicamente un nombre visible.

Al aceptar una invitación, HomeSuite vincula el usuario al participante esperado o
crea uno nuevo si no existía. La aceptación nunca debe trasladar balances entre dos
participantes distintos de forma implícita.

Los enlaces abiertos y reutilizables no forman parte del MVP; se evaluarán después
con controles de aprobación y abuso.

### 5.3 Registrar un gasto

Datos mínimos:

- descripción;
- fecha, con valor predeterminado de hoy;
- importe positivo;
- moneda, con valor predeterminado del libro;
- uno o más pagadores y sus aportes;
- beneficiarios y método de reparto;
- nota opcional.

El flujo debe optimizar el caso frecuente: un pagador, todos participan y división
igual. Las opciones avanzadas no deben estorbar ese recorrido.

### 5.4 Corregir un gasto

1. Un usuario autorizado abre la operación.
2. Modifica datos y confirma.
3. El servidor valida nuevamente todas las invariantes.
4. Se crea una nueva revisión y un evento de actividad.
5. Los balances se recalculan desde la versión vigente.

La interfaz debe mostrar quién realizó la última modificación y permitir consultar
al menos el resumen de cambios. No se sobrescribe silenciosamente la historia.

### 5.5 Anular un gasto

La acción exige confirmación y motivo opcional. El gasto deja de afectar balances,
pero permanece visible como anulado en actividad e historial. No existe borrado
físico desde la interfaz normal.

### 5.6 Saldar

1. El usuario elige quién pagó a quién.
2. Selecciona moneda e importe positivo.
3. Puede usar como sugerencia el saldo actual entre ambos.
4. HomeSuite registra una transferencia; no marca gastos individuales como pagados.
5. Los balances se recalculan y la transferencia queda en la actividad.

### 5.7 Consultar balances

El grupo muestra:

- saldo neto de cada participante por moneda;
- detalle entre pares derivado del libro;
- operaciones que explican el saldo;
- sugerencias simples de pago, sin afirmar que son la única forma válida de saldar.

Nunca se suman monedas distintas ni se presenta un total convertido sin tasa,
fecha y consentimiento explícitos.

### 5.8 Exportar y archivar

- JSON preserva entidades, ids, monedas, revisiones y auditoría necesaria para una
  restauración portable.
- CSV prioriza lectura y análisis: operaciones, pagadores, repartos y pagos pueden
  exportarse en archivos separados o en una estructura documentada.
- Archivar vuelve el grupo de solo lectura por defecto y permite restaurarlo.
- El propietario no puede eliminar definitivamente un libro con historia desde el
  flujo habitual.

## 6. Métodos de reparto

### Igual

El importe se divide entre los participantes seleccionados. Si la unidad menor no
divide exactamente, el residuo se asigna de manera determinista y visible; nunca se
pierde ni se crea dinero por redondeo.

### Exacto

Se ingresa un importe por participante. La suma debe ser exactamente igual al total.

### Porcentaje

Se ingresa un porcentaje por participante. La suma debe ser 100 %. Los importes se
calculan en unidades menores con una regla determinista para residuos.

### Partes

Se ingresa una ponderación entera o decimal positiva. El total se reparte de forma
proporcional y conserva exactamente el importe original después de redondear.

## 7. Monedas

- Cada libro tiene una moneda predeterminada, no exclusiva.
- Cada operación usa una única moneda ISO 4217.
- Todos sus pagos y repartos usan esa misma moneda.
- Los importes se guardan como enteros en la unidad menor definida para la moneda.
- Balances, deudas y pagos para saldar se mantienen separados por moneda.
- Cambiar la moneda predeterminada no convierte operaciones anteriores.
- Monedas con cero o tres decimales deben contemplarse en el modelo aunque la
  primera experiencia se valide principalmente con COP, USD y EUR.

La conversión futura deberá almacenar moneda e importe original, tasa, origen y
fecha. No se agregará una columna de “total convertido” como fuente de verdad.

## 8. Invariantes financieras

Para todo gasto vigente:

```text
importe > 0
suma(aportes de pagadores) = importe
suma(asignaciones de beneficiarios) = importe
moneda(aportes) = moneda(asignaciones) = moneda(gasto)
```

Para cada moneda dentro de un libro:

```text
suma(balance de todos los participantes) = 0
```

Para todo pago para saldar:

```text
importe > 0
origen != destino
origen y destino pertenecen al libro
```

Además:

- una operación no referencia participantes de otro libro;
- un participante con historia no se elimina: se desactiva;
- aceptar dos veces la misma escritura idempotente produce un único resultado;
- una escritura parcial no puede quedar persistida;
- anular o revisar una operación produce una nueva revisión auditable;
- los balances se derivan de operaciones vigentes y no se editan directamente.

## 9. Modelo conceptual de datos

El modelo definitivo se diseñará en OpenSpec antes de migrar D1. La dirección es:

```text
Plataforma
  users
  external_identities
  spaces
  space_members
  invitations

Gastos
  expense_ledgers
  ledger_participants
  ledger_entries
  entry_payers
  entry_shares
  entry_revisions
  entry_comments
  ledger_events
  idempotency_keys
```

Relaciones principales:

- un libro pertenece a un espacio;
- un participante pertenece a un libro y puede vincularse a un usuario;
- una operación pertenece a un libro;
- pagadores y beneficiarios son participantes del mismo libro;
- revisiones y eventos son inmutables;
- el estado vigente de una operación se puede reconstruir y auditar.

Los pagos para saldar pueden representarse como un tipo de `ledger_entry` con
origen y destino, siempre que sus invariantes no queden diluidas en condicionales
ambiguos. El diseño físico deberá privilegiar claridad y constraints comprobables.

## 10. API conceptual

No es un contrato definitivo, sino la frontera esperada:

```text
/api/platform/me
/api/platform/spaces
/api/platform/spaces/:id/members
/api/platform/invitations/*

/api/expenses/ledgers
/api/expenses/ledgers/:id
/api/expenses/ledgers/:id/participants
/api/expenses/ledgers/:id/entries
/api/expenses/entries/:id
/api/expenses/entries/:id/revisions
/api/expenses/ledgers/:id/balances
/api/expenses/ledgers/:id/export
```

Toda mutación monetaria deberá aceptar una clave de idempotencia. Las respuestas
de creación y edición incluirán la representación confirmada y una revisión del
libro para que el frontend actualice su estado sin recargar todas las colecciones.

## 11. Sincronización y conectividad

- La UI aplica cambios optimistas solo cuando puede revertirlos con claridad.
- El servidor es la fuente de verdad de validaciones y balances.
- El libro usa una revisión monotónica para detectar cambios.
- El MVP puede comenzar con polling eficiente; WebSockets no son requisito.
- Una reconexión no debe duplicar operaciones gracias a idempotencia.
- Conflictos de edición muestran que existe una versión más reciente; no se aplica
  last-write-wins silencioso sobre información financiera.

El soporte offline completo puede llegar después. La primera versión debe tolerar
reintentos y pérdida temporal de conexión sin duplicar dinero.

## 12. Actividad y auditoría

Registrar como mínimo:

- creación y archivo de grupo;
- invitación, aceptación, revocación y cambio de rol;
- alta, vinculación, renombre y desactivación de participante;
- creación, revisión y anulación de gasto;
- pago para saldar;
- exportación administrativa si se decide auditarla.

Cada evento contiene actor, instante, recurso, acción y datos mínimos para explicar
el cambio sin duplicar información sensible innecesaria.

## 13. Requisitos de calidad

### Seguridad

- autorización server-side en todas las rutas;
- tokens de invitación almacenados mediante hash, con expiración y revocación;
- límites de longitud y payload;
- protección CSRF coherente con cookies de sesión;
- CSP sin `unsafe-inline` general en la aplicación autenticada;
- mensajes de error que no filtren existencia de grupos o usuarios ajenos.

### Rendimiento

- abrir un libro no debe producir consultas N+1 por participante u operación;
- crear un gasto usa una escritura transaccional y devuelve su estado confirmado;
- balances se calculan mediante consultas indexadas o una proyección verificable;
- cualquier cache de balance es derivada y reconstruible, nunca fuente única.

### Accesibilidad y móvil

- el flujo frecuente de gasto debe poder completarse con una mano;
- controles táctiles adecuados y teclado numérico para importes;
- navegación completa por teclado;
- etiquetas, errores y foco accesibles;
- importe y moneda nunca se distinguen solo por color.

## 14. Estrategia de pruebas

### Unitarias y de propiedades

- todos los métodos de reparto, incluidos residuos;
- monedas con 0, 2 y 3 decimales;
- la suma de balances por moneda siempre es cero;
- revisiones y anulaciones preservan historia;
- pagos para saldar modifican balances como corresponde;
- generación aleatoria de gastos válidos para comprobar invariantes.

### API e integración

- permisos por rol y aislamiento entre libros;
- aceptación y revocación de invitaciones;
- batch completo revierte ante cualquier fallo;
- misma clave idempotente no duplica;
- conflicto de revisión devuelve respuesta explícita;
- exportación reproduce las operaciones vigentes y su moneda;
- restauración genera los mismos balances.

### E2E

- crear grupo, invitar, aceptar y ver el libro;
- gasto igual entre varias personas;
- gasto exacto con varios pagadores;
- edición concurrente o versión desactualizada;
- anulación visible en actividad;
- saldar una deuda;
- uso móvil del recorrido frecuente;
- aislamiento entre dos grupos bajo identidades distintas.

## 15. Criterios de aceptación del MVP

El MVP está listo para sustituir el uso cotidiano de Splitwise cuando:

1. Un grupo real completa al menos un ciclo de creación, gastos y saldos.
2. Todas las invariantes se validan tanto en tests como en servidor.
3. Dos personas pueden operar concurrentemente sin duplicar ni perder gastos.
4. Cada saldo se puede explicar desde el detalle de operaciones.
5. Una corrección o anulación deja rastro visible.
6. Los datos completos se pueden exportar y restaurar.
7. La revocación de un miembro corta acceso sin borrar su participación histórica.
8. Staging y producción tienen backups separados y un procedimiento de recuperación
   probado.
9. TasKing no presenta regresiones por la introducción de la plataforma.
10. El uso diario no requiere intervención de un administrador global.

## 16. Evolución posterior

Orden orientativo, condicionado por uso real:

1. simplificación de deudas como proyección reversible;
2. adjuntos y comprobantes;
3. gastos recurrentes y recordatorios;
4. categorías y resúmenes simples;
5. borrador de gasto desde HomeSuite Compras;
6. devoluciones complejas y reembolsos vinculados;
7. importadores de otras plataformas;
8. presupuesto familiar;
9. ingresos y fondos comunes;
10. flujo de caja y proyecciones.

Presupuesto y flujo deberán construirse como lecturas y reglas sobre operaciones
financieras explícitas. No se convertirán los balances de deuda en una contabilidad
doméstica implícita.

## 17. Decisiones pendientes para la fase OpenSpec

Estas preguntas no bloquean la visión, pero deben resolverse antes de implementar:

- ¿la simplificación de deudas se mantiene fuera del MVP o resulta indispensable
  después de validar los primeros grupos reales?
- ¿comentarios serán conversación en hilo o una única nota editable?
- ¿qué ventana de edición tendrá un miembro sobre su propia operación?
- ¿cómo se presenta el redondeo cuando el residuo no se divide exactamente?
- ¿cuánto historial se incluye en CSV y cómo se representa una revisión?
- ¿qué política explícita de retención y eliminación se ofrecerá?

## Documentos relacionados

- [Visión de HomeSuite](HOMESUITE_VISION.md)
- [ADR-017: HomeSuite como suite modular](ADRs/ADR-017-homesuite-suite-modular.md)
- [Prácticas de rendimiento](PERFORMANCE-PRACTICES.md)
- [Estrategia de testing actual](../TESTING.md)
