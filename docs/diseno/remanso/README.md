# Remanso: paquete de diseño y traspaso

Material de referencia recibido de Claude Design (2026-10-26). **No es código de
producto**: el motor que se ejecuta vive en
`apps/app/public/remanso/remanso-engine.js` y la interfaz en `apps/app/public/remanso/`.

| Archivo | Qué es |
|---|---|
| `INTEGRACION.md` | Reglas del producto, API del motor, tokens del diseño original y decisiones pendientes tal como llegaron |
| `remanso.html` | Versión funcional de referencia. Usa script y estilo en línea y Google Fonts, así que **no corre bajo la política de contenido de la app**; sirve para comparar sonido y aspecto |

Lo que cambió al integrar (ver [ficha](../../productos/REMANSO.md) y el change
`remanso-meditacion`): la paleta y la tipografía del paquete (Manrope, verdes
salvia) se reemplazaron por las de HomeSuite con modos claro y oscuro; el acceso
es libre para sesiones cortas y con cuenta para el resto. Las reglas de duración,
gongs y fondos de `INTEGRACION.md` se conservan.

`remanso.html` trae una copia del motor que puede quedar desactualizada y conserva el
gong original (con «wa-wa»); la fuente de verdad es el archivo de
`apps/app/public/remanso/`. El motor de la app es idéntico al del paquete; los sonidos
de gong elegibles viven en `remanso-gongs.js` (ver la ficha).
