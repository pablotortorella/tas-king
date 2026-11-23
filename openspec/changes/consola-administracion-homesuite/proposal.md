## Why

Pablo necesita decidir con datos qué herramienta de HomeSuite sacar de la suite y cuál merece más dedicación: el uso es la señal de valor percibido. Hoy no puede: la base no registra cuándo se usó la suite, no hay estadística de uso por herramienta y la única administración que existe es la de Tareas. Esa administración tiene su propio rol (`tasking_identities.is_admin`), su propia pestaña en el tablero general y ningún modo de extenderse a Cuentas Claras. El ítem «Consola de administración» del backlog lo pidió el 2026-10-28, y la exploración con Pablo del 2026-11-22 fijó doce decisiones, que este change recoge.

## What Changes

- **Última actividad por persona:** la cuenta guarda solo la fecha (sin hora, sin herramienta) del último día en que la persona usó la suite con sesión. Se escribe como mucho una vez por persona y por día y se borra con la cuenta.
- **Estadística de uso sin personas:**
  - conteos diarios de acciones por herramienta (por ejemplo, «movimientos cargados» o «tarjetas creadas»), sin ninguna columna de persona y sin borrado;
  - personas distintas por herramienta en dos niveles, «entró» e «hizo algo», exactas por día, semana, mes, trimestre y año;
  - las marcas que evitan contar dos veces a la misma persona se borran al cerrarse cada período, y los contadores quedan para siempre.
- **Foto diaria de la suite:** un cron guarda cada día cuántas cuentas hay y cuántas personas estuvieron activas en el último día, en los últimos 7 y en los últimos 30.
- **Consola en `/consola`:** una sola consola con pestañas:
  - **Suite** (solo para el dueño): personas activas, la tabla por herramienta con los dos niveles y las acciones, con selector de período;
  - **Tareas:** las estadísticas y la lista de cuentas que hoy están en la pestaña de administración de Tareas;
  - **Cuentas Claras:** queda prevista, sin contenido en este change;
  - **Administradores** (solo para el dueño): dar y quitar roles por herramienta, más el historial de roles y de entradas a la consola.
- **Acceso mixto:**
  - el o los dueños se definen en un secreto del Worker por identificador interno de cuenta, nunca por correo;
  - los roles por herramienta viven en una tabla nueva de la base y solo el dueño los da o los quita;
  - quien no tiene rol recibe 404 en `/consola` y en su API.
- **BREAKING (Tareas):** la administración de Tareas pasa a la consola.
  - La marca `is_admin` se migra a roles de la plataforma y deja de leerse.
  - La pestaña «Usuarios» y el botón «Admin» del rol salen del tablero general, y la pestaña «Solicitudes» (vacía) se retira.
  - La pestaña «Actividad» del tablero sigue en Tareas para sus administradores.
  - El ranking de las 10 cuentas más activas de Tareas lo ve solo el dueño.
- **Auditoría:** se registra en `platform_audit_events`, sin correos y solo con identificadores:
  - cada rol dado o quitado;
  - la entrada a la consola, como mucho una vez por persona y por día;
  - cada vista de la lista de cuentas con correos.
  - Los intentos sin permiso quedan solo en los logs del Worker.
- **Remanso con cuenta:** al terminar o abandonar una sesión, el navegador avisa solo el resultado («terminada» o «abandonada»), sin duración, fondo ni estado de ánimo. Sin cuenta, Remanso sigue sin enviar nada.
- **Política de privacidad, versión nueva** (texto legal que revisa Pablo). Tiene que decir:
  - que se guarda la fecha de última actividad;
  - que hay una estadística agregada de uso, incluido el resultado de las sesiones de Remanso con cuenta;
  - que las personas con rol de administración de cualquier herramienta ven la lista de cuentas con sus correos;
  - que el ranking por persona de Tareas lo ve solo el dueño.

  Con la puerta encendida, cada persona la acepta en `/aceptar` al volver.

### Non-goals

- Medir a personas sin cuenta: Jardín Zen, Remanso sin cuenta, el sitio público y las visitas anónimas quedan fuera (decisión de Pablo).
- Personas distintas en rangos arbitrarios (por ejemplo, del 3 de marzo al 17 de abril): solo los períodos de calendario.
- El contenido de la pestaña Cuentas Claras: este change deja la pestaña y el rol, no sus herramientas.
- Mostrar contenido de grupos, movimientos, tableros o tarjetas en la consola.
- Datos históricos anteriores a la publicación: la estadística empieza ese día.
- Servicios de analítica de terceros.

## Capabilities

### New Capabilities

- `consola-administracion-homesuite`: acceso por dueño y roles por herramienta, pestañas, 404 para quien no tiene rol, vista de cuentas, gestión de roles y auditoría de la consola.
- `estadisticas-de-uso-homesuite`: última actividad por persona, conteos diarios de acciones, personas distintas por período cerrado en dos niveles, foto diaria de la suite y qué cuenta como «entró» y «hizo algo» en cada herramienta.

### Modified Capabilities

- `tasking-integrado`: la administración de Tareas deja de ser un rol propio de TasKing y pasa a la consola con un rol de plataforma acotado a Tareas.
- `remanso-entrega`: con cuenta, Remanso informa el resultado de la sesión («terminada» o «abandonada») para la estadística; sin cuenta sigue sin tráfico de datos ni cookies.
- `proteccion-operativa-homesuite`: el mantenimiento programado también borra las marcas de períodos cerrados y guarda la foto diaria; conserva contadores, fotos y auditoría.

## Impact

- **Base de datos:** una migración con:
  - la columna `users.last_active_on`;
  - las tablas de contadores diarios, personas por período, marcas, fotos diarias y roles de plataforma;
  - la copia de los `is_admin` de Tareas a roles, solo para identidades con cuenta HomeSuite.
- **Worker** (`apps/app/src`):
  - un middleware único que traduce rutas exitosas en eventos de uso, sin tocar las rutas de cada herramienta;
  - las rutas `/consola` y `/api/consola/*`;
  - el endpoint de resultado de Remanso;
  - el cron de mantenimiento;
  - el secreto nuevo con los dueños por ambiente.
- **Tareas** (`apps/app/public/tareas/js/admin.js`, `src/tasking/routes/admin.js`, `src/tasking/document.js`): la pestaña de administración se reduce a «Actividad» y suma un enlace a `/consola/tareas`.
- **Remanso** (`apps/app/public/remanso/remanso.js`): un aviso de resultado al final de la sesión, solo con cuenta.
- **Sitio:** `apps/site/public/privacidad.html` y `apps/app/src/legal.js` (versión nueva), y las pruebas del sitio que citan las frases cambiadas.
- **Trabajo en paralelo:** Codex está con «Exportación de datos» y «Comentarios en movimientos». Este change no toca las rutas de Cuentas Claras: las detecta desde el middleware. Las acciones nuevas de esos cambios se suman al catálogo cuando se integren.
- **Costo:** una escritura por persona y por día para la última actividad, y como mucho cinco marcas y cinco contadores la primera vez del día en cada herramienta y nivel, más un contador por acción. Los datos del año ocupan pocos MB.
