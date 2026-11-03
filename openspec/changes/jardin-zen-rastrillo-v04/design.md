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

## Decisiones tomadas al implementar

- **El prototipo v0.3/v0.4 no estaba en el repositorio.** Solo se tenía el motor de `main` (rastrillo estático apoyado en el costado) y la
  descripción de los cambios. Se escribió el rastrillo que acompaña al puntero a partir de las medidas de la v0.2 (cinco dientes, cabezal de
  0,54, mango de 0,74) y de la descripción; no se copió código ajeno.
- **Lógica pura aparte.** `apps/app/public/jardin-zen/rake-motion.js` (módulo del mismo origen, sin DOM) concentra el giro suave, el rumbo
  objetivo, las piezas del rastrillo y la preferencia local, para probarlos con unitarias. El motor lo importa; WebGL 2 y Canvas 2.5D usan las
  mismas piezas (`RAKE_PARTS`), así que no hay una excepción por ruta.
- **Qué significa «mango invertido».** Origen local en el punto de contacto (centro de la fila de dientes); el mango queda del lado hacia donde
  se mueve el rastrillo y los dientes quedan atrás, como al arrastrar un rastrillo hacia quien lo sostiene. En reposo (rumbo hacia el fondo) la
  postura es idéntica a la de la v0.2. Es una interpretación: la constante `HANDLE_AHEAD` en `rake-motion.js` la invierte con un cambio.
- **Constantes iniciales.** Constante de tiempo 185 ms; tope 0,3 rad (~17°) por fotograma; fotograma máximo considerado 50 ms; umbral de
  desplazamiento 0,06 unidades del jardín (~1 % del ancho), medido contra el último punto que cambió el rumbo para que el temblor no gire la pieza.
- **Reposo.** Con otra herramienta, al salir el puntero de la arena o al levantar el dedo, el rastrillo vuelve al costado con su rumbo de reposo
  (sin animar la posición). El dedo no tiene «pasar por encima», así que en tacto solo aparece mientras se pulsa.
- **Cursor.** Con Rastrillar activo, rastrillo visible y el puntero sobre la arena, el cursor del sistema se oculta (`cursor: none`) porque el
  modelo hace de cursor; al ocultar el rastrillo, o fuera de la arena, vuelve la cruz.
- **Elevación.** Mientras acompaña al puntero el modelo se eleva 0,08 para que el mango no se hunda en el borde de madera.
- **Texto del control.** El texto cambia («Rastrillo visible» / «Rastrillo oculto») y `aria-pressed` indica si está visible; sin `aria-label`
  aparte, para que el nombre accesible coincida con el texto. El estado apagado se distingue también con borde punteado (no solo por color).
- **Ganchos de prueba.** `#scene-box` expone `data-rake` (`reposo`, `siguiendo`, `oculto`) y `data-rake-heading` (grados); los usa el E2E
  porque el canvas no se puede inspeccionar por rol.
- **Corrección incluida.** En la alternativa 2.5D, `document.querySelector('footer span:last-child')` devolvía `null` (la página no tiene
  `<footer>`) y lanzaba un error antes del primer dibujo; se apunta a `.zen-foot span:last-child`. Sin ese arreglo el fallback arrancaba sin
  dibujar la arena hasta la primera interacción.
- **Redibujo 2.5D.** El dibujo del tablero pasa a un único `requestAnimationFrame` por cambio (antes era sincrónico en cada evento), para no
  repetirlo con el movimiento sin pulsar. No se optimizó el redibujado de la textura (fuera de alcance).

## Decisión posterior a la prueba en staging: un rastrillo por grosor

Pablo probó la v0.4 en staging (mango en el sentido correcto, giro suave) y pidió que el rastrillo tenga el ancho de la huella que deja:
el modelo era ~0,54 unidades de ancho contra ~0,16 del surco fino, y rompía la ilusión.

- **Dos modelos de madera,** uno por grosor (fino 5,6 px y normal 7,8 px), con el mismo mango, la misma madera y el mismo estilo. Al cambiar el
  grosor cambia el modelo, también en reposo y con el rastrillo oculto (el modelo nuevo aparece al volver a mostrarlo). No toca los surcos ya hechos.
- **El ancho se deriva de las constantes del surco, sin números duplicados.** `rake-motion.js` define `TEETH = 5`, `GAP_FINE`, `GAP_NORMAL`,
  `GROOVE_LINE_PX = 3,3`, `TEX_W/TEX_H` (900 × 568) y `WORLD_PER_PX = SAND_W / TEX_W`. El motor dibuja el surco con `grooveOffsets(gap)` (las
  cinco líneas) y el modelo sale de las mismas: los dientes caen en esos desplazamientos, cada uno mide `GROOVE_LINE_PX` y el cabezal mide
  `grooveWidthPx(gap) = 4 · gap + GROOVE_LINE_PX` (25,7 px fino; 34,5 px normal), de borde exterior a borde exterior. En unidades del jardín:
  ~0,163 y ~0,219. Una prueba unitaria impide que el motor vuelva a tener 5,6, 7,8, 3,3, 900 o 568 escritos a mano.
- **Se conservan** el largo del cabezal, de los dientes y del mango, y las alturas de la v0.2 (el mango puede ser el mismo en los dos).
  No se compensa el reflejo claro del surco (~1,7 px), por eso el cabezal coincide con las líneas oscuras.
- **Gancho de prueba:** `#scene-box` expone `data-rake-width` (px de textura, un decimal), siempre actualizado, incluso con el rastrillo oculto.
- Sin cambios en `HANDLE_AHEAD` ni en la constante de 185 ms (confirmados por Pablo en staging).

## Open Questions → decididas

- ¿Qué lado es «invertido»? → mango del lado del avance (ver arriba); confirmar con Pablo al probarlo.
- ¿El rastrillo sigue visible fuera de la arena? → no: vuelve al costado.
- ¿Se anima el regreso al costado? → no, es inmediato (opción más conservadora).
- ¿El ancho fino o normal cambia el modelo? → no; el modelo es el mismo y solo cambia el espaciado de los surcos.
