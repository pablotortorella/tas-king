## Context

La landing pública actual presenta una futura herramienta en `/gastos`. La
exploración de plataforma decidió el nombre Cuentas Claras y su URL directa,
porque el producto no se limita a gastos y aún no tiene historia pública que
preservar.

## Decisions

### D1. Ruta canónica directa, sin redirección

El archivo estático se llama `cuentas-claras.html` y Cloudflare Assets lo sirve
en `/cuentas-claras`. `gastos.html` se elimina: una solicitud a `/gastos` recibe
el comportamiento de asset inexistente del sitio, no una redirección ni una
landing alternativa.

### D2. Nombre de producto, términos financieros descriptivos

La tarjeta, título, breadcrumb, metadescripción, canonical y navegación muestran
«Cuentas Claras». Palabras como gasto, ingreso y transferencia siguen apareciendo
como conceptos del contenido, no como nombre de la herramienta.

### D3. Misma superficie mínima

No se incorpora JavaScript, formularios, cookies, CTA de acceso a una app ni
servicios externos. La página mantiene CSS compartido, accesibilidad, modo oscuro
y cabeceras del Worker existente.

## Risks / Trade-offs

Eliminar una URL sería riesgoso con tráfico o enlaces existentes. En este caso se
elige deliberadamente por la ausencia de uso público previo; el test verificará
que no se conserva accidentalmente una redirección.

## Migration Plan

Publicar la landing nueva desde `main` sólo después de revisión local, CI y
aprobación explícita. Verificar `/`, `/cuentas-claras`, `/tareas` y `/compras`;
confirmar que `/gastos` no responde con una redirección ni contenido de producto.
El rollback restaura el asset y enlaces previos mediante el deploy anterior.
