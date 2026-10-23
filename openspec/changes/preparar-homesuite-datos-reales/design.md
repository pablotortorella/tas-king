## Context

HomeSuite App tiene identidad, sesiones, espacios e invitaciones en una D1 de
staging. Cuentas Claras ya define conceptualmente movimientos, monedas e
invariantes, pero no existe esquema físico ni operación segura para datos reales.
El cambio cruza persistencia, seguridad del Worker, tareas programadas, scripts de
recuperación y política de datos; debe ser verificable sin habilitar todavía el
registro de movimientos en la UI.

## Goals / Non-Goals

**Goals:**

- fijar un modelo D1 auditable que preserve importes exactos por moneda;
- hacer que reintentos, redondeos y concurrencia tengan contratos explícitos;
- limitar abuso y tamaño de solicitudes antes de ejecutar lógica o escribir D1;
- purgar sólo datos efímeros con un cron observable;
- producir exportaciones y demostrar que pueden restaurarse;
- definir qué datos se retienen, exportan y eliminan antes de incorporar usuarios.

**Non-Goals:**

- endpoints o pantallas para registrar movimientos;
- balances, sugerencias de transferencias o importación Splitwise;
- adjuntos, correo, R2 o recursos de producción;
- convertir monedas o mantener cotizaciones;
- borrar automáticamente historia financiera o auditoría.

## Decisions

### D1. Libro financiero uno a uno con espacio

`expense_ledgers` tendrá un `space_id` único, moneda predeterminada, revisión
monotónica y archivo opcional. `ledger_participants` representa personas del
libro y puede vincularse a un `user`; desactivar reemplaza eliminar cuando ya hay
historia. El propietario inicial del espacio podrá convertirse después en el
primer participante, pero este cambio no crea libros automáticamente.

Alternativa descartada: agregar columnas financieras directamente a `spaces`.
Separar el libro mantiene la frontera del producto y permite que un espacio
contenga otros módulos sin semántica monetaria.

### D2. Enteros en unidad menor y moneda explícita

Cada movimiento almacena `currency_code` y `total_minor` entero positivo. El
dominio contiene un catálogo explícito de exponentes y rechaza monedas no
soportadas; se prueban al menos exponentes 0, 2 y 3. Formatear o parsear texto es
responsabilidad de borde: D1 nunca guarda decimales monetarios.

El reparto igual usa cociente entero y asigna el residuo, de a una unidad menor,
según el orden estable de participantes recibido. La suma siempre coincide con
el total y el resultado es reproducible.

### D3. Componentes explicables, revisiones inmutables

`ledger_entries` conserva tipo (`expense`, `income`, `transfer`), moneda, total,
estado y revisión vigente. `entry_cash_parties` registra salida o entrada real de
dinero; `entry_allocations` registra a quién corresponde el efecto. Ambas tablas
usan claves foráneas compuestas para impedir referencias a otro libro.

La capa de dominio valida antes del batch:

- gasto: salidas y asignaciones suman el total;
- ingreso: entradas y asignaciones suman el total;
- transferencia: una salida y una entrada distintas suman el total, sin reparto;
- todos los importes son positivos y la suma de efectos por moneda es cero.

Cada escritura guarda un snapshot JSON canónico en `entry_revisions` y un evento
mínimo en `ledger_events`. Editar o anular crea revisión; no se borran versiones.
Los balances futuros se derivarán de entradas vigentes.

### D4. Idempotencia persistente y concurrencia explícita

`idempotency_keys` identifica actor, libro y clave, y conserva hash de solicitud y
respuesta confirmada. Repetir la misma clave y hash devuelve el mismo resultado;
reutilizarla con otro hash es conflicto. La revisión del libro permite rechazar
un `expected_revision` obsoleto en lugar de aplicar last-write-wins.

Las operaciones monetarias futuras se harán en un único `DB.batch()` después de
validar el draft completo. El esquema por sí solo no puede expresar sumas entre
filas; los tests de dominio y de integración cubren esas invariantes.

### D5. Límites en dos capas

El Worker rechaza cuerpos declarados mayores a 16 KiB con 413. Los normalizadores
mantienen límites por campo y los endpoints futuros deberán validar también el
tamaño real después de parsear.

Staging usa bindings de Rate Limiting separados: uno por IP para inicio/callback
OAuth y otro por sesión para mutaciones autenticadas. La respuesta 429 incluye
`Retry-After` y request ID. Local y tests usan un limiter inyectable; la ausencia
del binding no habilita ningún bypass en un ambiente remoto configurado.

### D6. Mantenimiento programado conserva historia

Un cron diario elimina sesiones vencidas y sesiones revocadas antiguas. Las
invitaciones adquieren `expires_at`; el cron cambia pendientes vencidas a
`expired` y registra auditoría, sin borrarlas. No toca usuarios, membresías,
libros, movimientos, revisiones ni eventos financieros.

### D7. Backup antes de migrar y restore drill no destructivo

D1 Time Travel sigue siendo la recuperación inmediata. Además, un script obtiene
bookmark y exporta SQL remoto a una carpeta ignorada. El deploy de staging exige
esa exportación antes de aplicar migraciones. Un segundo script importa el dump
en una D1 local nueva y ejecuta consultas de integridad; nunca restaura sobre la
base remota durante un ensayo.

R2 se difiere: antes de producción se deberá elegir plan y retención externa
superior a la ventana de Time Travel. El script deja un artefacto portable desde
ahora sin crear infraestructura prematura.

### D8. Política operativa bloqueante

La documentación distingue datos efímeros, identidad, colaboración, finanzas y
auditoría; fija retención, exportación y condiciones de eliminación. Staging
permanece sintético. Producción y datos financieros reales quedan bloqueados hasta
que exista exportación de producto, eliminación administrada y backup externo con
restore drill del ambiente correspondiente.

## Risks / Trade-offs

- [El esquema precede a la API] → se prueba con fixtures y servicios de dominio;
  cualquier ajuste posterior requiere una migración nueva, no editar la aplicada.
- [Rate limiting distribuido es permisivo] → se usa para abuso, nunca para
  contabilidad ni idempotencia.
- [El export local depende del operador] → staging lo exige antes de migrar;
  producción seguirá bloqueada hasta automatizar copia externa.
- [Snapshots JSON duplican datos] → el volumen inicial es bajo y la capacidad de
  explicar revisiones pesa más que el ahorro.
- [Catálogo monetario incompleto] → se rechaza explícitamente una moneda no
  soportada y se amplía con tests, sin asumir dos decimales.

## Migration Plan

1. Aplicar la migración y tests sólo en D1 local.
2. Ejecutar export y restore drill de staging actual.
3. Configurar bindings de rate limiting y cron en staging.
4. Exportar staging, aplicar migración y desplegar el Worker.
5. Verificar health, límites, cron registrado, logs y tablas sin crear movimientos.
6. Revertir el Worker si falla; las tablas nuevas quedan vacías y compatibles.
7. No desplegar producción ni restaurar remotamente sin aprobación explícita.

## Open Questions

- La retención externa y el bucket R2 se resolverán antes de producción según el
  plan de Cloudflare elegido; no bloquean staging sintético.
- La API exacta de creación/revisión de movimientos pertenece al siguiente
  change y deberá consumir este modelo sin reabrir sus invariantes.
