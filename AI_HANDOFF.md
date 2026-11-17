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

### Textos legales: aprobar y publicar
- **Qué:** change `politica-y-aceptacion` ([#151](https://github.com/pablotortorella/tas-king/pull/151)):
  aviso de aceptación, registro en `legal_acceptances`, puerta `LEGAL_GATE` y textos
  unificados de toda la suite (versión 2026-11-13). Nada se publicó.
- **Falta (Pablo):**
  - revisar los textos y quitar las marcas «BORRADOR PENDIENTE DE REVISIÓN DE PABLO»
    (11 en `privacidad.html` y 5 en `terminos.html`);
  - aceptar los DPA de Cloudflare y GitHub, crear la planilla de solicitudes y revisar
    los festivos;
  - las decisiones abiertas de [`tasks.md`](openspec/changes/politica-y-aceptacion/tasks.md).

  Después, publicar con orden explícita, en el orden del
  [plan de migración](openspec/changes/politica-y-aceptacion/design.md#migration-plan):
  migración `0014`, sitio, app con `LEGAL_GATE` apagada y, después de comprobar los
  textos publicados, encender la puerta.
- **Cuidado:**
  - El sitio de `main` trae los borradores: publicarlo por otro motivo publica también
    los textos.
  - La próxima publicación de la app aplica la migración `0014` y muestra el aviso de
    aceptación aunque la puerta esté apagada.
  - Al encender la puerta, las dos cuentas de producción pasan por `/aceptar`.
  - No se probaron el inicio real con Google ni un teléfono real (tarea 8.2).
  - Remanso no lleva el pie legal: es una excepción de diseño y los enlaces van junto
    al botón de acceso.
  - En CI, los E2E de Tareas `checklists.spec.js` y `card-mutation-performance.spec.js`
    son inestables.
- **Fecha:** 2026-11-17.

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
