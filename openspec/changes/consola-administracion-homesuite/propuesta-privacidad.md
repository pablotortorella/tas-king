# Propuesta de texto: Política de privacidad (tarea 9.1)

**Texto legal que revisa Pablo.** Nada de esto está aplicado en `apps/site/public/privacidad.html`. Cuando Pablo lo apruebe, se aplica,
se cambian «Última actualización» y «entra en vigor», y se sube la versión en `apps/app/src/legal.js`.

**Coordinación con Codex:** la rama `codex/exportacion-completa` ya trae una versión nueva de la política (22 de noviembre de 2026, sin
publicar), con la exportación y los comentarios. Las dos versiones tienen que salir como **una sola versión nueva**, para que cada persona
acepte una vez. Si la exportación se publica antes, esta propuesta se aplica sobre esa versión, con otra fecha.

**Cuándo rige** (design.md, D12). Hay dos opciones; decide Pablo:

1. **Al publicarse** (la propuesta por defecto): la puerta pide aceptar al volver a entrar, y la medición no corre hasta que se acepta.
2. **Con la franja de 15 días** (`upcoming`): hay aviso previo y la medición empieza recién cuando la versión rige.

La política vigente dice «si el tratamiento cambia de forma sustancial, te lo comunicamos antes de que se aplique». Con la opción 1, ese
aviso es la pantalla de aceptación, y nadie queda medido antes de aceptar.

## 1. «Datos que tratamos en la suite»: párrafos nuevos

Van después del párrafo de identificadores de sesión y logs.

> Para saber qué herramientas aportan valor y cuáles conviene mejorar, guardamos en tu cuenta sólo la fecha del último día en que usaste
> HomeSuite, sin hora ni herramienta. Además contamos el uso de cada herramienta de forma agregada: cuántas veces se hizo cada acción por
> día (por ejemplo, movimientos cargados o tarjetas creadas) y cuántas personas distintas usaron cada herramienta en cada día, semana, mes,
> trimestre y año. Esos conteos no guardan quién fue: para no contar dos veces a la misma persona usamos una marca cifrada que se borra al
> terminar cada período. Sólo medimos con la sesión iniciada y después de que aceptes esta política. Jardín Zen y el uso sin cuenta no se
> miden.

> Pablo Tortorella administra la suite y es quien ve esa estadística agregada. Puede designar personas que administren una herramienta
> concreta. Esas personas ven la lista de cuentas de esa herramienta, con nombre y email, y sus totales, pero no el contenido de grupos ni
> de tableros. Registramos quién da o quita esos roles, cuándo se entra a la administración y cada vez que se consulta la lista de cuentas.

## 2. «Fun TasKing (Tareas)»: última oración del tercer párrafo

**Hoy dice:**

> Para administrar el servicio, las personas con rol de administración de Fun TasKing (hoy, Pablo Tortorella) pueden ver la lista de
> cuentas (email y nombre) y totales de uso, en general y por persona (cuántos tableros, tarjetas, comentarios y adjuntos), pero no el
> contenido de los tableros.

**Propuesta:**

> Para administrar el servicio, las personas con rol de administración de Fun TasKing pueden ver la lista de cuentas (email y nombre) y los
> totales del servicio (cuántas cuentas, tableros, tarjetas activas y adjuntos), pero no el contenido de los tableros. Los totales por
> persona (cuántos tableros, tarjetas y comentarios tiene cada cuenta) los ve sólo Pablo Tortorella.

## 3. «Remanso»: tercera oración

**Hoy dice:**

> Hoy no enviamos ni guardamos en el servidor tu estado de ánimo, el historial de sesiones ni el sonido que escuchás.

**Propuesta:**

> No enviamos ni guardamos en el servidor tu estado de ánimo, la duración ni el sonido de tus sesiones, ni un historial de tus sesiones. Si
> entrás con cuenta, al terminar una sesión el navegador avisa sólo si la completaste o la dejaste antes, para la estadística agregada de la
> suite; ese aviso no queda asociado a tu cuenta.

## 4. «Conservación»: oración nueva al final del primer párrafo

> La fecha de tu última actividad se borra con tu cuenta. Las marcas de la estadística de uso se borran al terminar cada período; los
> conteos agregados, que no guardan quién fue, se conservan.

## Qué cambia en las pruebas al aplicarla

Hay que ajustar las pruebas que citan las frases o la versión:
- `apps/site/test/legal.test.js`;
- `apps/app/test/legal-versions.test.js` y `apps/app/test/legal.test.js`.

La prueba de versiones compara la fecha de la página con `legal.js`.
