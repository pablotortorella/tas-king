## 1. Aviso de respaldo fallido

- [ ] 1.1 Agregar al workflow del respaldo diario un job `notify-failure` (`needs: backup`, `if: failure()`, permisos `issues: write` y `contents: read`) que abre o comenta un issue deduplicado con la etiqueta `alerta-operativa`, asignado a `pablotortorella`; verificar con `workflow_dispatch` y una entrada `simulate` que fuerza la falla (se abre, un segundo disparo comenta sin duplicar)
- [ ] 1.2 Crear la etiqueta `alerta-operativa` y verificar que existe antes del primer disparo
- [ ] 1.3 Revisar el texto del issue: sin logs, emails ni nombres de grupos (repositorio público); verificar leyendo el issue generado por la simulación
- [ ] 1.4 Verificar que la notificación del issue llega por correo y por la aplicación móvil de GitHub a la persona asignada, y anotar el resultado en el PR

## 2. Chequeo de salud y antigüedad del respaldo

- [ ] 2.1 Crear `homesuite-production-health.yml` (cada 30 minutos y `workflow_dispatch`; tres intentos con 15 s de separación y `--max-time 10`; exige 200 y el cuerpo `{"status":"ok","service":"homesuite-app"}`; abre, comenta o cierra el issue); verificar con una entrada `simulate` que cubre los tres caminos (caída, tropiezo aislado, recuperación)
- [ ] 2.2 Crear `homesuite-backup-freshness.yml` (diario 20:00 UTC; `gh run list` de la última corrida exitosa; umbral de 26 horas; permisos `actions: read` e `issues: write`); verificar con `simulate` y con el caso de la variable de habilitación en `false` en un fork o con una corrida de prueba
- [ ] 2.3 Registrar durante dos semanas la hora real de salida de cada workflow y ajustar el intervalo del chequeo y el umbral de antigüedad si hubo falsos avisos; anotar el ajuste en el documento de vigilancia

## 3. Revisión semanal

- [ ] 3.1 Crear `homesuite-weekly-ops-review.yml` (lunes 12:00 UTC) que abre el issue con la lista de comprobación y menciona al anterior si sigue abierto; verificar con `workflow_dispatch`
- [ ] 3.2 Escribir la lista de comprobación con las consultas exactas de Workers Logs para `slow_book_open`, `unhandled_error`, `rate_limited`, `csrf_rejected` y `maintenance_completed`, y verificarlas una vez contra producción en solo lectura

## 4. Cloudflare

- [ ] 4.1 Pablo revisa en el panel (Notifications) qué ofrece el plan de la cuenta, activa Incident Alerts, Maintenance Notification, HTTP DDoS Attack Alert y Universal SSL Alert con destino a su correo, y confirma si existe algo específico de Workers o D1
- [ ] 4.2 Registrar en `docs/HOMESUITE_VIGILANCIA.md` la fecha, lo activado, lo que no existía y lo no verificado (plan, retención real de Workers Logs); verificar que el documento no afirma una alerta de errores de Workers sin comprobación

## 5. Documentación y verificación

- [ ] 5.1 Revisar que `privacidad.html` y `terminos.html` no requieren cambios por esta vigilancia (el chequeo no lleva datos personales) y dejar constancia en el PR; cualquier texto que se decida agregar es **texto legal que revisa Pablo**
- [ ] 5.2 Escribir `docs/HOMESUITE_VIGILANCIA.md` (señal, mecanismo, quién se entera, frecuencia, qué hacer; sección «Qué no se vigila»; RPO/RTO propuestos) y enlazarlo desde `docs/homesuite/OPERACION.md` y `docs/HOMESUITE_RECOVERY.md`; verificar los enlaces
- [ ] 5.3 Actualizar la línea de «monitoreo, alertas y revisión de logs» de `docs/HOMESUITE_DATA_LIFECYCLE.md`, `docs/STATUS.md` y el backlog (cerrar el pendiente de «alerta por fallos» del respaldo) sin afirmar aceptación hasta tener la evidencia de 1.4
- [ ] 5.4 Agregar la prueba estática que lee los workflows de vigilancia y falla ante secretos distintos de `GITHUB_TOKEN` o permisos fuera de lo declarado; verificar que falla con un workflow de ejemplo que los viola
- [ ] 5.5 Validar con `openspec validate alertas-minimas-homesuite --strict`, correr la prueba del glosario y abrir el PR sin mergear
