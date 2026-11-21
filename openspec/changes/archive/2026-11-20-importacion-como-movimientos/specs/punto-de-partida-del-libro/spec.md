## Purpose

Define cómo elige su inicio un grupo nuevo de Cuentas Claras (en cero o con el historial de Splitwise) y cómo se presenta un libro que todavía no tiene movimientos.

## ADDED Requirements

### Requirement: El formulario de creación incluye cómo empezar

El formulario de creación de un grupo SHALL incluir la elección «Cómo querés empezar» con las opciones «Empezar en cero» (elegida por defecto), «Traer de Splitwise» y «Saldos anteriores», esta última deshabilitada y rotulada como próxima. Elegir una opción SHALL ser reversible porque no se escribe ningún dato hasta confirmar la importación.

#### Scenario: Valor por defecto

- **WHEN** una persona crea un grupo sin tocar la elección
- **THEN** el grupo se crea en cero y se muestra su libro

#### Scenario: Saldos anteriores deshabilitada

- **WHEN** la persona intenta elegir «Saldos anteriores»
- **THEN** la opción no es seleccionable y se indica que todavía no está disponible

### Requirement: Elegir Splitwise lleva directo a importar

Cuando la persona elige «Traer de Splitwise», el sistema SHALL crear el grupo y llevarla a la pantalla de importación. Si abandona la importación, el grupo SHALL quedar creado y vacío.

#### Scenario: Crear y empezar a importar

- **WHEN** la persona crea un grupo eligiendo «Traer de Splitwise»
- **THEN** el grupo se crea y se muestra la pantalla para subir el archivo

#### Scenario: Abandonar la importación

- **WHEN** la persona sale de la importación sin confirmar nada
- **THEN** el grupo existe, no tiene movimientos y muestra el libro vacío

### Requirement: El libro vacío guía el primer paso

Mientras un libro no tenga movimientos, SHALL mostrar un botón destacado para agregar el primer movimiento y, para la persona titular, la opción de traer el historial de Splitwise. Esas ayudas NO SHALL mostrarse cuando el libro ya tiene movimientos.

#### Scenario: Libro nuevo

- **WHEN** se abre un libro sin movimientos
- **THEN** se ve un botón grande «Agregá tu primer movimiento» y, para la persona titular, la opción de importar

#### Scenario: Libro con movimientos

- **WHEN** el libro ya tiene al menos un movimiento
- **THEN** el botón destacado y las ayudas de inicio no se muestran
