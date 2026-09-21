## Context

TasKing funciona hoy como un Worker full-stack con assets, OAuth, D1 y R2. La
portada de HomeSuite tiene otra responsabilidad: contenido público pequeño,
cacheable y sin identidad de usuario. Compartir Worker o carpeta `public/`
acoplaría sus despliegues y haría que el refactor actual de TasKing pudiera
afectar el dominio paraguas.

El dominio raíz y `www` todavía apuntan al parking importado de GoDaddy. El corte
debe ocurrir solamente después de probar el Worker por su URL `workers.dev`.

## Goals / Non-Goals

**Goals:**

- Una portada rápida y legible que presente HomeSuite.
- Un enlace inequívoco a la URL productiva actual de Fun TasKing.
- Señalar Gastos y Compras como próximos módulos sin prometer fechas.
- Aislar código, configuración, pruebas y despliegue del Worker de TasKing.
- Servir HTTPS con una política de seguridad estricta y sin dependencias externas.
- Redirigir `www` al apex conservando path y query string.

**Non-Goals:**

- Resolver todavía marca, logo o sistema visual definitivo.
- Incorporar estado, formularios, cuentas o persistencia.
- Cambiar la URL de TasKing o envolverlo dentro de HomeSuite.
- Activar HSTS antes de que todos los hostnames futuros estén operativos.

## Decisions

### D1. Unidad independiente bajo `apps/site`

`apps/site` tendrá su propio `wrangler.jsonc`, Worker, assets y configuración de
pruebas. No se modifica `public/`, `src/` ni `wrangler.jsonc` de TasKing. Tampoco
se agregan scripts al `package.json` raíz mientras el refactor esté activo; los
comandos se ejecutan con `--config` explícito.

### D2. HTML y CSS sin JavaScript

La primera portada no necesita interacción dinámica. El modo oscuro sigue
`prefers-color-scheme`, de modo que no requiere guardar preferencias ni crear
cookies. Eliminar JavaScript permite declarar `script-src 'none'` y reduce el
trabajo de mantenimiento.

### D3. Worker delante de assets

El Worker recibe las solicitudes antes que el asset server para poder:

- redirigir `www.homesuite.info` al apex con 308;
- rechazar métodos distintos de `GET` y `HEAD`;
- agregar cabeceras de seguridad también a documentos y errores;
- delegar el cuerpo y las cabeceras de cache al binding `ASSETS`.

El costo adicional es aceptable para esta superficie pequeña. Si el catálogo
crece hasta justificarlo, los assets inmutables podrán excluirse del Worker o
recibir hashes y cache largo.

### D4. Navegación a TasKing, no migración

El CTA usa la URL productiva actual
`https://tas-king.pablotortorella.workers.dev`. Es un enlace normal en la misma
pestaña: mantiene expectativas del navegador y no requiere compartir cookies.
Cuando TasKing migre a `app.homesuite.info`, el cambio será una actualización de
contenido independiente.

### D5. Visual provisional deliberadamente simple

La portada usa tipografía del sistema, una paleta cálida y formas CSS. No se
crea un logo que luego condicione el trabajo de identidad. El diseño sí establece
jerarquía, estados disponible/próximamente, foco visible y adaptación móvil.

## Security

Todas las respuestas del Worker incluyen:

- CSP con `default-src 'self'`, `script-src 'none'` y `frame-ancestors 'none'`;
- `X-Frame-Options: DENY`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: no-referrer`;
- una `Permissions-Policy` restrictiva.

No se activa HSTS en este change. Tampoco se agregan recursos de terceros.

## Migration Plan

1. Construir y probar `apps/site` localmente.
2. Desplegar `homesuite-site` sin Custom Domains y revisar la URL `workers.dev`.
3. Con aprobación explícita, retirar los registros de parking del apex y `www`.
4. Asociar ambos Custom Domains al Worker.
5. Verificar certificado, redirección 308, cabeceras, navegación móvil y CTA.
6. Actualizar el estado operativo y la documentación del dominio.

**Rollback:** quitar los Custom Domains del Worker y restaurar temporalmente los
registros anteriores. El Worker de TasKing no participa del corte.

## Open Questions

Ninguna para esta primera versión. El texto y el visual son provisionales y se
revisarán junto con la identidad de HomeSuite.
