# Historial visual de Cuentas Claras

`visual/journey.html` y `visual/story-map.html` son las fuentes editables
vigentes. Esta carpeta conserva snapshots de los hitos que cambian la lectura de
producto, para poder recorrer el avance como un tablero físico y no perder el
contexto de decisiones anteriores.

## Convención

- Carpetas: `journey/` y `story-map/`.
- Nombre: `v<producto>-<hito>.<extensión>`, por ejemplo
  `user-story-map-v0.1.1-fundaciones-locales.png`.
- Cada snapshot se acompaña de una entrada en este archivo con fecha, merge o
  deploy de origen, qué post-its pasan a WIP/Done y qué sigue bloqueado.
- Se guardan HTML, PDF y PNG cuando el artefacto cambia. Si un merge/deploy no
  altera Journey ni Story Map, se registra aquí sin duplicar archivos idénticos.
- `v0.1.0` representa alcance inicial; `v0.1.1` es la fundación local integrada
  en PR #59. Los cortes siguientes avanzan el tercer componente semántico según
  el hito, no según la versión técnica de TasKing.

## Registro

| Versión | Hito | Estado reflejado |
|---|---|---|
| v0.1.0 | Alcance inicial | Journey y Story Map de importación/movimientos; plataforma aún pendiente. |
| v0.1.1 | PR #59 — fundaciones locales | Plataforma mínima en WIP: Worker aislado, esquema D1, invariantes y demo local. OAuth, espacios persistidos e invitaciones siguen pendientes. |
| v0.1.2 | Colaboración local | Espacio, owner, invitación y aceptación/rechazo contra D1 local están en WIP validado; OAuth, sesión y despliegue siguen pendientes. Snapshots HTML, PDF y PNG en ambas carpetas. |
