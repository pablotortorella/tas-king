## MODIFIED Requirements

### Requirement: Pantalla de inicio

El inicio SHALL permitir elegir duración, fondo y sonido de gong, ajustar el volumen
del fondo, probar el gong y comenzar. Los tres sonidos de gong SHALL mostrarse como
opciones con nombre; las que requieren cuenta SHALL seguir el mismo tratamiento que
las demás opciones con cuenta. SHALL mostrar los momentos de gong de la duración
elegida y el rótulo del botón con los minutos («Comenzar · N min»). Los valores
iniciales SHALL ser 10 minutos, lluvia y volumen 58 con sesión, y 5 minutos, agua
y volumen 58 sin sesión (ajustes del 2026-10-27: con 55 el fondo quedaba bajo frente al
gong, se subió a 72; al bajar el gong un 25 % y probarlo de nuevo, Pablo pidió el fondo un
20 % más bajo que ese 72, es decir 58). Junto al rótulo «Fondo» SHALL ofrecer la preferencia
«Natural / Sintetizado» cuando el navegador puede reproducir las grabaciones, sin agregar una fila
que obligue a desplazarse, y SHALL ofrecer un enlace a los créditos de los sonidos.

#### Scenario: Cambiar la duración

- **WHEN** la persona elige 30 minutos
- **THEN** la línea de gongs muestra 0, 5, 10, 15, 20, 25 y 30 minutos y el botón dice «Comenzar · 30 min»

#### Scenario: Probar el gong

- **WHEN** la persona presiona «Probar gong»
- **THEN** suena el gong de inicio y fin del sonido elegido y no comienza ninguna sesión

#### Scenario: Elegir el sonido del gong sin cuenta

- **WHEN** una persona sin sesión abre el inicio
- **THEN** ve el Gong brillante elegido y el Gong profundo y el Cuenco tibetano marcados «con cuenta», que al elegirlos explican y ofrecen entrar sin cambiar la selección

#### Scenario: Preferencia visible junto al fondo

- **WHEN** una persona abre el inicio en un navegador que reproduce Ogg Opus
- **THEN** ve «Natural» y «Sintetizado» junto al rótulo «Fondo», con una opción elegida, y el inicio sigue cabiendo en la ventana sin desplazarse

#### Scenario: Navegador sin Ogg Opus

- **WHEN** una persona abre el inicio en un navegador que no reproduce Ogg Opus
- **THEN** no ve la preferencia y todos los fondos suenan sintetizados

#### Scenario: Enlace a los créditos

- **WHEN** la persona elige el enlace de créditos
- **THEN** llega a la página de créditos, que lista cada fondo con su título, autor, licencia y enlace, y puede volver a Remanso
