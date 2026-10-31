## MODIFIED Requirements

### Requirement: Las herramientas futuras no simulan estar disponibles

La portada SHALL presentar Gastos, Compras y Remanso como herramientas en
preparación. Esos elementos SHALL NOT usar enlaces, botones ni controles
deshabilitados que sugieran una acción disponible. Cada una SHALL tener una landing
estática, sin JavaScript, que explique el producto sin fingir que la aplicación está
disponible en el sitio público.

#### Scenario: Revisar el catálogo inicial

- **WHEN** una persona recorre las herramientas de HomeSuite
- **THEN** distingue Fun TasKing como disponible y Gastos, Compras y Remanso como próximas

#### Scenario: Landing de Remanso en el sitio público

- **WHEN** una persona abre la landing de Remanso fuera de staging
- **THEN** lee qué es Remanso, ve que todavía está en preparación y no encuentra ningún enlace ni botón que sugiera abrir la aplicación
