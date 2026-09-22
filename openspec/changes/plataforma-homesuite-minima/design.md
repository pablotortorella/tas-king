## Context

`homesuite.info` es un Worker público sin datos, sesión ni secretos. La futura
aplicación autenticada debe vivir en `app.homesuite.info`, con staging aislado en
`staging.homesuite.info`. TasKing seguirá intacto en su Worker y origen actuales.

La primera prueba no modela dinero: sólo demuestra que dos identidades reales
pueden entrar al mismo contexto privado que luego contendrá Cuentas Claras.

## Goals / Non-Goals

**Goals:** identidad Google estable, sesión host-only, aislamiento por espacio,
invitación dirigida y aceptada explícitamente, titular único y una interfaz
mínima para iniciar Cuentas Claras.

**Non-goals:** cualquier cálculo financiero, mensajería, enlaces de invitación,
migración de TasKing, compatibilidad entre subdominios o roles complejos.

## Decisions

### D1. Worker y D1 independientes para la app

`apps/app/` será un Worker Hono full-stack con assets y API bajo el mismo origen.
Usará una D1 por ambiente (`homesuite-app-db` y
`homesuite-app-db-staging`). No se crearán R2 ni backups todavía: no hay archivos
ni registros financieros que respaldar en este corte. Se añadirán cuando una
capacidad real los necesite.

Esto evita mezclar cookies, secretos, despliegues y datos con TasKing; mantiene
una sola unidad transaccional para la plataforma y Cuentas Claras futuros.

### D2. Identidad Google por `sub`, email verificado para invitaciones

Al completar OAuth Authorization Code, el Worker valida issuer, audience,
expiración, firma y `email_verified` del ID token. `sub` identifica de forma
estable a la persona. El email normalizado se guarda como dato de contacto y se
usa para encontrar invitaciones, pero no autoriza por sí solo una sesión ajena.

Cambiar el email que Google declara para el mismo `sub` actualiza el contacto sin
alterar membresías. Una persona sin invitación puede crear su propio espacio;
una invitación pendiente sólo aparece si el email verificado coincide.

### D3. Sesión exclusiva del origen de la app

La cookie se llamará `__Host-homesuite_session`, con `Secure`, `HttpOnly`,
`SameSite=Lax`, `Path=/` y sin atributo `Domain`. Será firmada, tendrá expiración
acotada y contendrá sólo el identificador interno de usuario y metadatos mínimos
de sesión. Cada API protegida cargará el usuario y verificará membresía desde D1;
la cookie nunca concederá acceso a un espacio por sí sola.

El estado de OAuth y el verificador PKCE viven en cookies temporales de la misma
sesión de navegador. `returnTo` sólo acepta paths relativos permitidos.

### D4. Modelo mínimo, auditable y preparado para transferencia futura

La migración inicial define:

| Entidad | Datos esenciales | Invariantes |
|---|---|---|
| `users` | id, google_sub único, email normalizado, nombre visible, timestamps | `google_sub` es inmutable; el email viene verificado por Google |
| `spaces` | id, nombre, timestamps | ningún dato financiero en este corte |
| `memberships` | space_id, user_id, role (`owner`/`member`), joined_at | una persona no se repite; el espacio tiene exactamente un `owner` |
| `invitations` | id, space_id, invitee_email, inviter_user_id, estado, timestamps | sólo una pendiente por espacio/email; el email no se edita |
| `platform_audit_events` | actor, espacio, acción, entidad, timestamps, metadatos mínimos | invitar, aceptar, rechazar y cancelar quedan trazables |

Crear espacio inserta en una misma transacción el espacio y la membresía `owner`.
Aceptar una invitación valida que siga pendiente, crea la membresía `member` y la
marca aceptada en una misma transacción. La autorización de toda ruta comprueba
la membresía vigente. Aunque la transferencia de titularidad queda fuera de UI y
API, `role` no estará codificado como una bandera irreversible.

### D5. Estados y privacidad de la invitación

Una invitación pasa por `pending`, `accepted`, `rejected` o `canceled`. Sólo el
titular puede crear o cancelar una pendiente. La persona invitada ve antes de
decidir exclusivamente: nombre del espacio, nombre del titular que invitó y que
obtendrá acceso a Cuentas Claras. No ve integrantes, conteos, movimientos,
saldos ni actividad.

No se envía correo ni se genera URL. El titular comunica por su canal habitual
que la persona debe entrar en `app.homesuite.info` con el email indicado.

### D6. Recorrido web mínimo

- Sin sesión: una pantalla pública mínima con “Continuar con Google”.
- Sesión sin espacios ni invitaciones: crear espacio, nombre requerido, sin tipos.
- Sesión con invitación pendiente: tarjeta de aceptación/rechazo antes del
  contenido del espacio.
- Sesión con espacio: selector simple y entrada a `/cuentas-claras`, que muestra
  el nombre del espacio y estado vacío listo para el siguiente change financiero.
- Titular: vista de participantes con integrantes e invitaciones pendientes,
  formulario de email y cancelación.

La interfaz no simula importación, saldos ni operaciones antes de que existan.

### D7. Ambientes y operación

Primero se crea y verifica `homesuite-app-staging` con `staging.homesuite.info`,
D1 y cliente OAuth exclusivos. Los secretos se cargan fuera del repositorio. La
prueba de aceptación requiere dos cuentas Google reales autorizadas en staging.
Sólo tras revisión se crean/asocian recursos equivalentes de producción y se
publica `app.homesuite.info` con aprobación explícita.

## Risks / Trade-offs

- Sin correo, la coordinación inicial depende de un canal externo; es aceptable
  para la prueba de dos personas y mantiene pequeño el alcance.
- La coincidencia por email es necesaria para descubrir la invitación; exigir
  `email_verified`, registrar auditoría y pedir aceptación reduce el riesgo.
- OAuth requiere configuración manual en Google Cloud por ambiente. Ningún
  secreto ni URI de entorno equivocado debe quedar en Git.
- El primer shell no debe anticipar estructura financiera: el siguiente change
  agregará el modelo de Cuentas Claras sobre `spaces` y `memberships`.

## Migration Plan

No hay datos de HomeSuite App que migrar. Se crean recursos de staging desde cero,
se aplican migraciones y se verifica la colaboración con datos sintéticos. La
producción nace vacía después de aprobación. Revertir la aplicación elimina el
acceso de la app pero no toca TasKing ni `homesuite-site`; las migraciones no se
deshacen automáticamente.

## Open Questions

No bloqueantes para este corte. La transferencia de titularidad, revocación de
membresías, correo y enlaces se explorarán cuando haya evidencia de uso.
