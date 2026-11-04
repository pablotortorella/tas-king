# HomeSuite: atención de solicitudes de datos personales

**Estado:** procedimiento propuesto (change `politica-y-aceptacion`, tarea 5.1), pendiente de que Pablo lo lea y lo adopte. No es asesoramiento legal.

**Fecha:** 2026-11-04

Esta página dice cómo se atiende, registra y mide una solicitud de datos personales que llega por correo a `pablotortorella@gmail.com`. La regla funcional vive en el spec `atencion-de-solicitudes-de-datos` del change [politica-y-aceptacion](../openspec/changes/politica-y-aceptacion/design.md) (D9); la referencia normativa, en [HOMESUITE_NORMATIVA_DATOS.md](HOMESUITE_NORMATIVA_DATOS.md) (Ley 1581 de 2012, arts. 8, 14, 15 y 16, y Decreto 1074 de 2015). Los textos que ve la persona están en la [política de privacidad](../apps/site/public/privacidad.html).

Opera las solicitudes únicamente Pablo.

## Tipos y plazos

Los plazos son en días hábiles (lunes a viernes sin festivos de Colombia) y corren desde que llega el correo, no desde que se lee.

| Tipo | Qué es | Plazo | Prórroga | Otros |
|---|---|---|---|---|
| Consulta | conocer sus datos o cómo se usan (acceso) | 10 días hábiles desde el recibo | hasta 5 días hábiles más, con aviso motivado y fecha nueva | el acceso es gratuito |
| Reclamo | corrección, actualización o supresión de datos, o revocación de la autorización | 15 días hábiles desde el día siguiente al recibo | hasta 8 días hábiles más, con aviso motivado | leyenda «reclamo en trámite» dentro de 2 días hábiles; si está incompleto, se pide subsanar dentro de los 5 días siguientes; sin respuesta en 2 meses se entiende desistido; si no es competencia de HomeSuite, traslado en 2 días hábiles |

La prórroga no se usa por comodidad: se usa si hace falta y se avisa **antes** del vencimiento original, con los motivos y la fecha nueva.

Una persona puede quejarse ante la Superintendencia de Industria y Comercio solo después de agotar el trámite ante HomeSuite (Ley 1581, art. 16).

### Cómo cuenta la calculadora

- **Reclamo:** el día 1 es el primer día hábil posterior al recibo (la ley lo dice así).
- **Consulta:** criterio conservador: si el día del recibo es hábil, cuenta como el día 1 (la ley dice «a partir de la fecha de recibo»); así la fecha límite no queda más lejos de lo que la ley permite.
- **Leyenda «reclamo en trámite»:** 2 días hábiles desde el día siguiente al recibo.
- **Subsanación:** 5 días corridos desde el recibo (criterio conservador: vence antes que cinco hábiles). La ley dice «cinco días siguientes» sin aclarar; si una persona abogada lo lee distinto, se ajusta aquí y en el script.
- **Prórroga:** se suma después del plazo original, en días hábiles.

## Planilla privada

El repositorio es público: **la planilla no se guarda en él.** Vive en una hoja privada de Pablo (por ejemplo, una hoja de cálculo propia) y se exporta a CSV, fuera del repositorio, cuando se quiere medir. El repositorio ignora `solicitudes*.csv` y `planilla-solicitudes*` por si se copia uno por error.

Una fila por solicitud. Columnas (en minúscula y sin tildes si se exporta para la calculadora):

| Columna | Contenido |
|---|---|
| `id` | identificador interno `SOL-AAAA-nnn` |
| `tipo` | `consulta` o `reclamo` |
| `recibido` | fecha del correo, `AAAA-MM-DD` |
| `leyenda` | fecha en que se respondió «reclamo en trámite» (solo reclamos) |
| `limite` | fecha límite (puede copiarla de la calculadora) |
| `prorroga` | `si` o `no`; con `si`, anotar abajo la fecha nueva comunicada |
| `prorroga_fecha` | fecha nueva comunicada a la persona |
| `respondido` | fecha de la respuesta de fondo; vacío mientras esté abierta |
| `resultado` | una línea: qué se hizo («suprimido», «corregido», «no procede por …») |

**No se anota** el contenido del reclamo, documentos de identidad, direcciones ni nada más que lo necesario para ubicar el correo (el `id` alcanza: se busca el correo con ese identificador en la etiqueta o el asunto interno). Si hay dudas, se anota menos.

Se registra el mismo día que llega la solicitud.

## Pasos

### Consulta (acceso)

1. Registrar la solicitud con fecha de recibo y calcular la fecha límite.
2. Verificar la identidad: a quien tiene cuenta se le responde en el correo de la cuenta. Si escribe desde otro correo, pedirle que escriba desde el de la cuenta o confirmar de otra forma razonable.
3. Responder dentro del plazo con los datos de la persona, **gratis**: la exportación de sus datos de cuenta y la de cada grupo del que es integrante (ver [exportación del grupo](../openspec/changes/exportacion-completa-del-grupo/proposal.md)). Si no se puede en el plazo, avisar antes del vencimiento con motivos y fecha nueva (prórroga).
4. Anotar `respondido` y `resultado`.

### Reclamo (corrección, actualización, supresión o revocación)

1. Registrar con fecha de recibo y calcular la fecha límite y la fecha de la leyenda.
2. Si falta algo (identificación, hechos o dirección de respuesta), **pedir que lo completen dentro de los 5 días siguientes** (plantilla de subsanación). Si pasan 2 meses sin respuesta, se entiende desistido; anotarlo.
3. Dentro de los **2 días hábiles** siguientes a recibir un reclamo completo, responder con la leyenda «reclamo en trámite» (plantilla de acuse) y anotar `leyenda`. La leyenda se mantiene hasta resolver.
4. Si el reclamo no corresponde a HomeSuite, dar traslado a quien corresponda (si se lo conoce) e informar a la persona, todo dentro de 2 días hábiles.
5. Resolver dentro de los 15 días hábiles (o 23 con prórroga) con la respuesta de fondo.
6. Anotar `respondido` y `resultado`.

### Supresión y revocación: el plazo no espera a la purga física

Un reclamo de supresión **se resuelve dentro del plazo de 15 (o 23) días hábiles aunque la ventana de eliminación de un grupo sea de 30 días.** El grupo ya es invisible desde que se elimina (acceso y uso bloqueados) y la respuesta dice con precisión **qué se suprimió ya, qué persiste y hasta cuándo** (ventana de eliminación, base de datos y copias de seguridad de hasta 90 días) y qué datos ajenos no se pueden suprimir y por qué (por ejemplo, movimientos que pertenecen al historial de otras personas). No existe «eliminar ahora» (decisión de Pablo): se respeta el plazo informando con exactitud, no adelantando la purga.

Lo que se suprima por una solicitud no se restaura: si hay que restaurar una copia de seguridad, antes de usarla se aplican de nuevo las supresiones (ver los changes `eliminacion-de-grupos` y `baja-de-cuenta-homesuite`; hasta que existan, se aplica a mano y se anota en la planilla).

### Personas sin cuenta

La política les dice que escriban al mismo correo. La verificación de identidad de quien no tiene cuenta y el criterio sobre su nombre en el historial compartido los define el change `baja-de-cuenta-homesuite`; hasta entonces, no se entrega ni se suprime nada de un grupo ajeno sin pedirle a la persona una forma razonable de confirmar que es quien dice ser, y se anota en `resultado` qué se decidió.

## Plantillas de respuesta

Se envían desde `pablotortorella@gmail.com` y en el mismo hilo. Los textos entre corchetes se completan. Son propuestas para que Pablo las ajuste; no son asesoramiento legal.

### Acuse con «reclamo en trámite»

> Asunto: Recibimos tu reclamo (SOL-AAAA-nnn): reclamo en trámite
>
> Hola [nombre]. Recibimos tu reclamo el [fecha] sobre [corrección / actualización / supresión de tus datos / revocación de tu autorización]. Queda registrado con la leyenda «reclamo en trámite» y lo vamos a resolver como máximo el [fecha límite]. Si necesitamos más tiempo, te avisamos antes con los motivos y la fecha nueva. Si no estás de acuerdo con la respuesta, después de agotar este trámite podés presentar una queja ante la Superintendencia de Industria y Comercio.
>
> Pablo Tortorella, responsable de HomeSuite

### Pedido de subsanación

> Asunto: Para tramitar tu reclamo (SOL-AAAA-nnn) necesitamos completar algo
>
> Hola [nombre]. Para tramitar tu reclamo necesitamos [tu identificación / que describas los hechos / una dirección donde responderte]. Escribinos con eso dentro de los 5 días siguientes a este mensaje. Si pasan dos meses sin que lo completes, entendemos que desististe del reclamo; podés presentar uno nuevo cuando quieras.
>
> Pablo Tortorella, responsable de HomeSuite

### Prórroga (se envía antes de que venza el plazo original)

> Asunto: Necesitamos más tiempo para tu [consulta / reclamo] (SOL-AAAA-nnn)
>
> Hola [nombre]. No alcanzamos a responder tu [consulta / reclamo] en el plazo de [10 / 15] días hábiles porque [motivo concreto]. Te vamos a responder como máximo el [fecha nueva], que es dentro de [5 / 8] días hábiles más.
>
> Pablo Tortorella, responsable de HomeSuite

### Respuesta de fondo

> Asunto: Respuesta a tu [consulta / reclamo] (SOL-AAAA-nnn)
>
> Hola [nombre]. Respuesta a tu [consulta / reclamo] del [fecha de recibo].
>
> **Qué hicimos:** [entregamos tus datos adjuntos en dos archivos, gratis / corregimos [dato] / suprimimos [datos] / no procede porque [motivo]].
>
> **Qué quedó suprimido ya:** [por ejemplo: tu cuenta y tus datos de perfil ya no son accesibles].
>
> **Qué persiste y hasta cuándo:** [por ejemplo: el grupo [nombre] está en su ventana de eliminación de 30 días y se purga el [fecha]; las copias de seguridad conservan los datos hasta 90 días, hasta el [fecha], y no se restauran].
>
> **Qué no podemos suprimir y por qué:** [por ejemplo: los movimientos que forman parte del historial compartido de otras personas; tu nombre en ellos se [reemplazó por «Persona eliminada» / conserva como «Nombre (cuenta eliminada)»]].
>
> Si no estás de acuerdo con esta respuesta, podés presentar una queja ante la Superintendencia de Industria y Comercio.
>
> Pablo Tortorella, responsable de HomeSuite

## Calculadora de plazos

`scripts/solicitudes-plazos.mjs` lee el CSV exportado de la planilla y lista las solicitudes abiertas con los días hábiles que les quedan, las que vencen en 5 días hábiles o menos, las vencidas y los reclamos a los que les falta la leyenda:

```
node scripts/solicitudes-plazos.mjs ~/ruta/privada/solicitudes.csv
node scripts/solicitudes-plazos.mjs ~/ruta/privada/solicitudes.csv --hoy 2026-11-24
```

Usa `scripts/festivos-colombia.json` (festivos 2026 a 2028, calculados con la regla de la Ley 51 de 1983 y la fecha de Pascua). Si falta el año de una fecha que necesita, el script falla en lugar de contar mal. El informe imprime identificador, tipo y fechas; nunca contenido.

**Lo no verificado:** los festivos **no se compararon con el calendario oficial**; el archivo lo dice (`verificado: false`) y el script avisa en cada corrida. Pablo debe revisarlos una vez por año (por ejemplo con el calendario del Ministerio del Trabajo) y, cuando lo haga, poner `verificado: true`, la fuente y la fecha. Las lecturas conservadoras de la sección «Cómo cuenta la calculadora» tampoco las confirmó una persona abogada.

## Revisión semanal

Cada semana, junto con la revisión de [alertas mínimas](../openspec/changes/alertas-minimas-homesuite/proposal.md) (cuando ese change exista), se corre la calculadora y se atiende lo que figure como **por vencer** (5 días hábiles o menos) o **vencida**. Mientras ese change no exista, esta revisión se hace a mano con el mismo comando. Sumarla a la lista del change de alertas es la tarea 5.4 de `politica-y-aceptacion`.

## Registro de aprobación

| Qué | Estado |
|---|---|
| Procedimiento y plantillas leídos y adoptados por Pablo | pendiente |
| Planilla creada y probada con una solicitud ficticia (tarea 5.3) | pendiente de Pablo |
| Festivos revisados contra el calendario oficial | pendiente de Pablo |
