## Purpose

Define cómo se registran y se miden las solicitudes de datos personales recibidas por correo, para poder probar el cumplimiento de los plazos de los artículos 14 y 15 de la Ley 1581.

## ADDED Requirements

### Requirement: Cada solicitud por correo se registra con sus fechas

Toda solicitud de consulta, corrección, actualización, supresión o revocación recibida por correo SHALL registrarse en una planilla privada, fuera del repositorio, con un identificador interno, el tipo, la fecha de recibo, la fecha límite, la fecha de la leyenda «reclamo en trámite» cuando corresponda, la prórroga si la hubo, la fecha de respuesta y el resultado en una línea. La planilla SHALL NOT contener el contenido del reclamo ni datos personales más allá de lo necesario para ubicar el correo.

#### Scenario: Llega un reclamo de supresión

- **WHEN** Pablo recibe un reclamo de supresión
- **THEN** lo registra el mismo día con fecha de recibo y fecha límite de 15 días hábiles, y anota la leyenda «reclamo en trámite» dentro de los 2 días hábiles

#### Scenario: Registro sin contenido

- **WHEN** se revisa la planilla
- **THEN** ninguna fila contiene el texto del reclamo ni documentos de identidad

### Requirement: Los plazos se calculan en días hábiles de Colombia

El sistema de medición SHALL calcular las fechas límite contando días hábiles (lunes a viernes, sin los festivos de Colombia): 10 días hábiles para consultas, prorrogables hasta 5; 15 días hábiles para reclamos, contados desde el día siguiente al recibo, prorrogables hasta 8. SHALL listar las solicitudes abiertas con los días hábiles que les quedan y las vencidas.

#### Scenario: Cálculo con un festivo

- **WHEN** se recibe un reclamo un jueves y hay un festivo en la semana siguiente
- **THEN** la fecha límite cuenta los 15 días hábiles sin contar ni el festivo ni los fines de semana

#### Scenario: Solicitud por vencer

- **WHEN** a una solicitud abierta le quedan 3 días hábiles
- **THEN** la revisión semanal la lista como por vencer

### Requirement: La respuesta de supresión dice qué se suprimió y qué persiste

La respuesta a un reclamo de supresión SHALL indicar qué datos quedaron inaccesibles ya, qué persiste y hasta cuándo (ventana de eliminación de grupos, base de datos y copias de seguridad de hasta 90 días) y qué datos ajenos no se pueden suprimir y por qué. El plazo de respuesta SHALL contarse desde el recibo y SHALL NOT esperar a la purga física.

#### Scenario: Supresión con ventana de grupos

- **WHEN** se responde un reclamo de supresión que incluye un grupo con ventana de 30 días
- **THEN** la respuesta se envía dentro de los 15 días hábiles y dice cuándo se purgará físicamente el grupo

### Requirement: Los datos de acceso se entregan gratis con la exportación

La respuesta a una consulta de acceso SHALL entregar los datos de la persona de forma gratuita con la exportación de sus datos de cuenta y la de cada grupo del que es integrante, sin cobro.

#### Scenario: Consulta de acceso

- **WHEN** una persona con cuenta pide conocer sus datos
- **THEN** recibe, sin costo y dentro del plazo, las exportaciones de su cuenta y de sus grupos
