## 1. Contrato y estructura

- [x] 1.1 Agregar la spec de `landing-publica-homesuite` y validar el change con OpenSpec
- [x] 1.2 Crear `apps/site` sin modificar archivos de aplicación o configuración de TasKing
- [x] 1.3 Configurar el Worker `homesuite-site` sin D1, R2, OAuth ni secretos

## 2. Portada pública

- [x] 2.1 Implementar HTML semántico con bienvenida, propuesta breve y catálogo de tres herramientas
- [x] 2.2 Enlazar Fun TasKing a su URL productiva actual
- [x] 2.3 Marcar Gastos y Compras como próximos módulos sin controles engañosos
- [x] 2.4 Implementar CSS responsive, foco visible y modo oscuro por preferencia del sistema
- [x] 2.5 Agregar favicon y metadatos básicos sin fijar una identidad definitiva

## 3. Worker y seguridad

- [x] 3.1 Servir assets mediante el binding `ASSETS`
- [x] 3.2 Redirigir `www.homesuite.info` al apex con 308 preservando path y query
- [x] 3.3 Restringir métodos y agregar cabeceras de seguridad
- [x] 3.4 Mantener el Worker libre de bindings persistentes y secretos

## 4. Verificación

- [x] 4.1 Pruebas unitarias del proxy de assets, métodos, cabeceras y redirección canónica
- [x] 4.2 E2E de mensaje de bienvenida, catálogo y enlace a Fun TasKing
- [x] 4.3 E2E móvil sin overflow horizontal y con CTA visible
- [x] 4.4 Ejecutar las pruebas aisladas de `apps/site`
- [x] 4.5 Registrar por separado que la suite E2E base de TasKing era inestable antes del cambio

## 5. Preview y publicación

- [x] 5.1 Revisar localmente la portada en navegador real
- [x] 5.2 Desplegar preview `workers.dev` sólo después de autorización
- [x] 5.3 Asociar Custom Domains y retirar parking sólo después de revisión y aprobación explícita
- [x] 5.4 Verificar DNSSEC, HTTPS, redirección, cabeceras y CTA en producción
- [x] 5.5 Actualizar documentación operativa y archivar el change después de publicar
