# ADR-019: archivos estáticos propios en HomeSuite App

**Fecha:** 2026-10-26

**Estado:** implementado en `feature/remanso`; pendiente de integración

## Contexto

HomeSuite App sirve todo desde el Worker: el HTML son cadenas de plantilla y el CSS
y JS son rutas que devuelven texto. Remanso necesita llevar tal cual un motor de
sonido de ~500 líneas (`remanso-engine.js`) y servirlo como módulo ES, además de su
interfaz y estilos. La política de contenido de la app (`script-src 'self'`,
`style-src 'self'`) impide cualquier código o estilo incrustado.

[ADR-017](ADR-017-frontend-modular-y-cabeceras.md) documentó que un `assets` sin
`run_worker_first` hace que el HTML estático se sirva sin pasar por el Worker, y las
cabeceras de seguridad nunca llegan al documento.

## Decisión

Agregar a `apps/app/wrangler.jsonc` un binding `assets` (`directory: ./public`,
`binding: ASSETS`) **sin `run_worker_first`**. Los archivos que existen en `public/`
los sirve el Asset Worker; todo lo demás va al Worker. Como **ningún HTML vive en
`public/`**, los documentos siguen generándose en el Worker y reciben la política y
las cabeceras; los recursos (JS/CSS) no las necesitan para funcionar porque la
política gobierna el documento que los carga. `public/_headers` agrega
`X-Content-Type-Options: nosniff` a `/remanso/*`.

Controles: una prueba exige que `public/` no contenga `.html` ni `.map`, y un E2E
sobre `wrangler dev` verifica política y cabeceras de todas las rutas HTML y de los
recursos de Remanso (aprendizaje de ADR-017: el handler directo no prueba el ruteo).

## Alternativas consideradas

- **Embeber el motor como cadena en el Worker:** obliga a modificarlo/escaparlo y
  duplica 500 líneas; contradice «integrar tal cual».
- **Regla `Text` de wrangler:** configuración frágil, difiere en Vitest y no entrega
  un archivo cacheable.
- **Otro Worker para Remanso:** duplica dominio, sesión y operación sin necesidad.
- **`run_worker_first` para `/remanso/*` con `ASSETS.fetch`:** añade cabeceras a todo
  pero cuesta una invocación por recurso. Es el plan B si `_headers` no se comporta
  igual en staging que en local.

## Consecuencias

- Cambio aditivo de plataforma: no altera rutas existentes (snapshots de
  caracterización del HTML de la app lo comprueban).
- Quien agregue un `.html` a `public/` captura su ruta sin cabeceras: la prueba falla.
- `_headers` sólo se verificó en `wrangler dev`; el smoke de staging lo confirma.
