## 1. Pruebas primero

- [x] 1.1 Sitio: contraste de cada acento (claro y oscuro), clases de producto en tarjetas y landings, tres tarjetas, Compras sin enlaces y 404 en `/compras` (Vitest y E2E).
- [x] 1.2 App: acentos por producto en `theme.js` dentro de la prueba de paleta.

## 2. Implementación

- [x] 2.1 CSS del sitio: tokens, borde y rótulo de tarjeta, rótulo de landing e ícono.
- [x] 2.2 Portada con tres tarjetas y landings sin el enlace a Compras; la landing de Compras pasa a `apps/site/pendientes/`.
- [x] 2.3 App: tokens en `theme.js`, clases de tarjeta en `routes/shell.js`, CSS y snapshots revisados.
- [x] 2.4 Remanso: rótulo en ámbar, cubierto por su prueba de contraste.

- [x] 2.5 Rótulo «Versión Beta» en tarjetas, landings y enlaces cruzados; prueba de que no queda «Próximamente» ni «En preparación».

## 3. Verificación y publicación

- [ ] 3.1 Suites (sitio, app, integración, raíz), E2E del sitio y de Remanso, OpenSpec estricto y capturas en claro y oscuro.
- [ ] 3.2 PR, staging de app y sitio y revisión de Pablo antes de integrar.
