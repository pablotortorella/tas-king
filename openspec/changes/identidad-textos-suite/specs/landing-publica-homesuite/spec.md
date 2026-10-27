## MODIFIED Requirements

### Requirement: La portada presenta HomeSuite

La portada pública SHALL identificar el sitio como HomeSuite y SHALL explicar en
lenguaje breve que reúne herramientas para organizar lo cotidiano y que sigue creciendo
hacia el cuidado y el disfrute del hogar, sin presuponer que viven varias personas
juntas. SHALL NOT afirmar como disponible ninguna herramienta que no lo esté. El
contenido SHALL poder leerse y navegarse sin JavaScript, autenticación ni cookies.

#### Scenario: Primera visita al dominio

- **WHEN** una persona abre la portada de HomeSuite
- **THEN** ve el nombre HomeSuite, un mensaje de bienvenida, el título «Organizá, cuidá y disfrutá tu hogar.» y una explicación breve de la suite

#### Scenario: JavaScript no está disponible

- **WHEN** el navegador no ejecuta JavaScript
- **THEN** todo el contenido y todos los enlaces de la portada siguen disponibles

## ADDED Requirements

### Requirement: Los textos no presuponen convivencia ni dividen la suite

Los textos de la portada y de las landings SHALL hablar del hogar sin presuponer convivencia
(«vida compartida», «en equipo», «organizarnos») y SHALL presentar compartir como una
posibilidad cuando la función lo es (repartos de gastos, tableros compartidos), nunca como
requisito. SHALL describir cada herramienta por lo que hace, sin llamarla «una mitad» de la
suite ni agruparlas por categorías. El pie SHALL usar «Tu hogar, a tu ritmo.».

#### Scenario: Ninguna página presupone convivencia

- **WHEN** se revisa el texto visible de la portada y de las cuatro landings
- **THEN** no aparecen «vida compartida», «en equipo», «del equipo», «organizarnos» ni «la otra mitad»

#### Scenario: Compartir como posibilidad

- **WHEN** una persona lee la landing de Fun TasKing o de Cuentas Claras
- **THEN** entiende que puede usarla sola y que compartir tableros, repartos y saldos es una opción
