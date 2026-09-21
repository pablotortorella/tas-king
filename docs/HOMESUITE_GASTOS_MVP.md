# HomeSuite Gastos — especificación funcional del MVP

**Estado:** especificación de producto inicial actualizada; implementación no iniciada

**Fecha:** 2026-09-21

**Objetivo:** reemplazar Splitwise para familias, viajes, amigos y proyectos

## 1. Resultado buscado

Una persona debe poder crear un grupo, incorporar participantes, registrar gastos,
ingresos y transferencias, y consultar balances netos confiables. El grupo debe
poder reconstruir y exportar la historia sin depender de HomeSuite.

El MVP responde esta pregunta:

> ¿Qué dinero pagó, recibió o entregó cada participante, cómo se repartió su efecto
> y cuál es el saldo neto de cada persona, por moneda?

No intenta responder todavía cuánto puede gastar el hogar, cómo evoluciona su flujo
de caja o si una categoría excedió un presupuesto.

## 2. Alcance

### Incluido

- grupos para familia, viaje, amigos o proyecto;
- miembros con acceso y participantes sin cuenta;
- invitación segura por email;
- gastos con uno o varios pagadores;
- ingresos compartidos con uno o varios receptores;
- transferencias directas entre participantes, cualquiera sea su motivo;
- reparto igual, exacto, porcentual o por partes para gastos e ingresos;
- moneda por movimiento y moneda predeterminada del libro;
- balances por participante y moneda;
- sugerencias de transferencias derivadas del saldo neto;
- corrección y anulación con historial;
- nota y comentarios básicos por movimiento;
- actividad del grupo;
- entrada con saldo inicial cero o apertura no cero, auditable y equilibrada por
  moneda;
- importación de movimientos desde un archivo exportado de Splitwise, con
  previsualización, conciliación y protección contra duplicados; una inferencia
  ambigua de pagador o reparto no bloquea una línea válida;
- historial y búsqueda únicos por nombre, monto o palabra para movimientos
  propios e importados, con la procedencia visible en estos últimos;
- exportación CSV y JSON;
- archivo del grupo;
- experiencia móvil y actualización optimista;
- idempotencia, auditoría y backups restaurables.

### Fuera del MVP

- presupuesto, flujo de caja y patrimonio;
- conexión con bancos o tarjetas;
- ejecución real de pagos;
- importación de ingresos salariales, proyecciones y planificación financiera;
- préstamos como contratos separados, con intereses, vencimientos o amortización;
- obligaciones o deudas persistidas por movimiento;
- fondos comunes y saldos de cuentas bancarias;
- categorías analíticas avanzadas;
- gastos recurrentes;
- conversión automática o cotizaciones de moneda;
- estrategias configurables o alternativas de optimización de transferencias;
- OCR o escaneo inteligente de recibos;
- notificaciones push o email de actividad;
- adjuntos de comprobantes, salvo nueva evidencia de que son imprescindibles;
- conexión directa mediante la API de Splitwise (sin archivo exportado por la
  persona usuaria);
- listas de compras y automatizaciones entre productos.

Los elementos fuera del MVP pueden explorarse después; no deben condicionar la
interfaz inicial ni introducir conceptos sin uso presente.

## 3. Vocabulario

- **Espacio:** contexto compartido de HomeSuite, por ejemplo “Familia” o “Viaje a
  Cartagena”. Puede contener recursos de varias herramientas.
- **Libro:** recurso de Gastos que contiene participantes y movimientos. En la
  primera interfaz, crear un grupo crea un espacio y su primer libro.
- **Miembro:** usuario autenticado con acceso al espacio.
- **Participante:** persona incluida en pagos, repartos o balances. Puede no tener
  cuenta HomeSuite.
- **Movimiento:** hecho financiero que afecta el saldo neto. Puede ser gasto,
  ingreso o transferencia.
- **Gasto:** operación donde determinados participantes aportaron dinero y el costo
  se asignó entre beneficiarios.
- **Ingreso:** operación donde determinados participantes recibieron dinero cuyo
  beneficio se asigna entre participantes.
- **Transferencia:** dinero entregado directamente por un participante a otro. El
  sistema no distingue si representa préstamo, adelanto, reintegro o pago parcial.
- **Anulación:** operación compensatoria o estado explícito que invalida otra sin
  eliminar su rastro.
- **Balance neto:** suma de los efectos de todos los movimientos vigentes de un
  participante y moneda. Es la única posición financiera que expone el producto;
  se deriva de movimientos y no convive con obligaciones separadas.

## 4. Roles y permisos

### Propietario

- renombra y archiva el grupo;
- administra roles y miembros;
- crea, modifica y anula movimientos;
- administra participantes;
- exporta toda la información;
- transfiere la propiedad antes de abandonar el grupo.

### Miembro

- consulta libro, participantes, balances y actividad;
- crea gastos, ingresos y transferencias;
- modifica o anula sus propios movimientos;
- comenta movimientos;
- exporta la información visible del libro.

### Participante sin cuenta

- aparece en movimientos y balances;
- no tiene acceso ni permisos;
- puede vincularse después a un usuario mediante invitación confirmada.

La posibilidad de que un miembro edite movimientos ajenos queda limitada al
propietario en el MVP. Toda corrección conserva autor, fecha y versión anterior.

## 5. Recorridos principales

El recorrido comienza eligiendo el punto de partida del libro: importar
movimientos de Splitwise, iniciar en cero o registrar un saldo de apertura no
cero. Si se combinan apertura e importación parcial, el corte de fechas debe
impedir contar dos veces el mismo período. El flujo de decisión se detalla en el
[User Journey de entrada y migración](HOMESUITE_GASTOS_JOURNEY.md); los recorridos
siguientes describen el uso cotidiano una vez iniciado el libro.

### 5.1 Crear un grupo

1. La persona elige “Nuevo grupo”.
2. Ingresa nombre, propósito opcional y moneda predeterminada.
3. HomeSuite crea espacio, membresía de propietario, libro y participante vinculado
   al propietario en una única operación lógica.
4. Se abre el estado vacío con acciones para agregar participantes o un movimiento.

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

### 5.3 Importar movimientos de Splitwise

La primera migración se hace con un titular autenticado y una persona invitada que
acepta acceso al grupo. El archivo aceptado es un CSV del formato de exportación
de Splitwise, sin distinguir si proviene de un grupo o una relación directa.

1. HomeSuite identifica participantes, filas de movimiento y fila de resumen.
2. La persona confirma el mapeo de participantes y revisa conteos y saldos por
   moneda antes de escribir.
3. Cada incidente señala la **fila original del archivo** y su motivo. La persona
   puede cancelar, resolver mediante un supuesto explícito o continuar con el
   subconjunto no afectado.
4. La confirmación conserva procedencia, supuestos y filas no importadas en el
   resumen del lote. Una diferencia global sin fila atribuible se muestra sin
   corregirla con un asiento oculto.
5. Cada movimiento importado aparece en la cronología y en la misma búsqueda que
   los movimientos propios, con origen visible. Un reintento no duplica el lote.

Una línea cuyo pagador o reparto no pueda inferirse, pero cuyo efecto de saldo sea
válido, **no es un incidente**: se importa preservando ese efecto exacto.

### 5.4 Elegir el tipo de movimiento

La acción principal es “Agregar movimiento” y ofrece:

- **Gasto:** alguien pagó algo que correspondía a una o más personas.
- **Ingreso:** alguien recibió dinero que correspondía a una o más personas.
- **Transferencia:** una persona le entregó dinero a otra.

“Préstamo”, “adelanto”, “reintegro” y “pago parcial” no son tipos adicionales. Si
resulta útil, se escriben en la descripción de una transferencia.

### 5.5 Registrar un gasto

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

### 5.6 Registrar un ingreso

Datos mínimos:

- descripción;
- fecha, con valor predeterminado de hoy;
- importe positivo;
- moneda, con valor predeterminado del libro;
- uno o más receptores y los importes recibidos;
- beneficiarios y método de reparto;
- fuente externa y nota opcionales.

El flujo frecuente asume un receptor, todos participan y división igual, pero cada
supuesto es visible y modificable. Un alquiler recibido por una persona y compartido
entre varias debe poder registrarse sin usar un gasto negativo.

### 5.7 Registrar una transferencia

1. El usuario elige origen y destino.
2. Selecciona moneda e importe positivo.
3. Agrega descripción o nota opcional.
4. HomeSuite muestra el efecto esperado sobre el saldo neto cuando sea útil.
5. Al confirmar, la transferencia queda en la cronología y modifica los balances.

La transferencia no se vincula a un gasto, ingreso, deuda o préstamo. Puede reducir
un saldo existente, aumentarlo o invertir su dirección. El cálculo es el mismo en
todos los casos.

### 5.8 Corregir un movimiento

1. Un usuario autorizado abre la operación.
2. Modifica datos y confirma.
3. El servidor valida nuevamente todas las invariantes.
4. Se crea una nueva revisión y un evento de actividad.
5. Los balances se recalculan desde la versión vigente.

La interfaz debe mostrar quién realizó la última modificación y permitir consultar
al menos el resumen de cambios. No se sobrescribe silenciosamente la historia.

### 5.9 Anular un movimiento

La acción exige confirmación y motivo opcional. El movimiento deja de afectar
balances, pero permanece visible como anulado en actividad e historial. No existe
borrado físico desde la interfaz normal.

### 5.10 Consultar balances

El grupo muestra:

- saldo neto de cada participante por moneda;
- movimientos que explican el saldo;
- sugerencias deterministas de transferencias para quedar a mano.

Desde el mismo historial se pueden buscar movimientos propios e importados con un
único campo libre. La búsqueda normaliza mayúsculas, acentos y puntuación, y cubre
textos, participantes, monto total y efecto individual. Cada resultado explica la
coincidencia y muestra su origen cuando fue importado; no hay dos listas separadas.

La sugerencia es una proyección recalculable desde los saldos, no una obligación
persistida entre pares ni la única forma válida de quedar a mano.

Nunca se suman monedas distintas ni se presenta un total convertido sin tasa,
fecha y consentimiento explícitos.

### 5.11 Exportar y archivar

- JSON preserva entidades, ids, monedas, revisiones y auditoría necesaria para una
  restauración portable.
- CSV prioriza lectura y análisis: movimientos, aportes, importes recibidos y
  repartos pueden exportarse en archivos separados o en una estructura documentada.
- Archivar vuelve el grupo de solo lectura por defecto y permite restaurarlo.
- El propietario no puede eliminar definitivamente un libro con historia desde el
  flujo habitual.

## 6. Métodos de reparto

Los mismos métodos se aplican a la parte asignada de un gasto y a la parte que
corresponde de un ingreso. Cambia el sentido económico, no la mecánica de reparto.

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
- Cada movimiento usa una única moneda ISO 4217.
- Todos sus aportes, importes recibidos, transferencias y repartos usan esa moneda.
- Los importes se guardan como enteros en la unidad menor definida para la moneda.
- Los balances netos y las sugerencias de transferencia se mantienen separados por
  moneda.
- Cambiar la moneda predeterminada no convierte movimientos anteriores.
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

Para todo ingreso vigente:

```text
importe > 0
suma(importes recibidos) = importe
suma(asignaciones de beneficiarios) = importe
moneda(importes recibidos) = moneda(asignaciones) = moneda(ingreso)
```

Para toda transferencia vigente:

```text
importe > 0
origen != destino
origen y destino pertenecen al libro
```

El efecto sobre el balance de un participante se calcula así:

```text
gasto        = importe pagado - parte asignada del gasto
ingreso      = parte asignada del ingreso - importe recibido
transferencia para origen  = +importe
transferencia para destino = -importe
saldo neto   = suma de efectos de movimientos vigentes
```

Un saldo positivo significa que al participante le corresponde recibir; uno
negativo significa que debe aportar para quedar a mano.

Para cada moneda dentro de un libro:

```text
suma(saldo neto de todos los participantes) = 0
```

Además:

- un movimiento no referencia participantes de otro libro;
- un participante con historia no se elimina: se desactiva;
- aceptar dos veces la misma escritura idempotente produce un único resultado;
- una escritura parcial no puede quedar persistida;
- anular o revisar un movimiento produce una nueva revisión auditable;
- los balances se derivan de movimientos vigentes y no se editan directamente.

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
  entry_cash_parties
  entry_allocations
  entry_revisions
  entry_comments
  ledger_events
  idempotency_keys
```

Relaciones principales:

- un libro pertenece a un espacio;
- un participante pertenece a un libro y puede vincularse a un usuario;
- un movimiento pertenece a un libro y tiene tipo gasto, ingreso o transferencia;
- pagadores, receptores, orígenes, destinos y beneficiarios son participantes del
  mismo libro;
- revisiones y eventos son inmutables;
- el estado vigente de un movimiento se puede reconstruir y auditar;
- los saldos se derivan de movimientos vigentes y no constituyen obligaciones
  separadas.

El esquema físico de las partes de efectivo y asignaciones se decidirá durante
OpenSpec. Debe permitir expresar simétricamente quién pagó un gasto, quién recibió
un ingreso y cómo se asignó su efecto. No se crearán entidades de préstamo, deuda,
obligación o repago. El diseño deberá privilegiar claridad y constraints
comprobables.

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
- Una reconexión no debe duplicar movimientos gracias a idempotencia.
- Conflictos de edición muestran que existe una versión más reciente; no se aplica
  last-write-wins silencioso sobre información financiera.

El soporte offline completo puede llegar después. La primera versión debe tolerar
reintentos y pérdida temporal de conexión sin duplicar dinero.

## 12. Actividad y auditoría

Registrar como mínimo:

- creación y archivo de grupo;
- invitación, aceptación, revocación y cambio de rol;
- alta, vinculación, renombre y desactivación de participante;
- creación, revisión y anulación de gastos, ingresos y transferencias;
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

- abrir un libro no debe producir consultas N+1 por participante o movimiento;
- crear cualquier movimiento usa una escritura transaccional y devuelve su estado
  confirmado;
- balances se calculan mediante consultas indexadas o una proyección verificable;
- cualquier cache de balance es derivada y reconstruible, nunca fuente única.

### Accesibilidad y móvil

- los flujos frecuentes de gasto, ingreso y transferencia deben poder completarse
  con una mano;
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
- gastos, ingresos y transferencias producen los efectos de balance definidos;
- una transferencia obtiene el mismo resultado aunque su descripción diga
  “préstamo”, “adelanto” o “pago parcial”;
- generación aleatoria de movimientos válidos para comprobar invariantes.

### API e integración

- permisos por rol y aislamiento entre libros;
- aceptación y revocación de invitaciones;
- batch completo revierte ante cualquier fallo;
- misma clave idempotente no duplica;
- conflicto de revisión devuelve respuesta explícita;
- exportación reproduce los movimientos vigentes y su moneda;
- importación conserva todas las líneas de movimientos válidas y sus efectos;
  no incluye filas de resumen ni duplica un lote ante reintentos; cada incidente
  informa fila y motivo, y los flujos de cancelar, supuesto o subconjunto quedan
  auditados;
- búsqueda libre devuelve resultados propios e importados, señala origen y motivo
  de coincidencia para textos, participantes y montos;
- restauración genera los mismos balances.

### E2E

- crear grupo, invitar, aceptar y ver el libro;
- gasto igual entre varias personas;
- gasto exacto con varios pagadores;
- ingreso de alquiler recibido por una persona y repartido entre varias;
- transferencia que reduce un saldo existente;
- transferencia que aumenta o invierte un saldo existente;
- adelanto seguido de un gasto que deja balances en cero;
- edición concurrente o versión desactualizada;
- anulación visible en actividad;
- uso móvil del recorrido frecuente;
- aislamiento entre dos grupos bajo identidades distintas.
- importación con comparación final de saldos, seguida de un movimiento nuevo;
  búsqueda libre por nombre, monto y palabra sobre ambos orígenes;
- titular autenticado invita a una persona, quien acepta y ve el mismo libro.

## 15. Criterios de aceptación del MVP

El MVP está listo para sustituir el uso cotidiano de Splitwise cuando:

1. Un grupo real completa al menos un ciclo de creación, gastos, ingresos,
   transferencias y consulta de saldos.
2. Todas las invariantes se validan tanto en tests como en servidor.
3. Dos personas pueden operar concurrentemente sin duplicar ni perder movimientos.
4. Cada saldo se puede explicar desde el detalle de movimientos.
5. Una corrección o anulación deja rastro visible.
6. Los datos completos se pueden exportar y restaurar.
7. La revocación de un miembro corta acceso sin borrar su participación histórica.
8. Staging y producción tienen backups separados y un procedimiento de recuperación
   probado.
9. TasKing no presenta regresiones por la introducción de la plataforma.
10. El uso diario no requiere intervención de un administrador global.
11. El grupo puede iniciar en cero, con apertura no cero o importando movimientos
    de Splitwise; todas las líneas válidas quedan incluidas, el saldo resultante
    es verificable y un reintento no duplica movimientos. Los incidentes por fila
    se pueden cancelar, resolver con supuesto explícito o excluir claramente.
12. Una búsqueda libre reúne movimientos importados y propios por textos, nombre
    y monto; los importados se distinguen por su origen y cada resultado aclara
    el motivo de coincidencia.

## 16. Evolución posterior

Orden orientativo, condicionado por uso real:

1. adjuntos y comprobantes;
2. movimientos recurrentes y recordatorios;
3. categorías y resúmenes simples;
4. borrador de gasto desde HomeSuite Compras;
5. importadores de otras plataformas;
6. cuentas o fondos comunes;
7. presupuesto familiar;
8. flujo de caja y proyecciones.

Presupuesto y flujo deberán construirse como lecturas y reglas sobre movimientos
financieros explícitos. No se convertirá el balance neto en una contabilidad
doméstica implícita.

## 17. Decisiones pendientes para la fase OpenSpec

Estas preguntas no bloquean la visión, pero deben resolverse antes de implementar:

- ¿qué algoritmo determinista convierte saldos en transferencias sugeridas sin
  persistir obligaciones entre pares?
- ¿la primera interfaz necesita varios receptores para un ingreso o basta uno si el
  modelo queda preparado para ampliarse?
- ¿la fuente externa de un ingreso merece un campo propio o alcanza con la
  descripción?
- ¿comentarios serán conversación en hilo o una única nota editable?
- ¿qué ventana de edición tendrá un miembro sobre su propia operación?
- ¿cómo se presenta el redondeo cuando el residuo no se divide exactamente?
- ¿cuánto historial se incluye en CSV y cómo se representa una revisión?
- ¿qué política explícita de retención y eliminación se ofrecerá?

## Documentos relacionados

- [Brief de exploración y referencia de Tricount](HOMESUITE_GASTOS_EXPLORACION.md)
- [User Journey de entrada y migración](HOMESUITE_GASTOS_JOURNEY.md)
- [User Story Map](HOMESUITE_GASTOS_STORY_MAP.md)
- [Visión de HomeSuite](HOMESUITE_VISION.md)
- [Infraestructura, dominios y repositorio](HOMESUITE_INFRASTRUCTURE.md)
- [ADR-018: HomeSuite como suite modular](ADRs/ADR-018-homesuite-suite-modular.md)
- [Prácticas de rendimiento](PERFORMANCE-PRACTICES.md)
- [Estrategia de testing actual](../TESTING.md)
