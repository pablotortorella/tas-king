## Purpose

Define los contenidos que la política de privacidad de HomeSuite debe tener según el Decreto 1074 de 2015, la edad mínima, la forma de informar encargados y transmisión internacional, y los plazos y el procedimiento para ejercer los derechos. Los textos son propuestas que revisa Pablo; no son asesoramiento legal.

## ADDED Requirements

### Requirement: La política contiene los contenidos mínimos del Decreto 1074

`privacidad.html` SHALL contener, en lenguaje claro: el nombre, domicilio, correo y teléfono de quien responde; el tratamiento y la finalidad de los datos; los derechos de la persona titular; la persona que atiende las solicitudes; el procedimiento para ejercer los derechos de acceso, actualización, rectificación, supresión y revocación; y la fecha de entrada en vigor y la vigencia de la base de datos. SHALL mencionar a la Superintendencia de Industria y Comercio como autoridad ante la que se puede presentar una queja después de agotar el trámite ante el responsable.

#### Scenario: Revisión de los contenidos

- **WHEN** una prueba del sitio lee `privacidad.html`
- **THEN** encuentra las secciones de responsable, finalidades, derechos, procedimiento, plazos, vigencia y la mención de la Superintendencia de Industria y Comercio

#### Scenario: Vigencia de la base

- **WHEN** una persona lee la sección de conservación
- **THEN** ve que los datos se conservan mientras exista la cuenta o el grupo y que las copias de seguridad los conservan hasta 90 días más

### Requirement: La política informa plazos y requisitos para consultas y reclamos

La política SHALL informar que las consultas se responden en un máximo de 10 días hábiles, prorrogables 5 días hábiles más con aviso motivado, y que los reclamos de corrección, actualización o supresión se resuelven en un máximo de 15 días hábiles, prorrogables 8 días hábiles más con aviso motivado. SHALL indicar qué debe contener un reclamo (identificación, hechos y dirección de respuesta), que si falta algo se pide subsanar dentro de los 5 días siguientes y que el acceso a los datos es gratuito.

#### Scenario: Plazos visibles

- **WHEN** una persona lee la sección de derechos
- **THEN** ve los plazos de 10 y 15 días hábiles, las prórrogas de 5 y 8 días hábiles y el carácter gratuito del acceso

### Requirement: La política nombra a los encargados y explica la transmisión internacional

La política SHALL nombrar a Cloudflare (alojamiento, base de datos y copias de seguridad) y a GitHub (ejecución transitoria de las copias de seguridad) como encargados que tratan datos por cuenta del responsable bajo contratos de tratamiento de datos, SHALL indicar que el procesamiento puede ocurrir en Estados Unidos y otros países, y SHALL indicar que Google actúa como proveedor de identidad bajo su propia política. SHALL NOT afirmar que existe una garantía de ubicación de los datos que no esté comprobada.

#### Scenario: Encargados nombrados

- **WHEN** una persona lee la sección con quién se comparten los datos
- **THEN** ve nombrados a Cloudflare, GitHub y Google con su papel

### Requirement: La política fija la edad mínima y advierte sobre datos sensibles

La política y los términos SHALL exigir ser mayor de 18 años para usar HomeSuite. La política SHALL indicar que HomeSuite no pide datos sensibles, que responder es voluntario y que se puede pedir su supresión. Los campos de texto libre de la aplicación SHALL mostrar una advertencia breve de no escribir datos sensibles.

#### Scenario: Edad mínima

- **WHEN** una persona lee los términos y la política
- **THEN** ambos dicen que se requiere ser mayor de 18 años

#### Scenario: Advertencia en un campo de texto libre

- **WHEN** una persona abre el formulario de un movimiento
- **THEN** junto a la descripción y la nota ve la advertencia de no escribir salud, religión ni afiliaciones

### Requirement: La política informa a las personas que figuran sin tener cuenta

La política SHALL decir que una persona registrada en un grupo por otra persona puede escribir al correo de contacto para conocer, corregir o pedir la supresión de ese dato, y que quien la registró es quien aportó el dato.

#### Scenario: Persona sin cuenta

- **WHEN** alguien registrado en un grupo sin tener cuenta lee la política
- **THEN** encuentra cómo ejercer sus derechos

### Requirement: Los cambios sustanciales se avisan antes de aplicarse

La política SHALL decir que los cambios sustanciales se comunican antes de aplicarse. Cada cambio de versión SHALL actualizar la fecha de «Última actualización» de la página.

#### Scenario: Cambio de versión

- **WHEN** se edita el texto de la política
- **THEN** la fecha de «Última actualización» cambia y la prueba de alineación con la constante de versión exige actualizar la versión

### Requirement: Ningún texto legal se publica sin la revisión de Pablo

Los textos de `privacidad.html` y `terminos.html` SHALL publicarse únicamente después de la lectura y aprobación de Pablo, que SHALL quedar registrada en el pull request correspondiente. Este documento y las propuestas de texto SHALL NOT presentarse como asesoramiento legal.

#### Scenario: Pull request con textos legales

- **WHEN** un pull request modifica una página legal
- **THEN** su descripción lista los cambios de texto aparte del código y registra la aprobación de Pablo antes de integrarse
