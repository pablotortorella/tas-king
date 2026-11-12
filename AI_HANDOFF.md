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

### Integrar las ramas sueltas
- **Qué:** plan de Pablo del 2026-11-10, que se activa con Tareas en producción (ya
  ocurrió). PRs abiertos [#144](https://github.com/pablotortorella/tas-king/pull/144),
  [#149](https://github.com/pablotortorella/tas-king/pull/149),
  [#150](https://github.com/pablotortorella/tas-king/pull/150) y
  [#151](https://github.com/pablotortorella/tas-king/pull/151).
- **Falta:** de a uno: actualizar contra `main`, pruebas, `git cherry` para descartar
  lo ya absorbido y merge sólo con la orden de Pablo.
- **Cuidado:** #144 y #151 reescriben la misma página de privacidad y ambos esperan
  la revisión de Pablo. #150 toca `package.json` y `package-lock.json`. #149 puede
  estar desactualizado: contrastarlo con el estado real del respaldo. La rama
  `docs/dock-homesuite-backlog` tiene un cambio de Pablo sin commitear en su
  máquina: no tocarla sin preguntar.
- **Fecha:** 2026-11-12 (lista de PRs abiertos comprobada en GitHub).

### Extender la PWA a `/tareas`
- **Qué:** pedido de Pablo (bloque de Codex, arriba). Sin rama ni PR.
- **Falta (alcance básico acordado):** página sin conexión propia de Tareas (hoy cae
  en la genérica); `/tareas` en el E2E que comprueba que la caché no guarde datos
  privados; revisar instalación y actualización con Tareas servido; prueba manual en
  Android, escritorio e iPhone. Nada de Tareas sin conexión. Actualizar la ficha de
  [plataforma](docs/productos/PLATAFORMA.md#app-instalable), que todavía dice que
  TasKing queda fuera.
- **Cuidado:** partir de una base que incluya el PR #145. No cachear HTML
  autenticado, API, datos ni adjuntos privados. Archivos compartidos con Tareas:
  `apps/app/src/ui-parts.js`, `apps/app/src/index.js`, `apps/app/public/_headers`;
  pruebas que avisan: `pwa-precarga.test.js`, `shell-characterization.test.js` y
  `e2e/pwa.spec.js`.
- **Fecha:** 2026-11-12.

### Pruebas físicas de la PWA
- **Qué:** la PWA está en producción sin probar en iPhone; el apagado en Android
  tampoco se probó.
- **Falta:** que alguien con iPhone siga el protocolo del bloque PWA del
  2026-11-09 en [STATUS](docs/STATUS.md) y anotar el resultado en la tarea 8.3 de
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
