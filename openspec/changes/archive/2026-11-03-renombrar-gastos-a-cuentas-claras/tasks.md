## 1. Contrato y contenido

- [x] 1.1 Registrar la migración directa de nombre y ruta en OpenSpec.
- [x] 1.2 Reemplazar el asset de landing por `cuentas-claras.html`, con canonical,
  metadatos y texto de producto coherentes.
- [x] 1.3 Actualizar tarjeta de portada y enlaces cruzados para usar Cuentas
  Claras y `/cuentas-claras`.
- [x] 1.4 Eliminar `gastos.html` y no agregar redirección de compatibilidad.

## 2. Verificación

- [x] 2.1 Actualizar pruebas unitarias y E2E para la nueva ruta, nombre,
  cabeceras, modo oscuro y viewport móvil.
- [x] 2.2 Agregar cobertura de que `/gastos` no permanece como landing ni
  redirección.
- [x] 2.3 Validar OpenSpec strict, 7 pruebas unitarias y 14 E2E del sitio, dry-run
  de Wrangler y revisión visual local en escritorio y móvil.

## 3. Integración

- [x] 3.1 Actualizar documentación de navegación de HomeSuite y revisar el diff.
- [x] 3.2 Tras aprobación de revisión local, ejecutar CI y abrir el PR para
  integrar el cambio, sin publicar en producción.
- [x] 3.3 Publicar en producción con aprobación explícita y comprobar las rutas
  públicas resultantes.
