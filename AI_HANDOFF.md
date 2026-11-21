# AI_HANDOFF

Sólo lo que no vive en un PR. **Los PRs abiertos en GitHub son la lista de trabajo
pendiente**; consultarlos primero. Formato, ciclo y cómo encontrar trabajo de otras
sesiones: [método](docs/homesuite/METODO.md#retomar-trabajo-de-otra-sesión).
Al retomar, verificar cada estado antes de actuar. Lo terminado sale de aquí: su
registro está en [STATUS](docs/STATUS.md) y en el PR. Historia anterior al
2026-11-12: [historial](AI_HANDOFF_HISTORIAL.md) (no se lee al inicio).

<!-- BEGIN TASKING PWA HANDOFF -->
## Para Claude Code: TasKing y PWA (actualizado 2026-11-10)

Pedido de Pablo: incorporar TasKing a las tareas PWA que desarrollas. PR #145 ya está integrado en `main` (`74c614ca30697e397a11efa562fa26fb52f952ac`); CI verde y árbol idéntico a `b5383a4`. **Antes de publicar otra rama PWA, parte de una base que incluya este commit**, porque una versión anterior puede volver a servir `/tareas` desde el puente de mudanza.

Recorridos: `/tareas`, API `/api/tareas/*`, subida `POST /api/tareas/cards/:id/attachments`, descarga protegida `/tareas/adjuntos/:key` y favoritos `?card`. Mantener un único manifiesto, SW e iconos de instalación HomeSuite, con favicon de corona por página de Tareas. No cachear HTML autenticado, API, datos ni adjuntos privados. La PWA de HomeSuite sigue bajo tu responsabilidad; el dock continúa separado y fuera de este trabajo.

**Estado publicado:** staging app `4be48cd6`, puente `5bd7074e`, sitio `203b9118`; coherencia 29/29. Producción app `f1e79b44-ce94-414e-8f51-6c7afa07aaca`, puente `06338b44-3447-441f-94bd-2b4729621bd1`, sitio `d268396c-8666-4f06-afcd-5dea42e25cdf`; corte `source=moved`, `destination=active`, cero leases. Se trasladaron 14 tablas, 12 tableros, 101 tarjetas y 5 archivos (manifiesto `985b55cfae3d785f5041b6803002d38f525774903825f4739e3f18573ff573b2`); los backups de producción pre y post se restauraron correctamente. Coherencia de producción: 30/30. Pablo autorizó y se ejecutó esta publicación. **Smoke real de producción confirmado por Pablo el 2026-11-10:** aviso antiguo → Ir a HomeSuite → Google habitual → tableros → edición → adjunto → salir/reingresar; respondió «Sí, todo funciona». No informó navegador ni dispositivo. Los cinco secretos heredados fueron retirados de cada puente TasKing tras comprobar su inventario y ausencia de uso; ambos puentes quedan sin secretos.

**Pruebas PWA y límites:** los E2E cubren PWA instalada antes de entrar a Tareas y retorno sin red (Chromium 79/79; Firefox 77 aprobados y 2 omisiones por emulación). Siguen pendientes ensayos físicos de instalación/actualización en Android/iPhone, Google dentro de la app instalada, cambio de cuenta, deep links/descargas y logout/revocación en dispositivos reales. Pablo confirmó dos cuentas Google en staging; la segunda fue «OK en staging». Invitación, revocación y aislamiento tienen cobertura automatizada; no atribuirles un ensayo manual específico: el smoke real confirmado en producción cubre sólo el recorrido descrito arriba. Ver [STATUS](docs/STATUS.md) y [verificación](docs/tasking/VERIFICACION.md). El change OpenSpec sigue abierto para criterios operativos restantes; no asumir que está archivado.
<!-- END TASKING PWA HANDOFF -->

## Abiertos

### Textos legales: publicados, faltan verificaciones y tareas de Pablo
- **Qué:** change `politica-y-aceptacion`. Pablo aprobó los textos el 2026-11-19
  (#159, versión `2026-11-19`, correo `pablotortorella+homesuite@gmail.com`).
  Ese mismo día se publicó todo con su orden: migración `0014`, sitio, app y
  puerta `LEGAL_GATE` encendida (#160). Versiones en [STATUS](docs/STATUS.md).
- **Falta (Pablo):**
  - probar el acceso y la aceptación en un teléfono real, y anotar el modelo y el
    navegador (tarea 8.2). El 2026-11-20 Pablo ya confirmó que entró y aceptó, sin
    informar el dispositivo;
  - aceptar los DPA de Cloudflare y GitHub, anotar fecha y versión en
    [encargados](docs/HOMESUITE_ENCARGADOS.md) (tarea 6.2);
  - crear la planilla privada de [solicitudes](docs/HOMESUITE_SOLICITUDES_DATOS.md)
    y probarla con un caso ficticio (tarea 5.3);
  - revisar [`scripts/festivos-colombia.json`](scripts/festivos-colombia.json);
  - las decisiones abiertas de [`tasks.md`](openspec/changes/politica-y-aceptacion/tasks.md).
- **Quedaron en el backlog:**
  - aceptación con casilla y aviso de cambios fuera de la app (prioridad 1);
  - eliminar la copia congelada del Fun TasKing original, actualizando la
    política en el mismo PR;
  - analizar si el respaldo permite cumplir la promesa de volver a aplicar las
    supresiones.
- **Cuidado:**
  - Si algo falla con la puerta, se apaga con `"LEGAL_GATE": "off"` en
    `apps/app/wrangler.jsonc` (producción) y publicando la app.
  - En CI, los E2E de Tareas `checklists.spec.js` y `card-mutation-performance.spec.js`
    son inestables.
- **Fecha:** 2026-11-19.

### Correo electrónico: elegir proveedor
- **Qué:** prioridad 3 del [backlog](docs/PRODUCT_BACKLOG.md). Pablo dejó la
  decisión para más adelante y se inclina por un plan gratuito.
- **Falta (Pablo):** leer el [análisis de Brevo y Resend](docs/HOMESUITE_CORREO_PROVEEDORES.md)
  y elegir. La recomendación es Resend.
- **Fecha:** 2026-11-19.

### Cerrar los cambios de OpenSpec
- **Qué:** diagnóstico del 2026-11-17. Los changes con avance no se cierran porque
  faltan verificaciones manuales y el archivo, no código. Hay otros ocho propuestos
  sin ninguna tarea hecha.
- **Falta (decidir con Pablo, de a uno):**
  - `pwa-instalable`: pasar las tareas 6.6 y 9.4, que dependen de Remanso con sonidos
    naturales, a `remanso-sonidos-naturales`. Hacer las pruebas físicas (8.2 a 8.4 y
    8.6, ver «Pruebas físicas de la PWA») y archivar.
  - `perfil-compartido-homesuite` (7/20, sin cambios desde el 2026-10-26): decidir si
    se retoma o si se cierra el primer corte y lo que falta pasa a un change nuevo.
  - `alertas-minimas-homesuite`: en `main` con 2 de 17 tareas marcadas. Marcar las
    hechas y dejar abierto solo el checklist de vigilancia.
- **Cuidado:** criterio propuesto, sin decidir: no abrir un change nuevo hasta cerrar
  uno de los abiertos.
- **Hecho el 2026-11-20:**
  - `migrar-tasking-homesuite`, archivado con los límites de 7.2 y 7.3 aceptados por Pablo;
  - `importacion-como-movimientos`, archivado: no quedaban lotes viejos y la migración
    `0015` retiró las tablas del modelo anterior en staging y producción.
- **Fecha:** 2026-11-20.

### Alertas mínimas: checklist de vigilancia
- **Qué:** con #150 en `main`, desde el 2026-11-13 corren los workflows programados
  (salud cada 30 minutos, antigüedad del respaldo y revisión semanal).
- **Falta (Pablo):** el checklist de [vigilancia](docs/HOMESUITE_VIGILANCIA.md):
  - la etiqueta `alerta-operativa`;
  - los ensayos `simulate`;
  - que lleguen los avisos por correo y en la app;
  - las notificaciones de Cloudflare.
- **Cuidado:** hasta completar el checklist, los avisos no se dan por aceptados.
- **Fecha:** 2026-11-13.

### PWA en `/tareas`: página sin conexión propia (opcional)
- **Qué:** lo básico ya lo hizo Codex con #145 (ver [plataforma](docs/productos/PLATAFORMA.md#app-instalable)).
- **Falta:** solo si Pablo la quiere, una página «Sin conexión» propia de Tareas (hoy
  cae en la genérica). Las pruebas manuales van con «Pruebas físicas», abajo.
- **Cuidado:** no cachear HTML autenticado, API, datos ni adjuntos privados.
- **Fecha:** 2026-11-13.

### Pruebas físicas de la PWA
- **Qué:** la PWA está en producción sin probar en iPhone; el apagado en Android
  tampoco se probó.
- **Falta:** que alguien con iPhone siga el protocolo del bloque PWA del
  2026-11-09 en el [historial de STATUS](docs/STATUS_HISTORIAL.md) y anotar el resultado en la tarea 8.3 de
  [`pwa-instalable`](openspec/changes/pwa-instalable/tasks.md).
- **Cuidado:** si iOS falla, se apaga publicando con `--var PWA_SW:off`.
- **Fecha:** 2026-11-10 (decisión de Pablo).

### Confirmar con Pablo (sin verificar)
- **Qué:** pendientes de sesiones anteriores cuyo estado no consta en el repositorio.
- **Falta:** preguntar a Pablo y, según la respuesta, cerrarlos o pasarlos al
  [backlog](docs/PRODUCT_BACKLOG.md):
  - rotar el secreto de Google (estuvo un rato en GitHub con otro nombre, 2026-10-27);
  - revocar el token de Cloudflare cargado como secreto de red del entorno en la nube
    «tas-king» (2026-11-09; no sirve para publicar por el proxy);
  - decidir cómo publica Claude sin la consola de Pablo (propuesta: workflow de
    GitHub Actions con disparo manual).
- **Fecha:** 2026-11-12.
