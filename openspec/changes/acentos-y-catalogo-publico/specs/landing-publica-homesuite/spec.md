## ADDED Requirements

### Requirement: El catálogo público muestra sólo herramientas funcionales

La portada SHALL mostrar únicamente las herramientas que funcionan hoy (Fun TasKing, Cuentas Claras y
Remanso). Una herramienta que todavía no existe SHALL NOT tener tarjeta en la portada, landing publicada ni
enlace desde otra página, y su ruta SHALL responder 404.

#### Scenario: Tres herramientas

- **WHEN** una persona abre la portada
- **THEN** ve tres tarjetas de herramientas y ninguna menciona Compras

#### Scenario: Herramienta oculta

- **WHEN** se pide `/compras` o `/compras.html`
- **THEN** la respuesta es 404 y ninguna landing enlaza a esa ruta

### Requirement: Cada herramienta tiene su acento

Cada herramienta SHALL tener un color de acento propio en la portada y en su landing: verde para Fun TasKing,
terracota para Cuentas Claras y ámbar para Remanso, con variante clara y oscura. El acento SHALL usarse sólo en
rótulos, bordes e íconos, no como fondo de texto blanco, y SHALL leerse con contraste de al menos 4,5:1 sobre la
página, la tarjeta y su propio fondo suave.

#### Scenario: Contraste de los acentos

- **WHEN** se evalúan los colores de acento de cada herramienta en esquema claro y oscuro
- **THEN** cada uno cumple 4,5:1 sobre la página, la tarjeta y su fondo suave

#### Scenario: Cada página declara su producto

- **WHEN** se revisan las tarjetas de la portada y las tres landings
- **THEN** cada una declara el producto cuyo acento usa
