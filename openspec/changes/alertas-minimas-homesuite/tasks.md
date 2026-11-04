## 1. Aviso de respaldo fallido

- [ ] 1.1 Agregar al workflow del respaldo diario un job `notify-failure` (`needs: backup`, `if: failure()`, permisos `issues: write` y `contents: read`) que abre o comenta un issue deduplicado con la etiqueta `alerta-operativa`, asignado a `pablotortorella`; verificar con `workflow_dispatch` y una entrada `simulate` que fuerza la falla (se abre, un segundo disparo comenta sin duplicar)
  - Avance 2026-11-03 (sin marcar: falta la verificación con `workflow_dispatch`, que solo puede hacerse con el workflow en `main`): job `notify-failure` y entrada `simulate` implementados; `actionlint` sin errores; los caminos «se abre» y «un segundo disparo comenta sin duplicar» pasan en `apps/app/test/alertas-operativas.test.js`.
- [ ] 1.2 Crear la etiqueta `alerta-operativa` y verificar que existe antes del primer disparo
  - Avance: el script crea la etiqueta si falta (y abre el issue sin ella si GitHub la rechaza), pero la tarea pide verificar que exista antes del primer disparo, y eso queda para Pablo. Nota: un ensayo local del script contra el `gh` real creó por error la etiqueta (ver el reporte de la rama); verificar su color y descripción.
- [ ] 1.3 Revisar el texto del issue: sin logs, emails ni nombres de grupos (repositorio público); verificar leyendo el issue generado por la simulación
  - Avance: los textos están fijados en `scripts/alertas-operativas.mjs` y probados (sin registros, emails ni grupos); falta leer el issue que genere la simulación real.
- [ ] 1.4 Verificar que la notificación del issue llega por correo y por la aplicación móvil de GitHub a la persona asignada, y anotar el resultado en el PR
  - Espera a Pablo (notificación por correo y aplicación móvil).

## 2. Chequeo de salud y antigüedad del respaldo

- [ ] 2.1 Crear `homesuite-production-health.yml` (cada 30 minutos y `workflow_dispatch`; tres intentos con 15 s de separación y `--max-time 10`; exige 200 y el cuerpo `{"status":"ok","service":"homesuite-app"}`; abre, comenta o cierra el issue); verificar con una entrada `simulate` que cubre los tres caminos (caída, tropiezo aislado, recuperación)
  - Avance (sin marcar: falta `workflow_dispatch` en `main`): workflow implementado; los tres caminos (`caida`, `tropiezo`, `recuperacion`) están cubiertos por pruebas unitarias y por una ejecución local de la CLI. Desviación conservadora: la entrada `simulate` usa el prefijo «[Simulacro]» en el título para no tocar avisos reales, y con la caída sostenida comenta como máximo cada 2 horas.
- [ ] 2.2 Crear `homesuite-backup-freshness.yml` (diario 20:00 UTC; `gh run list` de la última corrida exitosa; umbral de 26 horas; permisos `actions: read` e `issues: write`); verificar con `simulate` y con el caso de la variable de habilitación en `false` en un fork o con una corrida de prueba
  - Avance (sin marcar: falta `workflow_dispatch` en `main` y el caso de la variable en `false`): workflow implementado; umbral, `simulate` y el caso de la corrida omitida cubiertos por pruebas unitarias. La corrida «exitosa» se valida mirando que el trabajo `backup` terminó en éxito, porque una corrida con el trabajo omitido podría figurar como exitosa para la API.
- [ ] 2.3 Registrar durante dos semanas la hora real de salida de cada workflow y ajustar el intervalo del chequeo y el umbral de antigüedad si hubo falsos avisos; anotar el ajuste en el documento de vigilancia
  - Espera dos semanas de datos reales (registro en `docs/HOMESUITE_VIGILANCIA.md`).

## 3. Revisión semanal

- [ ] 3.1 Crear `homesuite-weekly-ops-review.yml` (lunes 12:00 UTC) que abre el issue con la lista de comprobación y menciona al anterior si sigue abierto; verificar con `workflow_dispatch`
  - Avance (sin marcar: falta `workflow_dispatch` en `main`): workflow implementado y probado con el `gh` simulado, incluida la mención de la revisión anterior abierta y la no duplicación de la misma semana.
- [ ] 3.2 Escribir la lista de comprobación (incluidos los puntos 8 y 9 de `design.md` cuando existan `politica-y-aceptacion` y `eliminacion-de-grupos`)
  - Avance: puntos 1 a 7 escritos en el script y en `docs/HOMESUITE_VIGILANCIA.md` (una prueba exige que coincidan). Los puntos 8 y 9 esperan a que existan `politica-y-aceptacion` y `eliminacion-de-grupos`; están listados en el documento como pendientes de agregar.
- [ ] 3.2b Escribir las consultas exactas de Workers Logs para `slow_book_open`, `unhandled_error`, `rate_limited`, `csrf_rejected` y `maintenance_completed`, y verificarlas una vez contra producción en solo lectura
  - Avance: eventos y nivel de log documentados a partir del código; las consultas exactas NO se verificaron contra producción (sin acceso de lectura a Workers Logs desde este entorno). Espera a Pablo.

## 4. Cloudflare

- [ ] 4.1 Pablo revisa en el panel (Notifications) qué ofrece el plan de la cuenta, activa Incident Alerts, Maintenance Notification, HTTP DDoS Attack Alert y Universal SSL Alert con destino a su correo, y confirma si existe algo específico de Workers o D1
  - Espera a Pablo (panel de Cloudflare).
- [ ] 4.2 Registrar en `docs/HOMESUITE_VIGILANCIA.md` la fecha, lo activado, lo que no existía y lo no verificado (plan, retención real de Workers Logs); verificar que el documento no afirma una alerta de errores de Workers sin comprobación
  - Espera a 4.1: el documento tiene la tabla con todo en «pendiente» y declara que no afirma ninguna alerta de errores del Worker.

## 5. Documentación y verificación

- [ ] 5.1 Revisar que `privacidad.html` y `terminos.html` no requieren cambios por esta vigilancia (el chequeo no lleva datos personales) y dejar constancia en el PR; cualquier texto que se decida agregar es **texto legal que revisa Pablo**
  - Avance: revisado el 2026-11-03: `privacidad.html` ya cubre los registros técnicos y la dirección IP («Para operar y proteger el servicio tratamos identificadores de sesión, dirección IP y datos técnicos de las solicitudes. Registramos errores y eventos de seguridad…»); el chequeo de salud consulta `/healthz`, que no lleva ni lee datos personales. Sin cambios en `privacidad.html` ni `terminos.html`. Falta dejar constancia en el PR (no hay PR todavía).
- [x] 5.2 Escribir `docs/HOMESUITE_VIGILANCIA.md` (señal, mecanismo, quién se entera, frecuencia, qué hacer; sección «Qué no se vigila»; RPO/RTO propuestos) y enlazarlo desde `docs/homesuite/OPERACION.md` y `docs/HOMESUITE_RECOVERY.md`; verificar los enlaces
- [ ] 5.3 Actualizar la línea de «monitoreo, alertas y revisión de logs» de `docs/HOMESUITE_DATA_LIFECYCLE.md`, `docs/STATUS.md` y el backlog (cerrar el pendiente de «alerta por fallos» del respaldo) sin afirmar aceptación hasta tener la evidencia de 1.4
  - Avance: `HOMESUITE_DATA_LIFECYCLE.md`, `STATUS.md`, `PRODUCT_BACKLOG.md` y `HOMESUITE_RECOVERY.md` actualizados sin afirmar aceptación. Sin marcar: el pendiente de «alerta por fallos» sigue abierto en el backlog hasta tener la evidencia de 1.4.
- [x] 5.4 Agregar la prueba estática que lee los workflows de vigilancia y falla ante secretos distintos de `GITHUB_TOKEN` o permisos fuera de lo declarado; verificar que falla con un workflow de ejemplo que los viola
- [ ] 5.5 Validar con `openspec validate alertas-minimas-homesuite --strict`, correr la prueba del glosario y abrir el PR sin mergear
  - Avance: `openspec validate --strict` y la prueba del glosario pasan en la rama (ver el reporte de la rama). Falta abrir el PR (no se hace en esta etapa).
