# Remanso · paquete de traspaso a HomeSuite

Remanso es el primer producto de la mitad "humana" de HomeSuite: meditaciones con tiempo fijo, gong y sonidos de fondo para generar calma en el hogar.

## Qué hay en este paquete

| Archivo | Para qué |
|---|---|
| `remanso-engine.js` | Motor de sonido. JavaScript puro (módulo ES), sin dependencias ni archivos de audio: el gong y los fondos se sintetizan con Web Audio. **Es lo que hay que integrar.** |
| `remanso.html` | Versión de referencia que ya funciona: abrila con doble click en el navegador. Trae adentro una copia del motor, así que no necesita servidor. Sirve para comparar cuando la versión integrada suene o se vea distinta. |
| `INTEGRACION.md` | Este documento. |

> Si cambiás `remanso-engine.js`, la copia que está dentro de `remanso.html` queda desactualizada. La fuente de verdad es `remanso-engine.js`.

## Reglas del producto

**Duraciones:** 1, 2, 5, 10, 20 y 30 minutos.

**Gongs:**

- Hasta 10 min: al inicio, a la mitad y al final.
- Más de 10 min: cada 5 minutos, contando el inicio y el final.
- Los gongs de inicio y de final son distintos de los intermedios: más agudos (Fa3 en vez de Do3), un 50 % más fuertes y alrededor de un 70 % más largos (unos 20 s hasta apagarse).

| Duración | Gongs |
|---|---|
| 1 min | 0:00 · 0:30 · 1:00 |
| 2 min | 0:00 · 1:00 · 2:00 |
| 5 min | 0:00 · 2:30 · 5:00 |
| 10 min | 0 · 5 · 10 |
| 20 min | 0 · 5 · 10 · 15 · 20 |
| 30 min | 0 · 5 · 10 · 15 · 20 · 25 · 30 |

**Fondos** (`ambient`):

| Valor | Qué suena |
|---|---|
| `silencio` | Solo los gongs. |
| `agua` | Olas de duración y fuerza irregulares, con espuma. |
| `lluvia` | Tramos de 4 a 13 s que alternan lluvia suave y chaparrón, más gotas sueltas y gotas gruesas ocasionales. |
| `bosque` | Pájaros variados (cercanos y lejanos) y ráfagas de viento con hojas cada 12 a 37 s. |
| `fuego` | Rumor grave que se aviva y se calma, chasquidos sueltos y en racimo, y algún pop de leña. |
| `noche` | Tres grillos con ritmo propio (a veces alguno se calla un rato) y una rana lejana. |

El fondo entra con un fundido de 4 s al comenzar y se apaga con un fundido de 6 s al terminar, mientras suena el gong final.

**Cierre:** pregunta opcional "¿Cómo te sentís?" con tres opciones: *En calma · Igual · Con inquietud*. Hoy no se guarda en ningún lado (ver decisiones pendientes).

## API del motor

```js
import { RemansoEngine, gongTimes, DURATIONS, AMBIENTS } from './remanso-engine.js';

const engine = new RemansoEngine();

engine.on('tick',  (t) => { /* cada 200 ms: { elapsed, remaining, duration, paused, nextGong: { in, final } | null } */ });
engine.on('pause', (p) => { /* { paused } — también salta si el sistema suspende el audio (p. ej. una llamada) */ });
engine.on('end',   (e) => { /* { early, played, minutes } — early=true si la persona terminó antes */ });

engine.start({ minutes: 10, ambient: 'lluvia', volume: 55 }); // volume 0–100
engine.togglePause();          // o engine.pause() / engine.resume()
engine.setAmbientMuted(true);  // silencia solo el fondo, no los gongs
engine.stop();                 // termina antes, con fundido
engine.testGong();             // toca el gong de inicio/fin
engine.dispose();              // al desmontar la pantalla: libera el audio

gongTimes(20); // → [0, 300, 600, 900, 1200] (segundos)
```

`on()` devuelve una función para desuscribirse.

**Importante:**

1. `start()` y `testGong()` se tienen que llamar **dentro de un click o tap**, porque los navegadores no dejan sonar audio sin un gesto del usuario.
2. El reloj de la sesión es el reloj de audio, no `setInterval`. Por eso, al pausar se congela todo junto (tiempo, gongs y fondo) y los gongs caen exactos.
3. El motor pide mantener la pantalla encendida (Wake Lock) y la libera al terminar o pausar. Si el navegador no lo soporta, sigue funcionando igual.

## Diseño

**Tipografía:** Manrope (Google Fonts), pesos 300 a 700. Los títulos van en 300 y grandes, las etiquetas en 600 y chicas.

**Colores:**

| Token | Hex | Uso |
|---|---|---|
| ground | `#EEF1EA` | Fondo de inicio y cierre |
| surface | `#F8FAF5` | Botones sin seleccionar, tarjetas |
| soft | `#E2E8DF` | Caja de la línea de gongs |
| line | `#C9D2C8` | Bordes |
| ink | `#1F2E28` | Texto, botón principal, selección |
| muted | `#56655E` | Texto secundario |
| brass | `#A8752A` | Gong (decoración, control de volumen) |
| brass-ink | `#7A5418` | Texto "Probar gong" (contraste AA) |
| night | `#15211D` | Fondo durante la sesión |
| night-ink | `#E8EDE6` | Texto y botón de pausa en la sesión |
| night-muted | `#9FB0A7` | Texto secundario en la sesión |
| night-brass | `#C9A063` | Anillo de progreso y marcas de gong |

**Pantallas** (las tres están en `remanso.html`):

1. **Inicio:** duración (grilla 3×2), línea de tiempo con los gongs de esa duración, fondo (grilla 3×2), volumen y "Comenzar · N min".
2. **Sesión:** pantalla oscura, anillo de progreso con una marca por gong, tiempo restante grande, "Próximo gong en m:ss" o "Gong final en m:ss", frase guía y controles terminar / pausar / silenciar fondo.
3. **Cierre:** título según lo que duró ("Veinte minutos de calma", o "N minutos de calma" si terminó antes), estado de ánimo opcional, "Volver al inicio" y "Repetir sesión".

## Decisiones pendientes

- **Dónde vive en la suite:** HomeSuite tiene dos mitades. Una organiza la casa (TasKing, Cuentas Claras, compras) y la otra la cuida (Remanso y lo que venga). Hay que definir cómo se navega entre ambas y cómo se llama cada mitad.
- **Historial:** si conviene guardar `{ fecha, minutos, fondo, ánimo }`, si es por persona o por hogar, y para qué (sin rachas ni presión).
- **Fondos sintetizados o grabados:** sintetizados no tienen licencias ni pesan nada, pero suenan menos realistas. Si se pasa a grabaciones, hay que verificar la licencia de cada archivo uno por uno (por ejemplo, CC0).

## Riesgos a probar en un teléfono real (no verificados)

- **iPhone en modo silencio:** probablemente Web Audio no suene. Probar con el interruptor en ambas posiciones.
- **Pantalla bloqueada o app en segundo plano:** el audio puede cortarse. El Wake Lock lo mitiga mientras la app esté abierta. Si es crítico, evaluar app nativa o PWA con reproducción en segundo plano.
- **Volumen relativo entre fondos:** está calibrado a mano y vale la pena escucharlos todos seguidos.

## Pedido listo para Claude Code

Copiá el paquete en el repo (por ejemplo en `remanso/`) y pegale esto a Claude Code dentro de tas-king:

```
Quiero integrar Remanso en HomeSuite. Está en la carpeta remanso/: leé INTEGRACION.md completo y abrí remanso.html como referencia funcional.

1. Antes de escribir código, explorá el repo y contame: stack, cómo se organizan los productos (TasKing, Cuentas Claras), routing, estilos y dónde iría Remanso. Proponé el plan (5-7 líneas) y los riesgos, y esperá mi OK.
2. Integrá remanso-engine.js tal cual, como módulo, sin reescribir la síntesis de audio.
3. Rehacé las tres pantallas (inicio, sesión, cierre) con los componentes y convenciones del repo, respetando los tokens y las reglas de INTEGRACION.md.
4. Llamá engine.dispose() al desmontar y start()/testGong() solo desde handlers de click.
5. No implementes historial ni la navegación entre las dos mitades de la suite: son decisiones pendientes. Si las necesitás, preguntame.
6. Al terminar, decime cómo probarlo en el celular dentro de la red de mi casa.
```
