# Estrategia de testing

La verificación combina tests automatizados con una revisión manual breve. El objetivo no es
duplicar trabajo: lo determinista se automatiza y la revisión humana se concentra en aspectos
visuales, interacción física y comportamiento real del navegador.

## Suite automatizada

### Unitarios y de integración

```bash
npm test               # una ejecución
npm run test:watch     # modo interactivo durante desarrollo
```

Vitest se ejecuta dentro del runtime de Cloudflare mediante `@cloudflare/vitest-pool-workers`.
Las migraciones reales se aplican a una D1 aislada y R2 se emula localmente. La suite cubre:

- serialización de tarjetas, comentarios y adjuntos;
- firma, alteración y expiración de sesiones;
- creación automática del tablero personal y prohibición de eliminarlo;
- CRUD de tableros, miembros, tarjetas, comentarios y adjuntos;
- aislamiento entre usuarios y permisos owner/member/admin;
- archivo, restauración, reordenamiento e importación aditiva;
- operaciones reales sobre D1 y R2 emulados.

### End-to-end

La primera vez hay que instalar Chromium:

```bash
npx playwright install chromium
```

Luego:

```bash
npm run test:e2e
npm run test:e2e:ui     # depuración visual
npm run test:all        # Vitest + Playwright
```

Playwright levanta `wrangler dev`, aplica las migraciones y usa un usuario admin exclusivo de
testing. Los datos se guardan bajo `.wrangler/e2e-state`, que está ignorado por Git. Nunca toca
D1, R2 ni secretos de producción.

Los recorridos E2E verifican creación/edición/movimiento/eliminación de tarjetas, importación
CSV aditiva, administración de acceso y comportamiento de atajos al escribir.

## Cuándo agregar tests

- Todo bug corregido debe sumar un test que falle antes de la corrección.
- Toda regla de permisos o transformación de datos debe tener test unitario o de API.
- Todo recorrido nuevo relevante para usuarios debe tener un caso Playwright.
- Al implementar deep-link, agregar casos para URL válida, tarjeta inexistente, tarjeta archivada
  y tarjeta de un tablero sin acceso.
- No probar detalles internos si puede probarse el resultado observable.

## Checklist manual complementario

Ejecutar después de `npm run test:all` antes de un deploy. Una IA o una persona debe registrar
qué navegadores/dispositivos revisó y cualquier diferencia encontrada.

### Siempre

- Abrir la app con un estado realista y confirmar que no hay errores en consola.
- Revisar visualmente header, cinco columnas, tarjetas y modales a 1280 px y 390 px de ancho.
- Arrastrar una tarjeta entre columnas y reordenar dos tarjetas dentro de una columna.
- Comprobar scroll/pan del tablero con mouse y desplazamiento táctil si hay dispositivo disponible.
- Abrir/cerrar los modales con botones, clic fuera y teclado; confirmar foco legible.
- Validar que textos largos, emails y nombres de archivo no rompan el layout.

### Cuando cambia la UI

- Revisar contraste, estados hover/focus/disabled, responsive y zoom del navegador al 200 %.
- Confirmar que las animaciones (confeti y tarjeta terminada) se vean bien y no bloqueen acciones.
- Probar Chrome/Chromium y al menos un segundo motor real (Firefox o Safari/WebKit).

### Cuando cambia autenticación, permisos o datos

- Probar login y logout reales con Google en staging o producción controlada.
- Verificar manualmente un owner, un member, un admin y un usuario sin acceso.
- Confirmar que un usuario no pueda acceder a IDs de tarjetas/tableros ajenos.
- Hacer exportación e importación de una copia descartable y comprobar conteos y caracteres Unicode.
- Para adjuntos, subir, descargar y eliminar una imagen y un documento; comprobar archivos grandes.

### Antes del deploy

1. Ejecutar `npm run test:all`.
2. Completar las secciones manuales afectadas por el cambio.
3. Revisar migraciones sobre una D1 local limpia.
4. Revisar el diff y confirmar que no contiene `.dev.vars`, datos personales ni artefactos.
5. Tras desplegar, hacer un smoke test: login, cargar tablero, crear/editar/eliminar una tarjeta.

## CI

`.github/workflows/test.yml` ejecuta Vitest y Playwright en cada pull request y push a `main`.
Un cambio no debe publicarse si la suite falla. Los tests no sustituyen el smoke test posterior al
deploy porque OAuth, bindings y configuración remota pueden diferir del entorno local.
