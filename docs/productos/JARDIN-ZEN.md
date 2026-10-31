# Jardín Zen · ficha de producto

Hereda [la base común](../homesuite/README.md) y la [plataforma](PLATAFORMA.md).
Su concepto, decisiones de beta v0.2, roadmap, retos, criterios de aceptación y límites están en
[CONCEPTO-Y-ROADMAP.md](../diseno/jardin-zen/CONCEPTO-Y-ROADMAP.md).

Jardín Zen propone un lugar personal de creación libre, con arena, piedras y un
rastrillo. Forma parte de la dimensión «Disfrutar» de HomeSuite; no exige compartir
un hogar ni una cuenta para ser útil. Se distingue de Remanso: es actividad táctil
sin duración impuesta, frente a una meditación con sesiones temporizadas.

## Beta v0.2

- Ruta objetivo HomeSuite App: `/jardin-zen`, accesible sin login.
- Escena WebGL 2 con alternativa Canvas 2D (2.5D), sin bibliotecas externas.
- Cinco surcos por rastrillado; trazo fino 5,6 px por defecto, normal 7,8 px.
- Mover piedras, explorar perspectiva, ondas, alisar toda la superficie y deshacer.
- Audio original sintetizado, optativo y local. No contiene grabaciones de instrumentos japoneses.
- Sin D1, sin migraciones, sin persistencia, sin historial y sin sincronización.

Archivos propios:

- `apps/app/src/jardin-zen.js`: markup desde Worker y registro de ruta.
- `apps/app/public/jardin-zen/jardin-zen.js`: motor beta, extraído del HTML autónomo. Una sola diferencia con el prototipo: el encuadre inicial de la cámara se ajusta a la relación de aspecto del recuadro (`fitDist`; sólo acerca, nunca aleja de 10,2, así que el celular vertical queda igual, y la rueda desactiva el reajuste).
- `apps/app/public/jardin-zen/jardin-zen.css`: CSS adaptado al shell.
- `apps/site/public/jardin-zen.html`: landing pública.
- `docs/diseno/jardin-zen/artefactos/HomeSuite-Jardin-Zen-Beta-v0.2.html`: copia del prototipo autónomo original; no es un asset servido por la app.

**Estado (2026-10-31):** en `main` (PR #124) y en staging (`staging.homesuite.info/jardin-zen`, `site-staging.homesuite.info/jardin-zen`); versiones y
pruebas en [STATUS](../STATUS.md). Se probó a mano en Chrome de escritorio; falta WebGL 2 y tacto en un celular real. **No está en producción**
y no hay autorización para publicarlo.

**Propuesto, sin implementar:** v0.4 (mango invertido, giro suave y rastrillo visible u oculto), cambio OpenSpec
`jardin-zen-rastrillo-v04` y documento en `docs/diseno/jardin-zen/propuestas/`.

## Riesgos abiertos

WebGL real y batería en celular; audio al abandonar la página; disposición móvil con
cabecera compartida; accesibilidad del lienzo; contraste de temas; saturación del
trazo. Ver el roadmap para las decisiones y el protocolo de prueba.
