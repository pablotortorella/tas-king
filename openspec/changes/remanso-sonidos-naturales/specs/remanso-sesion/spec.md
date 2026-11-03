## MODIFIED Requirements

### Requirement: Fondos sonoros

Remanso SHALL ofrecer los fondos `silencio`, `agua`, `lluvia`, `bosque`, `fuego` y
`noche`. Cada fondo con sonido SHALL poder sonar en dos versiones: la **sintetizada**,
generada en el dispositivo sin descargar audio, y la **natural**, una grabación que el
navegador descarga (ver la capacidad `remanso-sonidos-naturales`). La versión natural
SHALL estar disponible en cada fondo que el nivel de acceso de la persona ya permite, sin
cambiar esos niveles. El fondo SHALL entrar con un fundido de 4 s al comenzar y apagarse
con un fundido de 6 s al terminar, en las dos versiones. El volumen elegido SHALL
aplicarse sólo al fondo, no a los gongs.

#### Scenario: Solo gongs

- **WHEN** la persona elige silencio
- **THEN** únicamente suenan los gongs y no se descarga ningún audio

#### Scenario: Fondo con fundido

- **WHEN** la sesión con fondo, natural o sintetizado, llega a su fin
- **THEN** el fondo se apaga gradualmente mientras suena el gong final

#### Scenario: Cualquier fondo es válido en la versión sintetizada

- **GIVEN** la preferencia en Sintetizado
- **WHEN** la persona elige cada uno de los fondos que su nivel permite
- **THEN** la sesión comienza sin error y sin descargar archivos de audio

#### Scenario: Cualquier fondo es válido en la versión natural

- **GIVEN** la preferencia en Natural en un navegador que reproduce Ogg Opus
- **WHEN** la persona elige cada uno de los fondos con sonido que su nivel permite
- **THEN** la sesión comienza sin error con la grabación de ese fondo, o con el sintetizado si la grabación no pudo cargarse

#### Scenario: El volumen y el silencio del fondo valen para las dos versiones

- **WHEN** la persona cambia el volumen o silencia el fondo durante una sesión con fondo natural
- **THEN** el fondo responde igual que con el sintetizado y los gongs no cambian
