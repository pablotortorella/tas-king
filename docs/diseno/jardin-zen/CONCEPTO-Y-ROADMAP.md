# HomeSuite · Jardín Zen

**Estado:** beta v0.2 lista para revisión e integración; staging pendiente de desplegar y verificar · 30 de octubre de 2026  
**Territorio de producto:** Disfrutar (con posibles beneficios de autocuidado, sin promesas terapéuticas)  
**Archivo de origen:** `HomeSuite-Jardin-Zen-Beta-v0.2.html` · **Ruta objetivo:** `/jardin-zen`

## 1. Visión

Un pequeño jardín zen digital que invita a dedicar unos minutos a crear patrones, mover piedras y contemplar un paisaje. Debe ser agradable tanto para una persona que vive sola como para alguien que comparte un hogar. No requiere jugar con otras personas.

La experiencia evita puntajes, desafíos obligatorios, rachas, penalizaciones y mensajes de productividad. El jardín no necesita un propósito más allá del placer de usarlo.

### Principios de diseño

1. **Tacto y respuesta:** cada gesto deja una marca inmediata y coherente sobre la arena.
2. **Simplicidad visual:** bandeja de madera, arena clara, piedras irregulares; pocos elementos.
3. **Silencio como opción central:** todo sonido se activa voluntariamente.
4. **Sin presión:** contemplar y no hacer nada también es una interacción válida.
5. **Ligereza:** cargar rápido, funcionar en el celular y no exigir GPU potente.
6. **Privacidad:** la primera versión funciona sin registro ni comunicación con servidores.

## 2. Dirección gráfica

Inspiración: jardines japoneses de paisaje seco *karesansui*, donde las piedras y la grava/arena rastrillada pueden representar paisajes, agua e islas. La propuesta digital es una **interpretación de una bandeja de sobremesa**, no la reproducción exacta de un jardín histórico.

- **Base:** bandeja rectangular con madera clara, borde visible y esquinas discretamente redondeadas.
- **Arena:** marfil cálido con grano muy fino y surcos de contraste suave.
- **Piedras:** tres rocas asimétricas con facetas, en grises verdosos y tonos naturales.
- **Luz:** cálida, lateral, con sombras suaves, sin reflejos plásticos.
- **Cámara:** vista oblicua inicial; movimiento de cámara opcional.
- **Interfaz:** pocos controles, separados del jardín; uso táctil y con mouse.

## 3. Prototipo base y beta v0.2

**La beta v0.2 parte del prototipo autónomo, sin bibliotecas ni servicios externos.** Incluye:

- Escena 3D programática con WebGL 2: arena, marco de madera y piedras.
- Alternativa visual 2.5D en Canvas 2D cuando WebGL 2 no está disponible.
- Rastrillado mediante arrastre: cinco surcos paralelos dibujados en una textura de arena; en v0.2 el rastrillo fino reduce un 28 % el espaciado entre surcos frente al normal, y el ancho elegido queda asociado a cada trazo.
- Reubicación de piedras por arrastre.
- Exploración de cámara por arrastre; acercamiento mediante rueda del mouse.
- Acciones **Ondas**, **Alisar** (toda la superficie) y **Deshacer**; selector **Trazo fino/Trazo normal** (fino por defecto).
- Sonido tonal suave **original, generado en el navegador, opcional**, empleado como sustituto temporal; **no es una grabación de instrumentos tradicionales japoneses**.
- Diseño adaptable a pantallas de escritorio y móviles.

**Límites de esta prueba:** sin persistencia, sin modelos 3D externos, sin sistema de físicas, sin sonidos reales de arena/rastrillo, sin instrumentos japoneses grabados y sin garantías de compatibilidad/rendimiento hasta probarlo en dispositivos reales. La ruta WebGL 2 no pudo visualizarse en el navegador automatizado de pruebas, que bloquea WebGL; sí se comprobó la vista alternativa.

## 4. Evolución por etapas

### Etapa A — Validar el gesto central

**Pregunta:** ¿Rastrillar resulta placentero durante uno o tres minutos sin recibir instrucciones?

Mejorar la continuidad de los surcos, incorporar grosor ajustable del rastrillo y responder con un sonido suave a la velocidad del gesto (solo si se activa). Sumar una herramienta para alisar un área limitada, en lugar de borrar todo.

**Validación:** probar con mouse y tacto, con al menos un celular de gama media y una computadora habitual; observar comprensión inicial, control del trazo y fluidez.

### Etapa B — Jardín personal

Guardar y restaurar la disposición y los trazos en el propio navegador. Incorporar **fotografía de mi jardín** (PNG) y **volver a empezar**. Ofrecer dos o tres tipos de arena, piedras y bandeja, sin convertirlo en un editor recargado.

### Etapa C — Sonido y contemplación

Capas opcionales e independientes:

- Ambiente: naturaleza, brisa, agua o silencio.
- Música: piezas originales o pistas de koto/shakuhachi con licencia de uso apropiada y metadatos de autoría.
- Interacción: roce del rastrillo, desplazamiento de piedras.

Puede haber un modo **Contemplar** que oculte los controles. Si existe un temporizador de respiración, debe ser optativo y no puntuar ni medir estados emocionales.

### Etapa D — Integración HomeSuite

Tratarlo como una experiencia de **Disfrutar**. Empezar por acceso directo para una persona sin necesidad de un grupo compartido. Conservar el estado de forma local primero; evaluar luego sincronización opcional asociada a la cuenta o a un grupo si existe una necesidad real.

Ruta `/jardin-zen` en HomeSuite App, landing `/jardin-zen` en el sitio público y tarjeta en el catálogo. Sin necesidad de cuenta y sin consultas a D1. Evitar incorporar mecánicas colaborativas solo para justificar que pertenece a una suite de hogar.

## 5. Arquitectura sugerida para producción

La prueba demuestra un enfoque sin bibliotecas externas, pero **no implica que convenga mantener un motor 3D propio**.

- **Render:** Three.js con `WebGLRenderer`, por mantenibilidad de cámara, geometrías, luces y eventos.
- **Arena:** un plano 3D con una `CanvasTexture` actualizable; dibujar surcos en el canvas sin construir geometría por cada grano.
- **Piedras:** geometría simple de pocas caras, reutilizable; no necesita física real.
- **Interacciones:** proyectar eventos `pointer` del mouse o pantalla sobre el plano de arena para calcular dónde pintar.
- **Audio:** Web Audio API; reproducción iniciada por el usuario, con controles y silencio como estado inicial.
- **Fallback:** alternativa Canvas 2D o mensaje orientador si WebGL no está disponible.
- **Estado:** estructura serializable con posiciones de piedras, trazos, cámara, estilo elegido y preferencias locales, con límites de historial para controlar memoria.

**Punto de cuidado:** la textura de arena permite una ilusión de relieve, pero la v1 no mueve arena físicamente. Primero conviene verificar si la respuesta sensorial se siente bien antes de introducir simulación de partículas, shaders complejos o renderizado volumétrico.

## 6. Qué dejar afuera al principio

Tienda de elementos decorativos, varias estaciones completas, logros, desafíos, rankings, multijugador, sincronización en tiempo real, partículas de arena individuales, controles numerosos y biblioteca musical grande. Todos aumentarían el costo de implementación antes de saber si el acto de rastrillar produce la experiencia buscada.

## 7. Siguiente decisión recomendada (actualizada)

**Probar el prototipo en el navegador de un celular.** Evaluar tres preguntas: ¿se entiende cómo rastrillar?, ¿los surcos dan una sensación visual satisfactoria?, ¿el jardín invita a permanecer? Si la respuesta a alguna falla, priorizar la calidad del gesto y de la arena antes de sumar funcionalidades.

## Referencias

- Japanese Garden Dictionary, National Institutes for Cultural Heritage: https://www.nabunken.go.jp/org/bunka/jgd/pages/DryLandscapeGarden.html
- Ryoan-ji, Kyoto City Tourism: https://kyoto.travel/en/destinations/ryoanji-temple/
- Three.js, documentación oficial: https://threejs.org/docs/
- WebGLRenderer, documentación oficial: https://threejs.org/docs/pages/WebGLRenderer


## 8. Decisiones cerradas para la beta v0.2

**Acuerdo del 30 de octubre de 2026:** llevar la segunda versión a HomeSuite para probar en staging, manteniendo el look and feel, las herramientas y el audio que resultaron satisfactorios. No agrandar todavía la bandeja: primero evaluar el rastrillo fino y la cantidad de surcos en una sesión de varios minutos.

- El rastrillo tiene cinco dientes. Distancia entre líneas del trazo fino: **5,6 px** en la textura de arena (normal: **7,8 px**), aproximadamente un **28 % menos**.
- El botón alterna fino/normal; el valor predeterminado es fino. Los trazos previos respetan el ancho usado al crearlos.
- Se mantiene el tamaño aparente de la bandeja, la geometría de las piedras y el sonido sintético original.
- El jardín se usa sin login, sin red de datos y sin guardar preferencias en servidor.
- **No** se presenta como «música japonesa» la melodía sintetizada de la beta. Las grabaciones de instrumentos japoneses y sus licencias quedan para otra versión.
- El botón **Alisar** elimina todos los trazos: alisado localizado es una función futura, no una capacidad de la beta.
- No hay medición clínica de relajación ni promesas terapéuticas.

## 9. Integración HomeSuite: diseño del corte

La aplicación ya ofrece Remanso. Jardín Zen es complementario: Remanso propone una pausa temporal guiada; Jardín Zen propone una actividad táctil creativa. Los ejes «Organizar, cuidar, disfrutar» son dimensiones de marca, no menús obligatorios. No se modifica Remanso para acomodar el nuevo producto.

| Pieza | Ruta | Decisión |
|---|---|---|
| Entrada HomeSuite App | `/jardin-zen` | HTML desde el Worker con `page(..., {wide:true})`, shell común, accesible sin cuenta |
| Lógica de la escena | `apps/app/public/jardin-zen/jardin-zen.js` | Motor beta v0.2 sin cambios funcionales; ES script servido desde el mismo origen |
| CSS | `apps/app/public/jardin-zen/jardin-zen.css` | Reglas aisladas del shell; sin `<style>` o atributos `style` en el documento |
| Catálogo de herramientas | `apps/app/src/tools.js` | Tarjeta «Jardín Zen», estado «beta» |
| Landing pública | `apps/site/public/jardin-zen.html` | Copy veraz, entrada a la app; en el sitio staging el Worker reescribe el host de la app |
| Comprobación de coherencia | `scripts/homesuite-coherencia.mjs` | Sumar la landing a la verificación sitio ↔ app |
| Pruebas | `apps/app/test`, `apps/app/e2e`, `apps/site/test` | Rutas, CSP, controles esenciales, enlaces por ambiente |

**Resguardo de arquitectura:** no colocar `.html` en `apps/app/public`; el HTML debe salir por el Worker para recibir la política de contenido, `no-store` y cabeceras. Para esta beta no hace falta nueva migración SQL, binding, servicio, API, secret, dependencia npm ni permiso especial. El sitio y la app se despliegan por separado.

**Operación de staging:** el 29/10 staging estaba ocupado por una rama con cambios de categoría y forma de pago. Integrar con revisión y verificar el SHA antes de publicar para no sobrescribir ese trabajo. La existencia de este paquete/PR no equivale a un despliegue en staging ni a aceptación funcional. Producción requiere aprobación explícita independiente.

## 10. Roadmap priorizado

### P0 — Beta usable en staging

1. Integrar ruta y tarjeta, archivos estáticos externos y landing con enlaces por ambiente.
2. Automatizar smoke de ruta anónima, CSP, `Trazo fino`, alternancia y carga de recursos; revisar coherencia sitio/app.
3. Probar en computador y celular **real**: sensibilidad del dedo, legibilidad de controles, sonido con activación voluntaria, latencia del trazo y funcionamiento de la cámara.
4. Probar WebGL 2 real (no fue posible en el navegador automatizado usado para el prototipo) y el fallback 2.5D. Documentar motor, modelo y resultado.
5. Revisar interacción después de 2–3 minutos. Si los surcos saturan, decidir entre ajustar escala del patrón, número de dientes, composición o área útil antes de cambiar dimensiones.

**Salida de P0:** no hay errores de JS ni CSP; los controles son utilizables en pantalla táctil; los dibujos no saltan ni se congelan; el audio se apaga al pedirlo y al abandonar la página; el registro de pruebas identifica SHA, dispositivo y límites. Una beta pública se evalúa aparte.

### P1 — Mejorar el gesto y la continuidad

- **Alisado localizado:** goma/cepillo con radio visible y deshacer coherente; evaluar costo de reconstruir textura por trazo.
- Ajustar curvas, textura y sensación de profundidad sin simulación de partículas.
- Sonido de fricción ligado a velocidad del rastrillo, de forma opcional y sin reproducción automática.
- Presets seleccionables: arena lisa, círculos concéntricos, ondas; permitir volver al estado anterior.
- Mejorar selección y colisión de piedras, feedback cuando una no se puede tomar y límites claros del borde.
- Cámara: botón «Restablecer vista» y gestos táctiles compatibles (evitar confundir mover cámara con rastrillar).

### P2 — Personalización y conservación

- Guardado **local optativo** del jardín con esquema versionado, límite de historial y acción «Borrar mis jardines»; sin sincronización entre dispositivos por defecto.
- Exportar imagen PNG y configuración JSON sólo si aporta valor real; probar límites de tamaño de almacenamiento.
- Dos o tres acabados de bandeja, arena y piedra, no un editor ilimitado.
- Modo contemplación: ocultar barras y mostrar la composición sin distracciones.
- Accesibilidad: atajos de teclado, alternativa a arrastre y ayudas breves no invasivas.

### P3 — Paisaje sonoro

- Sonidos ambientales con metadatos de autor, licencia, fuente, duración, peso, volumen y capacidad de loop sin cortes.
- Música instrumental japonesa con derechos de sincronización y distribución apropiados (pistas propias o correctamente licenciadas). No usar ni reproducir grabaciones externas sin permiso.
- Mezclador simple: música / ambiente / roce del rastrillo, con silencio claro por defecto y respeto a preferencias de movimiento/sonido.
- Reutilizar patrones de audio de Remanso solo cuando haya una ventaja técnica demostrada; mantener independientes ambas experiencias.

### P4 — Opcionales por evidencia de uso

- Temporizador discreto de contemplación o respiración guiada, **sin rachas**.
- Jardines de ejemplo y composiciones de otras personas para inspirarse, si existe demanda concreta.
- Sincronización optativa con cuenta o grupo del hogar, si guardar en varios dispositivos aporta suficiente valor para compensar datos y complejidad.

## 11. Retos, riesgos y cómo comprobarlos

| Riesgo | Impacto | Mitigación y prueba |
|---|---|---|
| WebGL 2 bloqueado o contexto perdido | Jardín invisible, errores | fallback 2.5D; probar GPU real y forzar fallo de contexto; no asumir cobertura por una captura 2D |
| Rendimiento de redibujado de textura a 900×568 | Latencia al rastrillar o batería | medir FPS, uso de CPU y memoria en celular medio; limitar trabajos por frame y historial; comparar con P1 |
| Touch y gestos nativos | Scroll o zoom accidental, frustración | `touch-action:none` solo sobre lienzo; probar dedo, puntero, rotación y navegación por teclado |
| CSP, caché y aislamiento de assets | Página bloqueada o incompleta | JS/CSS del mismo origen, HTML desde Worker, `no-store` de documento y tests HTTP |
| Contraste con tema claro/oscuro de la suite | Encabezado ilegible | estilos del jardín delimitados y prueba con ambos temas, zoom 200 % |
| Audio en móvil / cambios de pestaña | Sonido suspendido, persistencia inesperada | iniciar desde gesto, pausar/liberar en `pagehide` y `visibilitychange` (pendiente de implementar/validar); pruebas reales Android/iOS |
| Saturación visual por trazos | Pérdida de lugar para jugar | Fino por defecto y alisado; observar sesión prolongada y comparar 5 vs 3 dientes antes de agrandar bandeja |
| Estado no guardado | Pérdida accidental de una composición | comunicar claramente que la beta no guarda; considerar P2 solo tras validación |
| Derechos de música e identidad cultural | Reclamos por contenido no autorizado o confusión | metadatos y licencia por pista; describir la beta como interpretación y sonido sintetizado original |
| Competencia con Remanso / producto recargado | Duplicación y menú saturado | propuesta diferenciada y acceso sencillo, sin introducir objetivos o gamificación |

## 12. Guion de aceptación en staging

**Preparación:** identificar SHA exacto, revisar que la app y el sitio de staging sirvan ese SHA o los cambios esperados; preservar otras pruebas activas.

1. Abrir `https://staging.homesuite.info/jardin-zen` sin iniciar sesión: escena y barra de HomeSuite, sin solicitudes a D1 ni errores de CSP.
2. Arrastrar por la arena con mouse y dedo: aparecen cinco surcos; trazo fino es predeterminado.
3. Elegir «Trazo normal», rastrillar, volver a «Trazo fino» y comprobar que los trazos anteriores no cambiaron de ancho.
4. Reubicar cada piedra, explorar/cambiar perspectiva y verificar que el rastrillado se mantiene.
5. Usar «Ondas», «Alisar» y «Deshacer»: observar qué se borra y qué se mantiene.
6. Activar sonido voluntariamente, apagarlo y abandonar la página: no debe continuar reproduciéndose. **El comportamiento tras `pagehide` requiere comprobación y eventual corrección; no se da por validado en el prototipo.**
7. Probar WebGL 2 y fallback 2.5D, claro/oscuro, móvil de 360 px, zoom 200 %, teclado y ausencia de consola roja.
8. Publicar **ambas** unidades en staging y correr `npm run verify:coherence:staging` para comprobar catálogo y enlaces. No ejecutar el comando de producción.

**Datos recogidos:** fecha, navegador, dispositivo, renderizador, SHA, resultado por paso, observaciones de experiencia y fallos reproducibles. No registrar estado emocional ni datos personales para este experimento.

## 13. Reglas de decisión para la siguiente iteración

- **Si el gesto es cómodo pero el jardín se llena:** priorizar alisado localizado y ajustes de separación/cantidad de dientes.
- **Si se ve pequeño en el celular:** aumentar área visible con controles plegables antes de alterar proporción física de la bandeja.
- **Si el 3D consume demasiado:** limitar renderizado a cambios y analizar la alternativa 2.5D como modalidad de ahorro.
- **Si el sonido acompaña, pero se vuelve repetitivo:** mezclar ambiente y variedad musical licenciada; no añadir un reproductor complejo antes.
- **Si las personas no descubren qué hacer:** incorporar una pista inicial de una línea y retirarla tras la primera acción, sin tutorial obligatorio.

## 14. Estado de implementación y publicación

- Prototipo v0.1: entregado como archivo HTML independiente.
- Beta v0.2: entregada como HTML independiente con rastrillo fino/normal (28 % más estrecho por defecto); vista 2.5D probada en emulación de escritorio/móvil, **WebGL 2 no verificado visualmente**.
- Integración de HomeSuite: paquete de cambios preparado con ruta `/jardin-zen`, assets, catálogo, landing, documento y pruebas.
- **Pendiente:** aplicar y revisar cambios en una rama del repositorio, ejecutar pruebas en el monorepo, abrir PR, resolver compatibilidad con staging compartido, desplegar y comprobar el SHA activo.
- **Producción:** fuera del alcance de esta entrega y condicionada a aprobación nueva.

## 15. Artefacto fuente conservado

La segunda beta autónoma se conserva sin modificaciones en
`docs/diseno/jardin-zen/artefactos/HomeSuite-Jardin-Zen-Beta-v0.2.html`.
La aplicación sirve el HTML desde el Worker, y el CSS y JavaScript extraídos como
archivos estáticos independientes por la política CSP de HomeSuite.
La copia en documentación es una referencia, **no se publica como archivo de la app**.
