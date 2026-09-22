# HomeSuite — exploración de plataforma mínima

**Estado:** exploración cerrada; insumo del proposal `plataforma-homesuite-minima`

**Inicio:** 2026-09-21

## Resultado del primer corte

Una persona puede entrar con Google, crear un espacio privado de HomeSuite con
un libro vacío de Cuentas Claras e invitar a otra persona. Cuando la invitada entra con
la cuenta de Google cuyo email coincide, puede acceder al mismo espacio. Ninguna
de las dos puede acceder a espacios ajenos.

Este corte corresponde a HG-01 y HG-02 del
[backlog de producto](PRODUCT_BACKLOG.md#próximo-corte-validar-la-migración-de-gastos-a).
No incluye todavía importación, transacciones, balances ni correo transaccional.

## Decisiones tomadas

### D1. Invitación dirigida a un email, sin enlace en el primer corte

El titular escribe el email de Google de la persona a invitar. La invitación se
guarda para ese espacio y sólo se hace efectiva cuando esa dirección inicia
sesión con Google. No habrá enlaces reutilizables, enlaces públicos ni correo
automático inicialmente.

**Por qué:** permite validar colaboración real entre dos personas sin sumar
proveedor de correo, reenvíos, expiración de enlaces ni riesgos de acceso por
quien reciba accidentalmente una URL. El titular comparte la instrucción por el
canal que ya use con la persona invitada.

**Consecuencia:** la interfaz debe dejar explícito que el email debe coincidir
con la cuenta de Google que usará la invitada. El envío de correo y los enlaces
con token quedan como evolución posterior, no como requisito oculto.

### D2. El primer espacio se crea explícitamente y tiene un nombre libre

Después de iniciar sesión, la persona crea su primer espacio con un nombre que
ella elige —por ejemplo, «Casa», «Familia Pérez» o «Viaje a Cartagena»—. No se
crea un espacio automático, no hay tipos predefinidos y el nombre se podrá editar
después.

**Por qué:** el nombre expresa de inmediato el contexto compartido y sirve tanto
para familia como para amistades, viajes o proyectos, sin encasillar la suite ni
dejar una cuenta con un ambiguo «Mi espacio». En el primer recorrido, ese espacio
inicializa un libro vacío de Cuentas Claras.

### D3. La invitación requiere aceptación explícita e identifica al invitante

Cuando la persona entra con la cuenta de Google cuyo email coincide con una
invitación pendiente, HomeSuite muestra el nombre del espacio y **quién la
invitó**. Puede aceptar o rechazar; sólo al aceptar se crea/activa su membresía
y puede consultar Cuentas Claras del espacio.

**Por qué:** evita añadir a alguien a un espacio sin que lo advierta, deja claro
el contexto social de la invitación y ofrece un punto explícito de consentimiento
antes de revelar información compartida.

### D4. Una invitación pendiente puede existir antes del primer acceso

El titular puede invitar la dirección de Google de una persona aunque todavía no
tenga una cuenta HomeSuite. La invitación queda pendiente y, cuando esa dirección
inicia sesión por primera vez en `app.homesuite.info`, se presenta para aceptar o
rechazar. El titular le avisa por su canal habitual; este corte no envía correo.

**Por qué:** la colaboración no exige coordinar primero un alta vacía y no se
introduce infraestructura de correo sólo para la primera prueba. La invitación
sigue dirigida a una identidad concreta, no a quien consiga una URL.

### D5. El titular puede cancelar una invitación pendiente

La lista de participantes muestra las invitaciones pendientes y permite al
titular cancelarlas. La cancelación impide que el email invitado la acepte más
tarde, pero conserva trazabilidad de que existió. Para corregir un email se
cancela la invitación errónea y se crea otra; no se edita silenciosamente el
destinatario.

**Por qué:** es el mínimo necesario para corregir errores o cambios de contexto
sin dejar acceso potencial a una dirección equivocada. No requiere correo ni
enlaces de revocación.

### D6. Antes de aceptar se muestra sólo el contexto indispensable

La invitación pendiente revela únicamente el nombre del espacio, el nombre de
quien invitó y que dará acceso a Cuentas Claras. No muestra integrantes,
movimientos, saldos, cantidades ni actividad antes de que la persona acepte.

**Por qué:** la persona puede tomar una decisión informada sin exponer datos
compartidos a una dirección que todavía no confirmó que quiere participar.

### D7. El primer producto se llama Cuentas Claras

La experiencia financiera de HomeSuite se llama **Cuentas Claras**. El nombre
abarca gastos, ingresos, transferencias y saldos netos compartidos; «Gastos»
queda descartado como etiqueta de producto, aunque se mantenga como término
descriptivo dentro de la interfaz donde corresponda.

### D8. Titular e integrante son los únicos roles iniciales

El titular crea el espacio, puede renombrarlo, invitar personas y cancelar
invitaciones pendientes. El integrante puede aceptar su invitación y acceder a
Cuentas Claras, pero no administra participantes en este corte. El modelo debe
permitir transferir la titularidad entre integrantes en el futuro, aunque esa
acción no tendrá interfaz ni endpoint inicial.

**Por qué:** una responsabilidad administrativa clara reduce errores en la
primera colaboración. Representar ambos roles desde ahora evita bloquear una
transferencia de titularidad posterior sin adelantar sus reglas de producto.

### D9. Cuentas Claras usa su nombre también en la URL, sin compatibilidad

Las superficies nuevas del producto usan `/cuentas-claras`: la landing pública
y la ruta autenticada. La ruta `/gastos` se retira en lugar de conservar una
redirección, porque todavía no hay enlaces externos ni personas usuarias que
dependan de ella.

**Por qué:** alinear nombre, navegación y URL desde el inicio evita acumular una
deuda de denominación. El cambio de la landing pública se implementará en un
change pequeño separado de la plataforma autenticada, para que la publicación de
contenido no se mezcle con OAuth, sesiones y datos.

## Decisiones todavía abiertas

No quedan decisiones de producto bloqueantes para el primer corte.

## Límites que ya vienen decididos

- Google es el único proveedor de identidad inicial; el identificador estable
  será su claim `sub`, no el email.
- La sesión será exclusiva de `app.homesuite.info`; el sitio público no recibirá
  cookie, acceso a datos ni secretos de la aplicación.
- Un espacio puede admitir más productos con el tiempo, pero este primer
  recorrido sólo inicializa Cuentas Claras.
- Los entornos staging y producción tendrán recursos y cliente OAuth separados;
  no se desplegará una sesión o un dato de HomeSuite en el Worker actual de
  TasKing.

## Siguiente decisión

Revisar el proposal OpenSpec y, tras su aprobación, iniciar la implementación.
