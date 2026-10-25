# Artefactos visuales de HomeSuite Cuentas Claras

Estas láminas son la versión visual, en formato de post-its, de los documentos
de producto versionados en `docs/`:

- `journey.html` y `journey.pdf`: [User Journey](../docs/HOMESUITE_CUENTAS_CLARAS_JOURNEY.md).
- `story-map.html` y `story-map.pdf`: [User Story Map](../docs/HOMESUITE_CUENTAS_CLARAS_STORY_MAP.md).

Los HTML son la fuente editable de las láminas y los PDF, de una página A3
apaisada, son una versión cómoda para revisión, impresión o compartir. Ambos
representan decisiones de producto con datos sintéticos: no contienen exports,
nombres, descripciones ni importes reales de usuarios. Al actualizar una fuente
HTML, se debe volver a generar su PDF A3 y verificarlo visualmente antes de
versionarlo. `node visual/render.mjs` (desde la raíz) regenera los PDF y, con
`--snapshot v<producto>-<hito>`, guarda el snapshot en `history/`; ver el
registro en [history/README.md](history/README.md).

Cada post-it indica su estado (Hecho, En revisión o Pendiente) y, cuando
corresponde, los PR donde vive.
