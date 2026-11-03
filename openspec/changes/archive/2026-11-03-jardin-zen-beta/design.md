# Diseño técnico · Jardín Zen beta v0.2

- `apps/app/src/jardin-zen.js` responde `GET /jardin-zen` con el shell compartido.
- Las hojas CSS y scripts son recursos estáticos propios; no se coloca HTML dentro
  de `apps/app/public` para preservar CSP y cabeceras.
- La textura de arena se modifica en Canvas. Geometría WebGL 2 programática y vista
  alternativa Canvas 2D si falta WebGL.
- Sin llamadas de red, cuenta, D1, datos de perfil ni acceso a otros productos.
- La tarjeta en `tools.js` y la landing del sitio son necesarias para mantener la
  coherencia de catálogo verificada por `scripts/homesuite-coherencia.mjs`.
- Las reglas de operación de HomeSuite impiden publicar producción por esta solicitud.

**Riesgos abiertos:** comportamiento del audio al abandonar la página, WebGL 2 en
móvil físico, latencia y uso de batería, accesibilidad sin pointer. No elevar la
beta a aceptación sin evidencia. Ver ficha de producto y roadmap.
