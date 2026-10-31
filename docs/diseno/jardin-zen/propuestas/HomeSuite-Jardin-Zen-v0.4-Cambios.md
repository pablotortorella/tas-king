# Jardín Zen · beta v0.4 — orientación, giro y visibilidad del rastrillo

**Fecha:** 31 de octubre de 2026. **Base funcional:** beta v0.3, con integración compatible con la beta v0.2 existente en HomeSuite.

## Ajustes acordados

1. **Invertir el mango.** Respecto de la v0.3, la parte larga del rastrillo se gira 180° alrededor del cabezal. Los cinco dientes y la posición de contacto sobre la arena se mantienen. La inversión se aplica a la geometría WebGL 2 y al dibujo alternativo Canvas 2.5D.
2. **Giro más suave.** La dirección objetivo se obtiene del desplazamiento del cursor/dedo; el ángulo mostrado se acerca gradualmente por el arco más corto, amortiguando cambios abruptos. Un desplazamiento muy pequeño no cambia el rumbo. Duración característica aproximada: 185 ms, con límite de rotación por fotograma. La suavidad es de la pieza visual, **no modifica la geometría de los surcos**.
3. **Mostrar u ocultar rastrillo.** Control «Rastrillo visible / Rastrillo oculto», inicialmente visible. Ocultar afecta únicamente el modelo gráfico y el cursor especial; se puede seguir rastrillando, deshacer, mover piedras y girar la cámara. El estado se recuerda en `localStorage` con la clave `homesuite:jardin-zen:rake-visible`; si el almacenamiento no está disponible, se usa el valor predeterminado sin generar errores.

## Criterios de aceptación

- La herramienta visual aparece tanto en WebGL como en el fallback, con el mango invertido respecto de la versión anterior.
- Al entrar con Rastrillar, mover el mouse sin pulsar reposiciona y gira gradualmente el rastrillo **sin crear surcos**. Con contacto/arrastre crea surcos y acompaña el movimiento.
- Invertir repentinamente la dirección no hace que la pieza salte de un ángulo a otro en un solo fotograma.
- El botón se puede utilizar con mouse, tacto y teclado, tiene estado accesible (`aria-pressed`) y funciona en ambas rutas de renderizado.
- Ocultar el modelo no interrumpe un arrastre, no borra trazos ni afecta el ancho fino/normal. El cursor vuelve a ser visible.
- La preferencia persiste en el navegador cuando `localStorage` está disponible; no se transmite al servidor.
- La UI no produce desplazamiento horizontal a 360/390 px.

## Evidencia y límites

- Verificación local de sintaxis `node --check` y de interacción Chromium con fallback Canvas 2.5D: escritorio 1280 px, tamaños 390/360 px y gesto táctil simulado. Sin errores de JavaScript en esas comprobaciones.
- **Pendiente**: validación visual WebGL 2 en navegador compatible (entorno de prueba sin aceleración disponible), sensación del giro en teléfono físico, pruebas completas del monorepo, CI y publicación efectiva en staging.
- No se modifican Remanso, Cuentas Claras, Fun TasKing, la landing pública ni las migraciones.

## Siguientes mejoras posibles (no implementadas)

- Ajustar sensibilidad o suavizado del giro después de probar en teléfono real.
- Desplazar ligeramente la herramienta del dedo en móvil si la mano tapa el cabezal.
- Optimizar el redibujado de Canvas 2.5D en teléfonos de gama baja sin reducir la calidad del trazo.
