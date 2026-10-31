# Compras: particularidades de producto

Hereda la [base común](../homesuite/README.md) y la [plataforma](PLATAFORMA.md).
La [visión](../HOMESUITE_VISION.md) describe la dirección; no acredita implementación.

Marco de marca y copy sugerido en [Identidad y visión](../HOMESUITE_IDENTIDAD_Y_VISION.md)
(§3, §9.5): valor propio sin exigir colaboración y sin anunciar sincronización ni
disponibilidad hasta verificar el estado real. Alcance individual versus compartido por definir.

**Retirado de todos los ambientes (2026-10-28, Pablo):** Compras no existe todavía, así que no se nombra en
ninguna parte: ni tarjeta, ruta ni landing en el sitio público, ni tarjeta ni ruta en la app. Una prueba y la
verificación de coherencia (`npm run verify:coherence:<ambiente>`) impiden que reaparezca. Su landing anterior sigue
en el historial de git (commit `da8626c` y anteriores, `apps/site/public/compras.html`). Cuando la herramienta exista
se reponen la landing, la tarjeta del sitio y de la app, la ruta y su entrada en `apps/app/src/tools.js`.

Todavía no se fijan aquí arquitectura de tiempo real ni reglas detalladas de listas.
Explorar colaboración durante la compra, conectividad intermitente, duplicados,
unidades y resolución de ediciones antes de proponer contratos. Extraer servicios
sólo ante una necesidad observable, según ADR-018. Documentar escenarios y decisiones
propios al iniciar el producto; no copiar el modelo de tareas o el libro financiero.
No hay excepciones propuestas a la base común en esta ficha.
