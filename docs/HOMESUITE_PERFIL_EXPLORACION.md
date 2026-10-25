# HomeSuite — exploración de Perfil compartido

**Fecha:** 2026-10-24. **Estado:** acuerdos trasladados a propuesta OpenSpec; sin implementación.
Hereda la [base común](homesuite/README.md) y pertenece a la
[plataforma](productos/PLATAFORMA.md). Esta nota registra acuerdos y preguntas;
no fija todavía esquema SQL, API definitiva ni decisiones visuales.

## Problema y resultado buscado

Cuentas Claras nace como producto de HomeSuite. Perfil es una capacidad de la
plataforma, con datos y gestión comunes que consumen los productos. TasKing se
incorporará después, adaptando su identidad y persistencia cuando corresponda.
Compartir código visual con TasKing no sincroniza por sí solo sus bases actuales.

## Acuerdos con Pablo

- Un perfil por persona para toda la suite; inicialmente nombre, emoji y color.
- Priorizar estructuras de datos, interfaces de software y gestión compartida.
- Resolver la UI más adelante. Puede haber vistas distintas temporalmente;
  no deben convertirse en implementaciones divergentes de las reglas comunes.
- Cuentas Claras consume Perfil de la suite desde su primera implementación.
- Incorporar TasKing de forma posterior y explícita, sin migración automática
  por coincidencia de email ni intercambio de cookies entre aplicaciones.
- Inicializar nombre y foto desde Google cuando estén disponibles; sin foto
  disponible, mostrar la inicial del nombre.
- Permitir personalizar nombre, emoji y color. Los logins posteriores conservan
  esa personalización. Elegir emoji debe poder sustituir la foto inicial.
- En cada login, actualizar nombre/foto que sigan vinculados a los datos de
  Google. Conservar las elecciones personalizadas de forma independiente para
  cada campo: personalizar el nombre no congela la foto automática y viceversa.
- Guardar la referencia de foto entregada por Google, sin copiar la imagen al
  almacenamiento de HomeSuite en este corte. Si falta o no carga, mostrar la inicial.
- Permitir elegir emoji o inicial explícitamente; conservar esa elección aunque
  Google vuelva a entregar una foto. Una ausencia/falla de imagen no equivale a
  una elección explícita de la persona.
- El avatar es la representación visual de la persona, con un único modo elegido:
  Google, emoji o inicial. El modo se guarda explícitamente, no se deduce por
  presencia de foto o emoji.
- En modo Google se muestra la foto y, si falta o falla, la inicial. La alternativa
  visual no cambia el modo elegido. En emoji/inicial se usa el color de fondo.
- Elegir emoji o inicial reemplaza visualmente la foto, sin borrar su referencia;
  se puede volver a elegir Google. Emoji y color pueden conservarse mientras se
  muestra la foto. La personalización del avatar es independiente de la del nombre.
- Cada persona consulta y edita su propio perfil. Integrantes con un espacio
  compartido ven nombre y avatar; ser titular no habilita editar perfiles ajenos.
- El contrato de presentación no expone email, identidad Google ni datos de sesión.
  Esto no cambia las reglas del email usado para invitaciones.
- En actividad pasada mostrar nombre/avatar actuales y el apodo actual del
  espacio con menor jerarquía visual. Si se vacía el apodo o la persona deja el
  espacio, deja de mostrarse; la autoría se conserva por ID estable.
  Los datos históricos que deba preservar el registro financiero no cambian por
  editar el perfil o apodo. No se conserva una copia histórica del apodo para
  presentar actividad. Al reingresar con apodo vacío tampoco se recupera el anterior.
- Al dejar un espacio y volver a ingresar, el apodo comienza vacío, como en una
  nueva membresía. Se conservan el perfil global y la autoría histórica por ID.
- Cada persona puede editar o vaciar únicamente su propio apodo. Ser titular
  del espacio no habilita modificar apodos ajenos.
- Nombre para mostrar común a toda la suite y apodo opcional por espacio.
  El apodo se inicializa vacío, sin copiar el nombre global ni datos de Google.
- El nombre global sigue siendo la identificación principal. El apodo acompaña
  con menor jerarquía visual dentro de su espacio; no sustituye al nombre.
  Si está vacío no se muestra una segunda identificación. No se define aún
  tipografía, posición o componente visual concreto.
- Permitir volver explícitamente al nombre de Google: dejar de usar el nombre
  personalizado y retomar las actualizaciones de Google en futuros logins.
  Esta acción no afecta avatar ni apodos por espacio.
- Subida de fotos propias fuera del primer alcance acordado.

## Evidencia del código revisado en main df25195

- `apps/app/src/auth.js` pide `openid email profile`. Valida la identidad, pero
  retorna únicamente `sub`, email y nombre; no conserva `picture`.
- `apps/app/src/users.js` actualiza `display_name` desde Google en cada login.
  Antes de permitir edición propia, separar el dato del proveedor de la elección
  del usuario para que un login no sobrescriba sus preferencias.
- `apps/app/migrations/0001_platform.sql` ya tiene usuario interno por ID y Google
  `sub`; nombre y email viven en `users`. No hay campos de avatar en ese esquema.
- TasKing conserva nombre, emoji y color asociados al email. Sus validaciones,
  presentación y actualización están repartidas entre backend y frontend.
- Hay trabajo funcional más avanzado fuera de main. Antes de implementar,
  comparar la base de integración vigente y sus consumidores; esta lectura no
  certifica el estado de esas ramas.

Google documenta que el scope `profile` permite recibir `picture`, pero no
garantiza su presencia. Fuente: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).
La ausencia o fallo de la imagen debe tener alternativa, sin bloquear acceso.

## Separación propuesta para discutir

| Concepto | Responsabilidad |
|---|---|
| Identidad | ID interno, vínculo Google por `sub`, email verificado; autenticar |
| Perfil | Nombre visible y representación elegida por la persona; personalizar |
| Contrato público de perfil | Datos mínimos que otros integrantes autorizados necesitan ver |
| Gestión propia | Consultar/modificar el perfil propio con validaciones comunes |
| Presentación | Vistas que consumen el mismo contrato; convergencia visual posterior |

Propuesta técnica, pendiente de diseño: un módulo de plataforma con validación y
persistencia comunes, accesible a los productos mediante un contrato explícito.
No requiere crear un Worker de perfiles, un servicio remoto ni una biblioteca
visual. La tabla separada o extensión de `users` se decidirá según responsabilidades
y compatibilidad. El contrato común no debe exponer email, `sub` o sesión por defecto.

La apariencia y el nombre visible no cambian permisos ni propiedad de registros.
Los nombres de participantes contables sin cuenta mantienen su semántica de dominio;
no se convierten automáticamente en perfiles de personas con acceso.

## Presentación contextual: nombre común y apodo por espacio

Acuerdo explícito de Pablo: nombre para mostrar común a toda la suite y apodo
por espacio, inicialmente en blanco y con menor jerarquía visual. Esto reemplaza
la propuesta anterior de usar el apodo en lugar del nombre dentro del espacio.

Ejemplos conceptuales (sin definir layout): nombre principal «Pablo», apodo
secundario «Papá de Celes» en colegio; mismo nombre principal y apodo secundario
«Torto (9)» en fútbol. Fuera del espacio se usa sólo el perfil global. Un espacio
nuevo no hereda apodos de otros espacios ni inicializa el apodo con el nombre.

Consecuencia para el contrato: entregar el nombre global y el apodo contextual
como campos separados; no combinarlos ni reemplazar uno por otro en persistencia.
Propuesta técnica: guardar el apodo asociado a la membresía y resolverlo en la
plataforma con autorización del espacio. El avatar continúa global; no se acordó
personalización contextual del avatar. El diseño visual concreto queda para después.

El apodo no cambia identidad, autoría, permisos ni nombres históricos financieros.
El nombre de participante contable sin cuenta y su renombre siguen siendo conceptos
de Cuentas Claras. Tampoco se crea un nombre de usuario público por esta decisión.

Pendiente: límites y validaciones. La actividad pasada usa el apodo vigente,
sin copia histórica para presentación. El reingreso inicializa el apodo vacío;
no restaura automáticamente el apodo anterior.
Una descripción adicional no forma parte del alcance acordado.

## Paso a propuesta

Artefactos preparados en [perfil-compartido-homesuite](../openspec/changes/perfil-compartido-homesuite/proposal.md):
propuesta, diseño, dos capacidades con escenarios y tareas de implementación.
La validación documental no acredita ejecución de escenarios ni aceptación técnica.

Los comportamientos de producto conversados quedan acordados. El siguiente
artefacto debe convertirlos en una propuesta de plataforma, sin implementar UI.
La propuesta deberá explicitar límites y validaciones, concurrencia, esquema
aditivo y compatibilidad con la base funcional vigente. Las decisiones técnicas
propuestas no se presentan como capacidades ya implementadas.

### Responsabilidades que la propuesta debe cubrir

| Capacidad | Responsabilidad |
|---|---|
| Identidad de acceso | ID estable, vínculo Google y datos verificados; sin cambios de permisos por personalización |
| Perfil global | Fuente del nombre, nombre personalizado, foto Google, modo de avatar, emoji y color |
| Presentación en espacio | Nombre y avatar globales más apodo propio de membresía, separado y opcional |
| Gestión propia | Consultar/editar perfil, volver al nombre Google y editar/vaciar apodo propio |
| Lectura autorizada | Presentación mínima para integrantes; sin filtrar preferencias internas ni identidad del proveedor |
| Integración Google | Actualizar valores automáticos sin sobrescribir preferencias explícitas |

Los productos consumirán estas capacidades de plataforma. No crear una API propia
por producto para guardar otra copia del perfil ni un servicio remoto innecesario.
Las rutas HTTP y funciones internas concretas se definirán en el diseño.

La migración no debe inferir consentimiento de una preferencia comparando nombres
ni sobrescribir personalizaciones existentes. Revisar datos y código de la rama
funcional vigente antes de fijar el backfill. TasKing conserva su implementación
hasta su integración posterior; no se migran cuentas ni cookies en este cambio.

## Consecuencias técnicas identificadas — pendientes de diseño

Modelo conceptual derivado de los acuerdos (nombres de campos aún provisionales):

- Referencia estable al ID de usuario de la plataforma.
- Nombre de Google, nombre personalizado opcional y selección de fuente del nombre.
- Referencia de foto Google, modo de avatar (`google`, `emoji`, `initial`), emoji
  y color. El contrato de presentación entrega el avatar resuelto y su alternativa.
- Control de actualización para evitar pérdida silenciosa de ediciones concurrentes;
  mecanismo concreto pendiente de diseño.

La resolución común debe poder consumirse sin depender de una vista o producto.
No exponer al resto de integrantes datos de proveedor, preferencias internas ni
metadatos de sesión para renderizar un nombre y un avatar.

El perfil debe distinguir valor proveniente de Google y elección propia. Comparar
textos o detectar si el valor está vacío no alcanza para saber si la persona lo
personalizó. Nombre y avatar necesitan preferencias independientes: editar el
nombre no debería impedir actualizar la foto automática, ni elegir emoji afectar
el vínculo de identidad.

`currentSession()` consulta el usuario vigente desde D1; la cookie conserva el ID
de sesión, no una copia de su nombre. Esto permite que una lectura posterior use
el perfil actualizado sin emitir otra cookie. No implica refresco automático en
pantallas ya abiertas: ese comportamiento deberá declararse en el contrato.

Los consumidores hoy leen `display_name` directamente en sesión, integrantes e
invitaciones. El cambio deberá conservar compatibilidad durante la migración y
hacer que esas lecturas obtengan el mismo perfil resuelto. No mantener un cálculo
de nombre/avatar distinto dentro de cada producto.

No agregar idioma, tema, notificaciones u otras preferencias a este primer corte
sin una necesidad acordada. No cerrar propuesta ni tareas de implementación
mientras queden decisiones de producto sin resolver.

## Escenarios candidatos para la futura especificación

Alta con/sin foto; imagen no disponible; segundo login después de personalizar;
lectura propia y de otro integrante autorizado; intento de modificación ajena;
consumo consistente desde distintos productos; usuario existente sin campos nuevos;
cambio de email sin perder perfil; emoji compuesto y color inválido; distinción
entre perfil de usuario y participante contable. Son candidatos de exploración,
no una declaración de cobertura existente.
