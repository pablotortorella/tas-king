## Purpose

Define cómo se muestra y se mueve el rastrillo de Jardín Zen, y cómo la persona puede ocultarlo, sin cambiar la geometría de los surcos.

## ADDED Requirements

### Requirement: El rastrillo se muestra con el mango invertido

El rastrillo SHALL dibujarse con la parte larga girada 180° alrededor del cabezal respecto de la beta v0.3, conservando los cinco dientes y el punto de contacto con la arena. Esto SHALL valer tanto en la vista WebGL 2 como en la alternativa Canvas 2.5D.

#### Scenario: Las dos rutas de render

- **WHEN** una persona abre Jardín Zen con WebGL 2 o con la alternativa Canvas 2.5D
- **THEN** el rastrillo aparece con el mango invertido en ambas

### Requirement: El rastrillo gira de forma gradual

El ángulo mostrado del rastrillo SHALL acercarse de forma gradual al rumbo objetivo por el arco más corto, con un tope de rotación por fotograma. Un desplazamiento muy pequeño del puntero NO SHALL cambiar el rumbo. El suavizado SHALL afectar solo la pieza visual y NO SHALL modificar la geometría de los surcos.

#### Scenario: Invertir la dirección de golpe

- **WHEN** la persona invierte de repente la dirección del gesto
- **THEN** el rastrillo gira en varios fotogramas y no salta de un ángulo a otro en uno solo

#### Scenario: Mover sin pulsar

- **WHEN** con la herramienta Rastrillar activa la persona mueve el puntero sin pulsar
- **THEN** el rastrillo se reposiciona y gira gradualmente, y no se crea ningún surco

#### Scenario: Arrastrar

- **WHEN** la persona arrastra con contacto sobre la arena
- **THEN** se crean surcos y el rastrillo acompaña el movimiento

### Requirement: La persona puede mostrar u ocultar el rastrillo

Jardín Zen SHALL ofrecer un control «Rastrillo visible / Rastrillo oculto», inicialmente visible, con estado accesible mediante `aria-pressed`, operable con mouse, tacto y teclado, y en ambas rutas de render. Ocultar el rastrillo SHALL afectar solo el modelo gráfico y el cursor especial: la persona SHALL poder seguir rastrillando, deshacer, mover piedras y girar la cámara. La preferencia SHALL recordarse en el navegador con la clave `homesuite:jardin-zen:rake-visible` y NO SHALL enviarse al servidor.

#### Scenario: Ocultar durante un arrastre

- **WHEN** la persona oculta el rastrillo mientras arrastra
- **THEN** el arrastre no se interrumpe, no se borra ningún trazo y el ancho fino o normal no cambia

#### Scenario: Volver a mostrarlo

- **WHEN** la persona vuelve a mostrar el rastrillo
- **THEN** el modelo y el cursor especial vuelven a verse

#### Scenario: Recordar la preferencia

- **WHEN** la persona oculta el rastrillo y vuelve a abrir Jardín Zen en el mismo navegador
- **THEN** el rastrillo sigue oculto

#### Scenario: Sin almacenamiento disponible

- **WHEN** `localStorage` no está disponible
- **THEN** el rastrillo aparece visible por defecto y no se produce ningún error

### Requirement: La pantalla no se desborda en celulares

La interfaz de Jardín Zen, incluido el nuevo control, NO SHALL producir desplazamiento horizontal a 360 y 390 px de ancho.

#### Scenario: Celular angosto

- **WHEN** se abre Jardín Zen a 360 px o 390 px de ancho
- **THEN** la página no se desplaza horizontalmente
