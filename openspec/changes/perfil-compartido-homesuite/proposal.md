## Why

Cuentas Claras debe consumir identidad y perfil de HomeSuite desde su inicio.
Copiar el perfil de TasKing dentro de cada producto duplicaría datos, reglas y
permisos; hoy el login de HomeSuite además sobrescribe el nombre en cada acceso.

## What Changes

- Capacidad común de perfil global: nombre para mostrar, selección de fuente del
  nombre y avatar explícito Google/emoji/inicial, con color y alternativa de inicial.
- Inicialización y actualización desde Google que respetan elecciones propias;
  posibilidad de volver al nombre de Google, sin afectar avatar ni apodos.
- Apodo opcional por membresía de espacio, inicialmente vacío, secundario al
  nombre global y editable sólo por la propia persona. Reingresar lo reinicia.
- Contratos de gestión propia y presentación autorizada separados; consumidores
  de Cuentas Claras usan la misma resolución, sin copiar reglas a sus módulos.
- Migración aditiva, control de concurrencia y pruebas de aislamiento, persistencia
  e integración. Actividad anterior muestra perfil/apodo actuales sin reescribir
  datos financieros ni perder autoría por ID estable.

### Non-goals

- UI nueva, componentes visuales, estilos, layout ni refresco en tiempo real.
- Subida de fotos, almacenamiento de imágenes o proxy de fotos de Google.
- Migración de TasKing, cookies compartidas, username público, descripción por
  espacio, avatar por espacio, idioma, tema o notificaciones.
- Construir microservicios de perfiles o reescribir la plataforma financiera.
- Agregar ahora UI/API de salida o expulsión: se define el contrato del apodo al
  perder y recuperar membresía y se prueba en integración.

## Capabilities

### New Capabilities

- `perfil-compartido`: datos, edición propia, integración Google, contratos mínimos
  y resolución común de nombre/avatar para toda la suite.
- `apodo-por-espacio`: apodo secundario asociado a membresía, aislamiento, gestión
  propia, ciclo de vida y presentación en actividad anterior.

### Modified Capabilities

Ninguna spec vigente en `openspec/specs/` define perfil o apodos. Se añaden
capacidades; no se modifican silenciosamente los otros changes en vuelo.

## Impact

- `apps/app/`: módulos de perfil/presentación, usuarios, OAuth, sesiones, rutas,
  membresías, migración y pruebas. Sin cambios de Worker, D1 ni cookie de TasKing.
- Integración con Cuentas Claras: distinguir presentación de autor/miembro y
  nombres de participantes contables; no alterar snapshots, saldos ni revisiones.
- Base de diseño inspeccionada: `main` en `df25195` y referencia local
  `origin/integration/homesuite-design-base` en `973ce4a`. Antes de implementar se
  debe actualizar la comparación contra la base funcional efectivamente elegida.
- Acuerdos en [exploración](../../../docs/HOMESUITE_PERFIL_EXPLORACION.md);
  hereda [base común](../../../docs/homesuite/README.md).
