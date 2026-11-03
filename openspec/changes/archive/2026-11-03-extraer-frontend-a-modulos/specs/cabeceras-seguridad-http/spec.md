## ADDED Requirements

### Requirement: Las cabeceras de seguridad llegan al documento navegable
Toda respuesta que un navegador interprete como documento navegable —`/` y cualquier página HTML servida desde `public/`— SHALL incluir `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy`. La protección SHALL NOT depender de que la respuesta la produzca el Worker en vez del servidor de assets: el criterio es lo que recibe el navegador, no qué componente interno la generó.

#### Scenario: El documento principal trae las cabeceras
- **WHEN** un navegador pide `/`
- **THEN** la respuesta incluye `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy`

#### Scenario: Las páginas públicas también las traen
- **WHEN** un navegador pide `/landing.html`, `/releases.html`, `/revoked.html` o `/terminos.html`
- **THEN** cada respuesta incluye el mismo juego de cabeceras de seguridad que `/`

#### Scenario: La API conserva las cabeceras que ya tenía
- **WHEN** un cliente pide un endpoint bajo `/api/`
- **THEN** la respuesta sigue incluyendo el juego completo de cabeceras de seguridad

#### Scenario: La verificación se hace sobre la respuesta servida
- **WHEN** se ejecuta la cobertura automática de cabeceras
- **THEN** la verificación consulta la respuesta HTTP tal como la recibe un cliente externo, y SHALL NOT darse por satisfecha invocando el manejador de la aplicación por dentro

### Requirement: La política de contenido prohíbe script inline
La política de contenido SHALL declarar `script-src 'self'` sin `'unsafe-inline'` y sin `'unsafe-eval'`: todo JavaScript que la aplicación ejecute SHALL provenir de un archivo servido por el mismo origen. La política SHALL mantener `default-src 'self'` y SHALL conservar en `connect-src` los orígenes de Google necesarios para el login OAuth.

#### Scenario: Un script inyectado en el documento no se ejecuta
- **WHEN** un atacante logra insertar una etiqueta `<script>` con código inline en una página de la aplicación
- **THEN** el navegador bloquea su ejecución por violación de la política de contenido

#### Scenario: El código propio de la aplicación sí se ejecuta
- **WHEN** una persona abre el tablero con una sesión válida
- **THEN** el tablero carga y funciona en su totalidad, sin violaciones de política de contenido en la consola del navegador

#### Scenario: El login con Google sigue funcionando
- **WHEN** una persona inicia sesión con Google
- **THEN** la política de contenido permite las conexiones a los orígenes de Google que el flujo OAuth necesita, y el login se completa

#### Scenario: Los estilos inline quedan permitidos de forma explícita
- **WHEN** se inspecciona la política de contenido vigente
- **THEN** `style-src` conserva `'unsafe-inline'` como decisión declarada y acotada, mientras los atributos `style` del markup no se hayan migrado

### Requirement: La aplicación no puede ser enmarcada
La aplicación SHALL impedir que sus páginas se carguen dentro de un `iframe`, `frame` u `object` de otro sitio, de modo que no pueda usarse como blanco de clickjacking.

#### Scenario: Un sitio externo no puede embeber la aplicación
- **WHEN** una página de otro origen intenta cargar `/` dentro de un `iframe`
- **THEN** el navegador impide que el contenido se muestre

### Requirement: El endurecimiento no altera el comportamiento de la aplicación
Aplicar la política y las cabeceras SHALL NOT cambiar ninguna conducta observable del producto: tablero, modal de tarjeta, checklists, objetivos, métricas, etiquetas, columnas, importación y exportación, adjuntos, tema y paleta SHALL seguir comportándose como antes del cambio.

#### Scenario: La suite existente pasa sin cambios de expectativa
- **WHEN** se ejecuta la suite completa de tests unitarios y E2E contra la aplicación endurecida
- **THEN** pasa al 100%, sin relajar ni reescribir las expectativas de comportamiento que ya existían

#### Scenario: Los adjuntos siguen cargando
- **WHEN** una persona abre una tarjeta con imágenes adjuntas
- **THEN** las vistas previas se muestran y los archivos se descargan como antes
