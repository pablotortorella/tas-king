# Diseño técnico · Jardín Zen beta v0.4

Base: el motor actual de `apps/app/public/jardin-zen/jardin-zen.js` (beta v0.2, con el encuadre de cámara por relación de
aspecto ya incorporado en `main`). La v0.4 se apoya en la v0.3 del prototipo y es compatible con la v0.2 de HomeSuite.

## Decisiones

- **Mango invertido en la geometría, no en el cursor.** Se gira la parte larga 180° alrededor del cabezal en el modelo WebGL 2
  y en el dibujo de la alternativa Canvas 2.5D. Así no hay una excepción por ruta de render.
- **Rumbo y ángulo mostrado son cosas distintas.** El rumbo objetivo se calcula con el desplazamiento del puntero; el ángulo
  dibujado se acerca al objetivo por el arco más corto, con constante de tiempo de ~185 ms y un tope de rotación por
  fotograma. Por debajo de un umbral de desplazamiento el rumbo no se actualiza. El suavizado vive solo en la pieza visual:
  los puntos del surco se siguen tomando del puntero.
- **Mover sin pulsar no dibuja.** Con la herramienta Rastrillar activa, mover el puntero sin contacto reposiciona y gira el
  rastrillo sin crear surcos; con contacto o arrastre se crean surcos como hasta ahora.
- **Visibilidad como estado de presentación.** «Rastrillo oculto» apaga el modelo y el cursor especial, y no interrumpe un
  arrastre, no borra trazos ni cambia el ancho fino o normal. El botón usa `aria-pressed` y es operable con mouse, tacto y
  teclado.
- **Persistencia local y tolerante.** Clave `homesuite:jardin-zen:rake-visible` en `localStorage`, con lectura y escritura
  dentro de `try/catch`; si el almacenamiento no está disponible se usa el valor predeterminado (visible) sin errores. No hay
  red, cuenta ni D1.

## Riesgos y puntos a medir

- El suavizado depende de la sensación en un teléfono real: la constante y el umbral son valores iniciales a ajustar.
- WebGL 2 sin verificar visualmente (el entorno del prototipo no tenía aceleración). El E2E de HomeSuite corre sin WebGL, así
  que solo cubre la alternativa 2.5D: la ruta WebGL queda para prueba manual.
- La mano puede tapar el cabezal en móvil; queda como mejora posible, no incluida.
- Sin desplazamiento horizontal a 360 y 390 px.
- Debe seguir cumpliendo el glosario (`glossary.test.js`) y la CSP: sin `<script>` ni estilos en línea.
