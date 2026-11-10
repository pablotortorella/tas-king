## MODIFIED Requirements

### Requirement: HomeSuite limita cuerpos antes de procesarlos

HomeSuite App SHALL mantener un límite general de 16 KiB para mutaciones y límites explícitos por campo después del parseo. SHALL rechazar cuerpos declarados superiores al límite antes de ejecutar lógica de producto o escribir datos y SHALL comprobar también el límite efectivo al leer solicitudes sin tamaño declarado o con tamaño engañoso. Sólo las rutas de importación y subida que lo necesiten SHALL tener presupuestos específicos documentados y acotados: conservar el presupuesto vigente del import financiero y los límites funcionales de archivos de TasKing, con topes de cantidad y procesamiento por solicitud. Esas excepciones SHALL NOT ampliar el límite de otras rutas ni omitir autenticación, autorización, CSRF o rate limiting.

#### Scenario: Payload demasiado grande
- **WHEN** una mutación sin excepción declarada por ruta contiene o declara un cuerpo superior a 16 KiB
- **THEN** el Worker responde 413 antes de ejecutar lógica de producto o escribir datos

#### Scenario: Import financiero existente
- **WHEN** el preview de importación financiera recibe un cuerpo dentro de su presupuesto específico vigente, superior al límite general
- **THEN** conserva su comportamiento y controles actuales sin que el resto de rutas financieras acepte cuerpos más grandes

#### Scenario: Subida de Tareas válida
- **WHEN** una cuenta autorizada envía una subida dentro del presupuesto de su ruta y de los límites de TasKing de 20 MiB por archivo y 10 adjuntos por tarjeta
- **THEN** la petición protegida puede completarse sin ser rechazada sólo por superar 16 KiB

#### Scenario: Solicitud de excepción que excede el presupuesto
- **WHEN** una subida o importación excede el presupuesto específico o sus límites efectivos aunque no declare correctamente el tamaño
- **THEN** se rechaza de forma acotada sin procesar ilimitadamente el cuerpo ni confirmar efectos parciales como éxito
