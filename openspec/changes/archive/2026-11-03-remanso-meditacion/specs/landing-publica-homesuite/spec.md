## MODIFIED Requirements

### Requirement: Las herramientas futuras no simulan estar disponibles

La portada SHALL NOT simular como disponible una herramienta que todavía no lo está: una herramienta en preparación
SHALL NOT usar botones, formularios ni controles deshabilitados que sugieran una función disponible, y debe tener una
landing estática, sin JavaScript, que explique el producto sin fingir que la aplicación ya existe. Remanso, Cuentas Claras
y Fun TasKing funcionan hoy y se rotulan según el requisito «El estado de cada herramienta se rotula con precisión»; una
herramienta que todavía no existe no se muestra (ver «El catálogo público muestra sólo herramientas funcionales»).

#### Scenario: Revisar el catálogo inicial

- **WHEN** una persona recorre las herramientas de HomeSuite
- **THEN** distingue Fun TasKing como disponible y Cuentas Claras y Remanso como versión beta, sin controles que finjan una función inexistente

#### Scenario: Landing de Remanso en el sitio público

- **WHEN** una persona abre la landing de Remanso
- **THEN** lee qué es Remanso, que está en versión beta y encuentra «Entrar a Remanso» hacia la app de su ambiente
