## Purpose

Consola única de administración de HomeSuite en `/consola`: quién entra (dueños de la suite y roles por herramienta), qué pestañas ve cada quien, cómo se dan y quitan los roles y qué queda auditado, sin mostrar contenido de grupos ni tableros.

## ADDED Requirements

### Requirement: Dueños de la suite fuera de la base

HomeSuite SHALL definir a los dueños de la suite como una lista de identificadores internos de cuenta en un secreto de cada ambiente, nunca por correo ni en el repositorio. Ser dueño SHALL dar acceso a todas las pestañas de la consola. Ningún dato de la base SHALL convertir a una cuenta en dueña ni quitarle esa condición. Si el secreto falta o está vacío, nadie SHALL ser dueño y la consola SHALL comportarse como inexistente para quien no tenga rol.

#### Scenario: Dueño definido en el secreto
- **WHEN** una cuenta cuyo identificador figura en el secreto de dueños abre `/consola`
- **THEN** ve las pestañas Suite, Tareas, Cuentas Claras y Administradores

#### Scenario: Secreto ausente
- **WHEN** el secreto de dueños no está configurado y una cuenta sin rol abre `/consola`
- **THEN** recibe 404, y la ausencia del secreto queda en el log del Worker sin datos de la cuenta

#### Scenario: Compartir la administración completa
- **WHEN** se agrega un segundo identificador al secreto y se publica
- **THEN** esa cuenta tiene el mismo acceso que el primer dueño, sin cambios en la base

### Requirement: Roles por herramienta en la base

HomeSuite SHALL guardar roles de administración por herramienta (hoy `tareas` y `cuentas-claras`) asociados a una cuenta, con quién lo dio y cuándo. Solo un dueño SHALL dar o quitar roles. Un rol de herramienta SHALL dar acceso solo a la pestaña de esa herramienta y SHALL NOT dar acceso a las pestañas Suite ni Administradores, ni a datos de otras herramientas. Un dueño no necesita rol para ver una herramienta.

#### Scenario: Administración delegada de Tareas
- **WHEN** una cuenta con rol `tareas` y sin otros roles abre `/consola`
- **THEN** ve solo la pestaña Tareas, y pedir la de Suite, la de Administradores o su API responde 404

#### Scenario: Un administrador de herramienta intenta dar un rol
- **WHEN** una cuenta con rol `tareas` envía una petición para dar o quitar un rol
- **THEN** recibe 404 y no cambia ningún rol

#### Scenario: El dueño da y quita un rol
- **WHEN** un dueño da el rol `tareas` a una cuenta y después se lo quita
- **THEN** la cuenta ve la pestaña Tareas mientras tiene el rol, deja de verla al quitárselo, y ambos cambios quedan auditados

### Requirement: La consola no existe para quien no tiene permiso

Para una persona sin sesión, sin rol o con una pestaña ajena a su rol, `/consola`, sus pestañas y toda ruta `/api/consola/*` SHALL responder 404 con la misma página o el mismo cuerpo que una ruta inexistente. El enlace a la consola SHALL mostrarse solo a quien puede entrar. Las mutaciones de la consola SHALL exigir sesión, CSRF y el límite de mutaciones vigente.

#### Scenario: Persona sin rol
- **WHEN** una cuenta sin rol ni condición de dueño pide `/consola` o `/api/consola/suite`
- **THEN** recibe 404, igual que en una ruta inexistente, y el intento queda solo en el log del Worker

#### Scenario: Sin sesión
- **WHEN** alguien sin sesión pide `/consola`
- **THEN** recibe 404 y no se lo redirige al ingreso

#### Scenario: Mutación sin CSRF
- **WHEN** un dueño envía un cambio de rol sin token CSRF válido
- **THEN** se rechaza sin cambiar roles

### Requirement: Pestaña Suite

La pestaña Suite, solo para dueños, SHALL mostrar para un período elegido (semana, mes, trimestre o año de calendario, con navegación al anterior y al siguiente):
- el total de cuentas;
- las personas activas en el último día, en los últimos 7 y en los últimos 30, con su serie en el tiempo;
- por cada herramienta medida, las personas distintas que «entraron» y las que «hicieron algo», la proporción entre ambas y la diferencia absoluta con el período anterior del mismo tipo;
- los conteos de acciones por herramienta.

Al elegir una herramienta SHALL mostrar la serie de sus dos niveles por período. SHALL NOT mostrar porcentajes de variación entre períodos ni datos de personas individuales.

#### Scenario: Mes con uso
- **WHEN** el dueño elige noviembre de 2026
- **THEN** ve cuentas, activas, la tabla por herramienta con entró, hizo algo, proporción y diferencia absoluta contra octubre, y los conteos de acciones del mes

#### Scenario: Período sin datos
- **WHEN** el dueño elige un período anterior a la publicación
- **THEN** la pestaña dice que no hay datos para ese período, sin mostrar ceros como si fueran mediciones

### Requirement: Pestaña Tareas

La pestaña Tareas SHALL mostrar a dueños y a quienes tienen rol `tareas` los totales de Tareas (cuentas, tableros, tarjetas activas, adjuntos y su tamaño) y la lista de cuentas de Tareas con nombre y correo. El ranking de las cuentas más activas de Tareas SHALL verlo solo un dueño. La pestaña SHALL NOT mostrar contenido de tableros ni tarjetas.

#### Scenario: Administrador de Tareas
- **WHEN** una cuenta con rol `tareas` abre la pestaña Tareas
- **THEN** ve los totales y la lista de cuentas con correos, pero no el ranking por persona

#### Scenario: Dueño
- **WHEN** un dueño abre la pestaña Tareas
- **THEN** ve además el ranking de las cuentas más activas

### Requirement: Pestaña Administradores

La pestaña Administradores, solo para dueños, SHALL listar los roles vigentes por herramienta, permitir darlos y quitarlos, y mostrar el historial de roles dados y quitados y las últimas entradas a la consola. Los dueños del secreto SHALL figurar como dueños, sin poder quitarse desde la pantalla.

#### Scenario: Historial de roles
- **WHEN** el dueño abre la pestaña Administradores después de dar y quitar un rol
- **THEN** ve ambos cambios con fecha, quién los hizo y a qué cuenta y herramienta afectaron

### Requirement: Auditoría de la consola

HomeSuite SHALL registrar en la auditoría de la plataforma, sin correos y solo con identificadores:
- cada rol dado o quitado (quién, a qué cuenta, qué herramienta);
- la entrada a la consola, como mucho una vez por persona y por día de Colombia, con la pestaña;
- cada vista de la lista de cuentas con correos.

Los intentos sin permiso SHALL quedar solo en el log del Worker. La auditoría SHALL NOT borrarse por mantenimiento.

#### Scenario: Dos entradas el mismo día
- **WHEN** un dueño entra a la consola dos veces el mismo día
- **THEN** queda una sola entrada de auditoría de acceso para ese día

#### Scenario: Vista de la lista de cuentas
- **WHEN** una cuenta con rol `tareas` abre la lista de cuentas de Tareas
- **THEN** queda una entrada de auditoría con su identificador y la herramienta, sin ningún correo en los metadatos
