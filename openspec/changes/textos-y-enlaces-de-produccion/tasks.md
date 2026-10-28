## 1. Pruebas primero

- [x] 1.1 Sitio: enlaces de producción en el HTML, reescritura en staging y sin cambios en producción.
- [x] 1.2 App: lista de herramientas, tarjetas del inicio y TasKing por ambiente.
- [x] 1.3 Coherencia: caso feliz del repositorio, staging y producción cruzados y los cinco desvíos.

## 2. Implementación

- [x] 2.1 HTML y textos del sitio; términos con la frase sobre versiones beta.
- [x] 2.2 Worker del sitio: reescritura de hosts en staging para cualquier HTML.
- [x] 2.3 App: `tools.js`, `shell.js` y snapshot de `/tareas` revisado.
- [x] 2.4 `scripts/homesuite-coherencia.mjs` y comandos `verify:coherence:staging|production`.
- [x] 2.5 Documentación: operación, plataforma y backlog (exportación y eliminación de grupos con prioridad alta, hallazgos para iPhone).

## 3. Verificación y publicación

- [ ] 3.1 Suites, E2E, OpenSpec estricto y coherencia contra staging tras publicar.
- [ ] 3.2 PR, staging y revisión de Pablo. Producción sólo con su orden, app primero y sitio después.
