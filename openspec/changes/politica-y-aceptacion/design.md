## Context

Ver `proposal.md` para el motivo. Estado verificado en `main` tras el merge del PR #137:

- `privacidad.html` y `terminos.html` (versión «Última actualización: 27 de octubre de 2026») viven en `apps/site/public/` y se sirven desde el sitio. La app no enlaza ninguno de los dos: el único lugar donde aparece un botón «Continuar con Google» es `routes/shell.js` (`/` sin sesión), más los enlaces `/auth/google?returnTo=…` de `route-kit.js` (redirección cuando falta sesión) y `remanso.js`.
- `/auth/google` y `/auth/callback` (`index.js`, `auth.js`) usan una cookie firmada de 10 minutos para `state`, nonce y PKCE; `upsertGoogleUser` crea o recupera el usuario por `sub`.
- No existe ninguna tabla de aceptaciones. `users` tiene 2 usuarios en producción (al 31/10): ambos entraron sin ver el aviso.
- El respaldo diario corre en un runner de GitHub Actions: exporta D1, restaura en local en un directorio temporal, sube a R2 y verifica la descarga. La salida de `wrangler d1 export` se suprime (traía una URL temporal). No sube artefactos de Actions.
- Normas consultadas por la investigación (2026-11-02): Ley 1581 de 2012 (arts. 2, 4, 5, 7, 8, 9, 12, 14, 15, 16, 25 y 26), Decreto 1074 de 2015 (arts. 2.2.2.25.2.4, 2.2.2.25.2.6, 2.2.2.25.2.8, 2.2.2.25.3.1, 2.2.2.25.3.6, 2.2.2.25.5.2, 2.2.2.26.1.2) y la Circular Única de la SIC, Título V (versión del 29-09-2022). La lectura del texto de la Ley y del Decreto se hizo a través de compilaciones de terceros y de un PDF obtenido con la verificación TLS desactivada; conviene releer cada artículo en la fuente oficial antes de citarlo en un texto publicado.

## Goals / Non-Goals

**Goals:**
- Que ninguna persona use HomeSuite sin haber visto y aceptado los textos vigentes, y que se pueda probar.
- Que la política cumpla los contenidos mínimos y diga lo mismo que hace la operación.
- Que los plazos legales de las solicitudes se registren y se midan.

**Non-Goals:** los de `proposal.md`.

## Decisions

### D1. La versión de un texto legal es la fecha de «Última actualización»

Cada página muestra «Última actualización: D de mes de AAAA». Esa fecha, en ISO (`2026-11-02`), es la versión del documento. Un módulo `legal.js` declara `LEGAL_DOCUMENTS = { terms: { version, path }, privacy: { version, path } }`. Una prueba lee las dos páginas del sitio (`apps/site/public/*.html`), extrae la fecha y falla si difiere de la constante: cambiar el texto sin subir la versión, o al revés, no pasa CI. Un cambio sustancial sube la versión y obliga a aceptar de nuevo; una corrección menor (ortografía) también sube la fecha, de modo que la regla es simple y no depende de quién decida qué es «sustancial» en el momento de editar.

*Alternativa descartada:* numerar versiones a mano en el código. Podría quedar desfasado del texto publicado.

### D2. Tabla `legal_acceptances`

Migración aditiva:

`legal_acceptances(user_id TEXT NOT NULL REFERENCES users(id), document TEXT CHECK(document IN ('terms','privacy')), version TEXT NOT NULL, accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, method TEXT CHECK(method IN ('login','gate')), PRIMARY KEY (user_id, document, version))`.

Es la prueba de la autorización (Ley 1581, art. 9 y art. 12): no guarda IP ni agente de usuario. Se conserva después de una baja de cuenta, porque solo contiene un identificador opaco, una versión y una fecha, y porque puede hacer falta para demostrar la autorización durante el plazo de prescripción (Open Questions 5).

### D3. Aceptar por conducta inequívoca, probando lo que se mostró

La aceptación es por conducta inequívoca (Decreto 1074, art. 2.2.2.25.2.4): oprimir «Continuar con Google» debajo de un aviso visible. Para que el registro pruebe qué se mostró, el clic inicia `/auth/google` y el servidor escribe las versiones vigentes **en la cookie firmada de estado** que ya existe; en el retorno exitoso, junto con `upsertGoogleUser`, inserta las filas de `legal_acceptances` con método `login` usando las versiones guardadas en el estado, no las del momento del retorno. Así un cambio de versión durante el flujo no registra una versión que la persona no vio. Si el flujo no pasó por una pantalla con aviso (un enlace antiguo directo a `/auth/google`), el retorno no registra aceptación y la puerta (D4) la pide.

### D4. La puerta de nueva aceptación

Un middleware, después de resolver la sesión, compara las versiones aceptadas por la persona con las vigentes. Si falta alguna, responde con una redirección a `GET /aceptar` (para métodos seguros) o 403 con el mismo destino (para mutaciones), salvo en una lista corta de rutas exentas: `/aceptar`, `/auth/logout`, `/healthz`, los recursos estáticos, la descarga de los datos propios, la pantalla y el envío de la baja de cuenta y las páginas legales. `/aceptar` muestra qué documento cambió, enlaza a los textos, y ofrece «Aceptar y continuar» (inserta con método `gate`) y «No acepto: cerrar sesión». En modo de desarrollo local y en las pruebas E2E con identidades de desarrollo, la puerta acepta las versiones vigentes automáticamente (marca `method = 'login'`) salvo en las pruebas de la puerta misma. Las dos cuentas de producción existentes pasan por la puerta en su primera visita tras el despliegue.

### D5. Aviso previo de cambios sustanciales

La política dice que los cambios sustanciales se comunican **antes** de aplicarse. Mecanismo: `LEGAL_DOCUMENTS` admite `upcoming: { version, effectiveFrom }`; mientras exista, toda pantalla autenticada muestra una franja con el enlace al texto nuevo y la fecha en que empieza a regir, y la puerta solo exige la versión nueva desde `effectiveFrom`. El plazo de aviso por defecto para un cambio sustancial es de 15 días (Open Questions 2).

### D6. Aviso, enlaces y edad en la pantalla de acceso

Todo lugar que ofrezca «Continuar con Google» muestra, encima del botón: «Al continuar aceptás los [Términos y condiciones] y la [Política de privacidad] y confirmás que tenés 18 años o más.» Se aplica a `/`, `/cuentas-claras` sin sesión, la pantalla de invitación sin sesión y el acceso de Remanso. Una función `renderSignInNotice()` genera el aviso y una prueba recorre las pantallas públicas y falla si una contiene un enlace a `/auth/google` sin el aviso y sus dos enlaces. El pie de la aplicación (con y sin sesión) enlaza «Privacidad · Términos y condiciones». Los enlaces apuntan al sitio del ambiente (producción o staging) con la misma regla que ya usa `tools.js` para el enlace de Fun TasKing.

### D7. Edad mínima

18 años o más, declarada en el aviso de acceso, en los términos («Para usar HomeSuite tenés que ser mayor de 18 años») y en la política. No se verifica. Una persona que aceptó la declaración y resulta menor puede pedir la supresión como cualquier reclamo.

### D8. Encargados y transmisión internacional

Cloudflare (alojamiento, base de datos, copias en R2) y GitHub (ejecución transitoria del respaldo) tratan datos por cuenta de HomeSuite: son **encargados**; el flujo es una **transmisión internacional** a Estados Unidos, que figura entre los países con nivel adecuado en la lista de la SIC (versión 2022 de la Circular Única; no se verificó una versión posterior). Google es proveedor de identidad: recibe a la persona que inicia sesión bajo su propia política y no trata datos por cuenta de HomeSuite. El Decreto 1074 (art. 2.2.2.25.5.2) pide un contrato de transmisión que obligue al encargado a aplicar la política del responsable, a cuidar seguridad y confidencialidad. Los DPA estándar de Cloudflare (v6.4, 2026-04-03) y GitHub (octubre de 2025) cubren seguridad, subencargados y borrado, pero no se comprometen a aplicar la política del responsable ni la Ley 1581. La solución de bajo costo: `docs/HOMESUITE_ENCARGADOS.md` deja constancia escrita, con fecha y versión, de que Pablo aceptó cada DPA y de la analogía con el art. 2.2.2.25.5.2; opcionalmente se agregan las cláusulas modelo de la Red Iberoamericana de Protección de Datos (facultativas, Circular Externa 003 de 2025).

**No verificado:** si el DPA de Cloudflare aplica a una cuenta de plan gratuito; si el de GitHub aplica a una cuenta personal gratuita; dónde se almacenan y procesan D1 y R2 (la ubicación de D1 es una indicación, no una garantía); si hay una versión de la lista de países posterior a 2022.

### D9. Atender solicitudes: registro y medición

Solicitudes por correo a `pablotortorella@gmail.com`. Tipos y plazos (días hábiles; Ley 1581, arts. 14 y 15):

| Tipo | Plazo | Prórroga | Otros |
|---|---|---|---|
| Consulta (acceso) | 10 días hábiles desde el recibo | hasta 5 más, con aviso motivado y fecha nueva | acceso gratuito (art. 8 f; Decreto 1074, art. 2.2.2.25.4.2) |
| Reclamo (corrección, actualización o supresión) | 15 días hábiles desde el día siguiente al recibo | hasta 8 más, con aviso motivado | leyenda «reclamo en trámite» dentro de 2 días hábiles; si está incompleto, se pide subsanar dentro de los 5 días siguientes; sin respuesta en 2 meses se entiende desistido; si no es competente, traslado en 2 días hábiles |

**Registro:** una planilla privada (no en el repositorio, que es público) con una fila por solicitud: identificador interno (`SOL-AAAA-nnn`), tipo, fecha de recibo, fecha de la leyenda «reclamo en trámite», fecha límite, prórroga (sí/no, fecha), fecha de respuesta y resultado en una línea. No lleva el contenido del reclamo ni datos de la persona más allá de lo necesario para ubicar el correo. El documento de procedimiento incluye la plantilla de columnas y las plantillas de respuesta (acuse con «reclamo en trámite», pedido de subsanación, prórroga, respuesta de fondo que dice qué se suprimió ya y qué persiste hasta cuándo).

**Medición:** `scripts/solicitudes-plazos.mjs` lee el CSV exportado de la planilla y calcula las fechas límite en días hábiles de Colombia con un archivo de festivos configurable (lunes a viernes, sin festivos; **la fuente de los festivos no se verificó**: Ley 51 de 1983 y sucesivas), y lista las solicitudes abiertas con los días hábiles que les quedan. La revisión semanal de `alertas-minimas-homesuite` suma «solicitudes abiertas con 5 días hábiles o menos» y las vencidas.

**Supresión no espera a la ventana de 30 días.** Un reclamo de supresión se resuelve dentro del plazo de 15 (o 23) días hábiles aunque la ventana de eliminación de un grupo sea de 30 días: el grupo ya es invisible desde que se elimina (condición de acceso y uso bloqueados) y la respuesta dice qué se suprimió ya y qué persiste hasta cuándo (ventana, base y copias). No existe «eliminar ahora» (decisión de Pablo); se respeta el plazo informando con precisión, no adelantando la purga.

**Verificación de identidad:** a quien tiene cuenta se le responde en el correo de la cuenta; para una persona sin cuenta ver `baja-de-cuenta-homesuite` (Open Questions).

### D10. Copias del respaldo en GitHub

Verificable ya: que el workflow no use `actions/upload-artifact` ni cache de datos, que no imprima contenido (la salida de exportación está suprimida) y que el directorio temporal se destruya (`trap`). Se documenta qué ve GitHub: el runner transitorio tiene la base descifrada durante unos minutos. **Cifrar el respaldo antes de que salga del runner** (por ejemplo con `age` y una clave pública guardada como variable del repositorio, con la clave privada solo en poder de Pablo) reduce lo que GitHub y R2 ven, pero cambia dos cosas: `db:verify-backup` ya no puede restaurar ni probar la integridad automáticamente en el runner (solo comprobar suma y tamaño), y la recuperación depende de custodiar la clave privada. Es una decisión de Pablo (Open Questions 4); no se implementa en este change.

### D11. Advertencia de datos sensibles

Texto de ayuda breve junto a cada campo de texto libre (nombre de persona, descripción y nota de movimiento, nombre y descripción del grupo): «No escribas datos sensibles (salud, religión, afiliaciones).» La política dice que HomeSuite no los pide, que responder es voluntario y que se puede pedir su supresión.

## Risks / Trade-offs

- [La puerta bloquea a todas las personas ante un error de versión] → la prueba de alineación entre fecha y constante, las rutas exentas y la prueba E2E de la puerta; reversión: volver a la versión anterior de la constante.
- [Un texto legal que Pablo no revisó se publica] → ningún texto se publica sin su lectura; las tareas lo dicen y el PR de cada texto lo muestra aparte del código.
- [Los DPA estándar no bastan para el art. 2.2.2.25.5.2] → constancia escrita de aceptación y analogía; revisión de una persona abogada.
- [Registrar la versión mostrada complica el flujo OAuth] → solo agrega un campo a la cookie de estado firmada que ya existe.
- [Los festivos mal cargados dan plazos errados] → archivo configurable, caso de prueba por festivo y revisión de las fechas por Pablo.
- [Cifrar el respaldo reduce la verificabilidad automática] → decisión pendiente de Pablo.

## Migration Plan

1. Migración aditiva (`legal_acceptances`) y Worker con la constante de versiones, el aviso y la puerta; la puerta puede desplegarse apagada por una variable y encenderse tras publicar los textos revisados.
2. Pablo revisa y aprueba los textos. Excepción al orden habitual de `OPERACION.md` (primero la app, después el sitio): aquí se publica **primero el sitio** con los textos nuevos y después la app con la versión nueva y la puerta activa, para que nadie acepte un texto que todavía no puede leer.
3. Reversión: apagar la puerta; las filas ya escritas quedan inofensivas.

## Open Questions

Propuestas por decidir (valor por defecto entre paréntesis, que Pablo debe confirmar):

1. **Una versión por documento** (sí). Alternativa: una versión única para ambos.
2. **Plazo de aviso previo para cambios sustanciales:** 15 días con franja en la aplicación. La norma exige avisar antes pero no fija el plazo.
3. **Aplicabilidad de los DPA de Cloudflare y GitHub a cuentas gratuitas:** no verificada; se documenta la aceptación y se consulta a cada proveedor si hace falta.
4. **Cifrado del respaldo antes de que salga del runner:** no se implementa; decisión de Pablo sobre el costo en verificabilidad y custodia de la clave.
5. **Conservar `legal_acceptances` tras la baja de cuenta** (sí, con identificador opaco). Alternativa: borrarlas con la baja.
6. **Revisión por una persona abogada especialista en datos** de los ocho bloques de texto antes de publicarlos: recomendada, no verificada como realizada.
7. **Leyenda «reclamo en trámite» dentro de la aplicación:** la leyenda se registra en la planilla y en la respuesta; no se agrega una marca en el dato porque la supresión se ejecuta antes del plazo. Si el reclamo es de corrección de un dato que sigue visible, queda por decidir si hace falta una marca.
8. **Fuente de los festivos de Colombia** para la calculadora: por verificar.
9. **Estado de la pantalla de consentimiento de Google** (en pruebas o publicada): por revisar en Google Cloud; incide en el texto del aviso de acceso.
10. **Mayoría de edad:** 18 años, declarativa (la Ley 1581 no fija otra edad; el mínimo para consentir de un menor puede ser menor según otras normas, no evaluado).
