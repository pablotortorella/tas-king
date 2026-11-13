# Vigilancia de HomeSuite en producción

Vigente desde 2026-11-03 (en la rama `feature/alertas-minimas`, sin integrar). Change:
[`alertas-minimas-homesuite`](../openspec/changes/alertas-minimas-homesuite/proposal.md).
Parte de la [operación común](homesuite/OPERACION.md#vigilancia-y-avisos) y de la
[recuperación](HOMESUITE_RECOVERY.md). Decisión de Pablo (2026-11-02): alertas mínimas con
**GitHub y Cloudflare**, sin servicios de terceros.

**Estado: implementado en una rama, sin integrar ni desplegar, y sin aceptar.** Los workflows
programados solo corren desde `main`. Ningún aviso se probó todavía de verdad: ver el
[checklist de puesta en marcha](#checklist-de-puesta-en-marcha) y no dar este control por
cumplido hasta completarlo.

## Qué se vigila

| Señal | Mecanismo | Quién se entera | Cada cuánto | Qué hacer |
|---|---|---|---|---|
| Falla del respaldo diario | Job `notify-failure` de `homesuite-production-backup.yml`: abre o comenta un issue | Pablo, por la asignación del issue (correo y aplicación de GitHub) | Cada corrida del respaldo (diaria) | [Respaldo fallido](#respaldo-fallido) |
| La aplicación no responde | `homesuite-production-health.yml`: `/healthz`, 3 intentos separados por 15 s, `--max-time 10`; abre o comenta un issue y lo cierra al recuperarse | Pablo, por la asignación del issue | Cada 30 minutos (GitHub puede retrasarlo) | [/healthz no responde](#healthz-no-responde) |
| No hay un respaldo reciente | `homesuite-backup-freshness.yml`: última corrida exitosa del respaldo con menos de 26 horas | Pablo, por la asignación del issue | Diario, 20:00 UTC | [Respaldo desactualizado](#respaldo-desactualizado) |
| `slow_book_open`, 5xx, `unhandled_error`, `maintenance_completed`, respaldos, incidentes, workflows activos | `homesuite-weekly-ops-review.yml`: abre un issue con la lista | Pablo, por la asignación del issue | Lunes 12:00 UTC | [Revisión semanal](#revisión-semanal) |
| Incidentes y mantenimientos de Cloudflare, ataque DDoS HTTP, certificado Universal SSL | Notificaciones del panel de Cloudflare | Pablo, por correo | Cuando ocurren | [Cloudflare](#notificaciones-de-cloudflare) (pendiente de configurar) |

Los cuatro workflows usan solo `GITHUB_TOKEN`, con permisos declarados por trabajo
(`issues: write`, `actions: read` para consultar corridas y `contents: read`). Ninguno recibe el
token de Cloudflare. La prueba `apps/app/test/vigilancia-workflows.test.js` lo verifica en cada
corrida de la suite. La lógica de los avisos vive en `scripts/alertas-operativas.mjs`.

El historial de avisos es el de GitHub (issues y corridas de Actions); no se escribe en
`platform_audit_events` ni en `ledger_events`. **El repositorio es público: los issues también.**
Por eso los avisos llevan el enlace a la corrida, la fecha y la acción sugerida, nunca registros,
emails ni nombres de grupos. Los títulos son fijos y se usan para no duplicar:

- `Alerta: el respaldo diario de producción falló`
- `Alerta: /healthz de producción no responde`
- `Alerta: no hay un respaldo de producción reciente`

Los avisos llevan la etiqueta `alerta-operativa` y se asignan a `pablotortorella`. Si la etiqueta
no existe, el script intenta crearla; si GitHub rechaza la etiqueta o la asignación, abre el issue
igual, sin ellas (un aviso sin etiqueta es mejor que ninguno).

## Qué hacer ante cada aviso

### Respaldo fallido

1. Abrí el enlace a la corrida del issue y mirá en qué paso falló (exportación de D1, subida a R2
   o verificación). El aviso no trae registros: están en la corrida.
2. La última causa conocida fue un permiso del token de Cloudflare (`403` al subir a R2, 30/10 al
   02/11); ver [recuperación](HOMESUITE_RECOVERY.md). Si el paso es de credenciales, revisá
   `HOMESUITE_PROD_BACKUP_API_TOKEN` y los permisos de `homesuite-token`.
3. Cuando se arregle, disparás el respaldo a mano (`workflow_dispatch`) y comprobás que termina en
   verde. Cerrá el issue.

Un respaldo omitido porque `HOMESUITE_PROD_BACKUPS_ENABLED` no vale `true` **no** dispara este
aviso (el job se omite): lo detecta el control de antigüedad.

### /healthz no responde

1. Abrí `https://app.homesuite.info/healthz` desde el teléfono. Debe devolver
   `{"status":"ok","service":"homesuite-app"}`.
2. Si no responde, mirá el estado de Cloudflare y el panel del Worker `homesuite-app`. Si hubo un
   despliegue reciente, evaluá volver a la versión anterior (ver la operación común).
3. El issue se cierra solo cuando el chequeo vuelve a recibir 200 con el cuerpo esperado; mientras
   siga la caída comenta como máximo cada 2 horas.

### Respaldo desactualizado

1. Mirá si el workflow `HomeSuite production backup` está activo y si la variable
   `HOMESUITE_PROD_BACKUPS_ENABLED` vale `true` (Settings, Secrets and variables, Actions).
2. Mirá las últimas corridas: ¿fallaron (debería haber un aviso de respaldo fallido), no salieron o
   salieron con retraso extremo?
3. Disparalo a mano si hace falta. Este aviso **no se cierra solo**: cerralo cuando haya un
   respaldo reciente.

### Revisión semanal

Es una cita, no una alerta. Los lunes a las 12:00 UTC se abre el issue
`Revisión semanal de operación AAAA-Sww` con esta lista (la misma que genera el script):

1. Workers Logs: contá los eventos `slow_book_open` (señal de producto: cuándo pasar a SQL) y revisá `unhandled_error`, `rate_limited` y `csrf_rejected`.
2. Panel de Workers: errores y respuestas 5xx de la semana.
3. `maintenance_completed` aparece todos los días (no hay alerta por su ausencia).
4. Los últimos 7 respaldos están en verde; mirá el tamaño del respaldo y de la base D1.
5. Correos de incidentes y mantenimientos de Cloudflare de la semana.
6. Los workflows de vigilancia siguen activos (ninguno figura como desactivado por inactividad).
7. Issues `alerta-operativa` abiertos: atendelos o cerralos.

Si la revisión anterior sigue abierta, la nueva la menciona. **Puntos que se agregan cuando
existan** (hoy no figuran en el issue, porque las herramientas todavía no existen):

- Solicitudes de datos personales abiertas, con 5 días hábiles o menos y vencidas (planilla y
  `scripts/solicitudes-plazos.mjs` del change `politica-y-aceptacion`).
- Grupos eliminados hace más de 32 días que siguen sin purgar (change `eliminacion-de-grupos`).

Al integrarse cada uno, se suma la línea a `COMPROBACIONES_SEMANALES` en
`scripts/alertas-operativas.mjs` y a esta lista.

#### Consultas de Workers Logs

Los eventos se escriben con `console.log/warn/error("[homesuite-app]", JSON.stringify({ event, ... }))`
(`apps/app/src/index.js`, `apps/app/src/perf.js`). Eventos y nivel:

| Evento | Nivel | Qué significa |
|---|---|---|
| `slow_book_open` | log | Abrir un libro tardó más que el umbral; trae `elapsedMs`, `entries` y `overSqlTrigger` |
| `unhandled_error` | error | Respuesta 500 no prevista; trae `requestId`, método y ruta |
| `rate_limited` | warn | Un límite de tasa rechazó una solicitud |
| `csrf_rejected` | warn | Se rechazó una solicitud sin comprobante válido |
| `maintenance_completed` | log | El cron de mantenimiento terminó; una vez por día (`23 4 * * *`) |

**Sin verificar contra producción** (tarea 3.2b del change, pendiente de Pablo): en el panel de
Cloudflare, Workers & Pages, `homesuite-app`, Observability, buscar el texto del evento entre
comillas, por ejemplo `"event":"slow_book_open"`, con el rango de la semana, y contar los
resultados. Como los eventos son texto JSON dentro del mensaje, la búsqueda de texto debería
alcanzar; si el panel ofrece filtrar por campo, usar el campo del evento. Para mirar en vivo (no
histórico) existe `npx wrangler tail homesuite-app --env production --format json --search '"event":"unhandled_error"'`
(la opción `--search` filtra por texto en los mensajes de consola). Cuando Pablo las pruebe, anotar
acá la fecha y qué consulta funcionó.

**Límite que Pablo debe conocer:** Workers Logs retiene pocos días (3 en el plan gratuito, 7 en el
pago, según la documentación consultada el 2026-11-02; el plan de la cuenta no se verificó). Con 3
días, una revisión semanal solo ve las últimas 72 horas de logs; los 5xx anteriores se ven únicamente
como métrica del panel (retención no verificada). Si eso resulta corto, la revisión puede hacerse
dos veces por semana o el plan puede cambiarse; es una decisión pendiente.

## Notificaciones de Cloudflare

**Estado: sin configurar.** Es una tarea manual de Pablo en el panel (Notifications); no se
puede versionar. Destino: el correo del operador. Registrar el resultado en esta tabla con la
fecha y no afirmar nada que no se haya visto en el panel.

| Notificación | Estado | Fecha | Observación |
|---|---|---|---|
| Incident Alerts (Workers, D1, R2, DNS y red, si el filtro permite elegir esos componentes) | pendiente | — | — |
| Maintenance Notification | pendiente | — | — |
| HTTP DDoS Attack Alert | pendiente | — | — |
| Universal SSL Alert | pendiente | — | — |
| Algo específico de Workers o D1 (si el plan lo ofrece) | pendiente | — | La documentación pública consultada el 2026-11-02 no lo lista |

**No verificado:** el plan de la cuenta (define la retención de Workers Logs y qué notificaciones
existen); si Incident Alerts permite filtrar por esos componentes; si existe alguna notificación de
errores de Workers, D1 o R2. **Este documento no afirma que exista una alerta de errores del Worker**
mientras no se compruebe en el panel; hasta entonces esas señales quedan en la revisión semanal.

## Qué no se vigila

- **Errores 5xx de personas usuarias:** no hay alerta; se ven en la revisión semanal (y los de la
  aplicación completa, solo mientras los logs los retengan).
- **Ausencia del cron de mantenimiento:** no hay aviso si `maintenance_completed` deja de aparecer;
  se mira en la revisión semanal.
- **`slow_book_open`:** es una señal de producto, no un incidente; se cuenta en la revisión semanal.
- **Caída de GitHub Actions:** si Actions no corre, los avisos no salen. Es un límite aceptado.
- **Desactivación de workflows programados por inactividad:** GitHub puede desactivar los
  programados de un repositorio público tras 60 días sin actividad (no verificado en la práctica);
  el síntoma es el silencio. Por eso la revisión semanal incluye comprobar que los workflows de
  vigilancia siguen activos.
- **Retrasos y omisiones de los programados:** GitHub los retrasa o puede omitirlos bajo carga. Las
  corridas del respaldo salieron entre las 10:54 y las 14:00 UTC en lugar de las 05:17. Los umbrales
  tienen holgura (26 h) y el chequeo de salud reintenta, pero un aviso puede llegar tarde.
- **Sitio público (`homesuite.info`) y TasKing:** fuera de alcance.
- **Contenido de R2:** el control de antigüedad confía en que una corrida exitosa ya descargó y
  verificó el objeto (`db:verify-backup`); no lista R2 por su cuenta.
- **Falsos avisos posibles:** un respaldo que GitHub retrase más de 14 horas sobre su hora normal
  dispara el aviso de antigüedad; se acepta.

## RPO y RTO propuestos

Valores por defecto de este change; **los confirma Pablo** (pregunta 1 de `design.md`):

- **RPO ≤ 24 horas** (respaldo diario; Time Travel de D1 permitiría menos, su retención no se verificó acá).
- **RTO ≤ 1 día hábil**, con restauración ensayada (restore drill).

Las alertas vigilan que el respaldo exista y sea reciente; no cambian la retención (R2 expira
`production/` a los 90 días).

## Ensayo de los avisos

Cada workflow tiene `workflow_dispatch` con una entrada `simulate`. Los ensayos abren issues con el
prefijo `[Simulacro]` en el título, así que no tocan ni cierran los avisos reales:

| Workflow | Entrada | Camino que cubre |
|---|---|---|
| `homesuite-production-backup.yml` | `simulate: true` | Falla el respaldo antes de usar secretos; abre el issue y un segundo disparo comenta sin duplicar |
| `homesuite-production-health.yml` | `caida`, `tropiezo`, `recuperacion` | Tres intentos fallidos; un tropiezo aislado (sin issue); recuperación (comenta y cierra) |
| `homesuite-backup-freshness.yml` | `desactualizado`, `al-dia` | Abre o comenta; no hace nada |
| `homesuite-weekly-ops-review.yml` | sin entrada | Abre la revisión de la semana (real); no duplica la de la misma semana |

Después de cada ensayo, cerrar a mano los issues `[Simulacro]`. Un disparo sin `simulate` consulta
producción y las corridas reales.

## Checklist de puesta en marcha

Hecho en la rama (código, pruebas y este documento) y **pendiente de Pablo** (nada de esto se hizo
ni se verificó):

- [ ] Integrar la rama en `main` (los programados solo corren desde la rama por defecto).
- [ ] Crear la etiqueta `alerta-operativa` (rojo, «Aviso automático de operación de HomeSuite») o
      confirmar que el primer aviso la creó; verificar antes del primer disparo.
- [ ] Verificar que el `GITHUB_TOKEN` pueda abrir issues: Settings, Actions, General, Workflow
      permissions. Los workflows piden `issues: write` por trabajo, que funciona con permisos por
      defecto de solo lectura; si el repositorio o la organización restringen los permisos, ajustarlo.
- [ ] Confirmar que las notificaciones de GitHub de Pablo (correo y aplicación móvil) incluyen las
      asignaciones de issues y que el aviso se lee bien en pantalla chica.
- [ ] Disparar a mano cada ensayo de la tabla anterior, comprobar que el issue se abre, no se
      duplica y se cierra, y leer el texto generado (sin registros, emails ni grupos).
- [ ] Probar el caso de la variable `HOMESUITE_PROD_BACKUPS_ENABLED` en `false` (en un fork o con
      una corrida de prueba) y confirmar que la corrida omitida no cuenta como respaldo.
- [ ] Configurar las notificaciones de Cloudflare y completar la tabla de arriba.
- [ ] Confirmar el plan de la cuenta y la retención real de Workers Logs; probar las consultas de
      la revisión semanal en solo lectura.
- [ ] Confirmar RPO/RTO.
- [ ] Durante dos semanas, anotar la hora real de salida de cada workflow y ajustar el intervalo
      del chequeo (30 minutos) y el umbral (26 horas) si hubo falsos avisos.

### Registro de horas de salida y ajustes

| Fecha | Workflow | Hora programada (UTC) | Hora real (UTC) | Falso aviso | Ajuste |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

Corridas programadas del respaldo observadas antes de este change: 2026-10-30 11:23, 2026-10-31
10:54, 2026-11-01 11:49, 2026-11-02 13:28 y 2026-11-03 12:46 (hora programada: 05:17).

## Cuota de GitHub Actions

El chequeo de salud corre 48 veces por día, unos 1.440 por mes, de menos de un minuto cada uno
(GitHub redondea cada trabajo al minuto: ~1.440 minutos por mes). Los repositorios públicos no
consumen la cuota de minutos de los runners estándar de GitHub (según la documentación de
facturación de Actions; no verificado en la cuenta de Pablo). Si el repositorio pasara a privado,
descontaría del plan: 2.000 minutos mensuales en el gratuito.
