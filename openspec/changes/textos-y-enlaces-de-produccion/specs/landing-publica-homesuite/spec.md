## ADDED Requirements

### Requirement: El sitio apunta a la app de su ambiente

El HTML publicado SHALL llevar los enlaces de producción: a `https://app.homesuite.info/<herramienta>` para Cuentas
Claras y Remanso y al TasKing de producción para Fun TasKing. El sitio de staging SHALL reescribirlos a los de su propio
ambiente (`https://staging.homesuite.info`, TasKing de staging) y SHALL NOT apuntar nunca a producción. El sitio de
producción SHALL NOT contener ningún enlace a staging.

#### Scenario: Landing de una herramienta en producción

- **WHEN** se abre `/cuentas-claras` o `/remanso` en `homesuite.info`
- **THEN** ofrece «Entrar a …» hacia `app.homesuite.info` y la portada ofrece «Probá Remanso» hacia la misma app

#### Scenario: Mismo contenido en staging

- **WHEN** se piden las mismas páginas al sitio de staging
- **THEN** los enlaces apuntan a `staging.homesuite.info` y al TasKing de staging, con `noindex` y sin caché

### Requirement: Los textos reflejan las herramientas activas

El sitio SHALL presentar Fun TasKing como disponible y Cuentas Claras y Remanso como activas en versión beta, en
presente («Ya podés usarla; la seguimos mejorando»), sin frases que las traten como futuras («Estamos creando»,
«llegarán»). Los términos SHALL mencionar que las herramientas en versión beta pueden cambiar o tener errores.

#### Scenario: Portada

- **WHEN** una persona lee la portada
- **THEN** no hay promesas de herramientas futuras y las tarjetas dicen «Disponible» y «Versión Beta»

### Requirement: El sitio y la app son coherentes

Las herramientas, sus estados y sus rutas anunciados por el sitio SHALL coincidir con la lista de herramientas de la app:
mismas herramientas públicas en el mismo orden, mismo estado, cada enlace a una ruta que la app tiene y que responde, y
ninguna herramienta oculta mostrada. Esa comprobación SHALL correr en CI contra el HTML del repositorio y SHALL poder correr
contra lo publicado en staging y en producción.

#### Scenario: Desvíos

- **WHEN** el sitio anuncia una herramienta que la app no tiene, un estado distinto, una ruta inexistente, una herramienta oculta o el TasKing de otro ambiente
- **THEN** la comprobación falla y nombra el desvío
