# HomeSuite: normativa de datos personales (investigación de referencia)

> **Aviso.** Esto no es asesoramiento legal; es una investigación de referencia (fecha 2026-11-02) para diseñar el producto. Antes de operar con datos reales conviene una revisión profesional, idealmente de una persona abogada especialista en datos.
>
> **Releer las fuentes en un navegador.** Una consulta (el PDF de la Ley 1581 en Función Pública) se hizo sin verificar TLS, y otras se leyeron en compilaciones o por resúmenes automáticos. Los artículos citados deben releerse en las fuentes oficiales antes de apoyar en ellos un texto legal.
>
> **Este documento es referencia, no regla.** Las reglas del producto viven en los specs de OpenSpec (`politica-de-tratamiento-de-datos`, `aceptacion-de-terminos`, `atencion-de-solicitudes-de-datos`, `baja-de-cuenta`, `eliminacion-de-grupos`, `purga-de-grupos`) y en [HOMESUITE_DATA_LIFECYCLE.md](HOMESUITE_DATA_LIFECYCLE.md). Si algo de acá difiere de un spec, manda el spec.

Normas principales: [Ley 1581 de 2012](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981) y [Decreto 1074 de 2015](https://normativa.colpensiones.gov.co/colpensiones/docs/decreto_1074_2015_pr025.htm) (capítulos 25 y 26; el capítulo 26 está en la [parte 26](https://normativa.colpensiones.gov.co/colpensiones/docs/decreto_1074_2015_pr026.htm) de la misma compilación).


Fecha de consulta de todas las fuentes: 2026-11-02. Responsable: Pablo Tortorella (persona natural, Rionegro, Colombia).

Cada sección separa lo que dice la norma (con artículo y fuente) de la interpretación (marcada **Interpretación**). Las decisiones de texto legal las revisa Pablo, idealmente con una persona abogada especialista en datos. «No verificado» significa que no hallé la fuente primaria o que no pude leerla.

**Cómo se verificó.**
- **Texto de la Ley 1581.** Sale del PDF de Función Pública. Su certificado TLS no valida en esta máquina y bajé ese PDF (y otro de la SIC que no usé) con la verificación desactivada, en un solo comando. El sistema me bloqueó el intento siguiente y no seguí. Conviene releer los artículos citados en el sitio del Senado o de Función Pública desde un navegador.
- **Decreto 1074/2015 (caps. 25 y 26).** Lo leí en la compilación de Colpensiones (entidad pública), no en Función Pública ni en el Senado.
- **Circular Única, Título V.** La versión que leí es la del 29-09-2022, publicada por la SIC. Su sitio principal falla la validación TLS desde esta herramienta, pero `sedeelectronica.sic.gov.co` sí abrió.
- **Cloudflare, GitHub y Google.** Usé resúmenes automáticos de sus páginas oficiales de DPA. Conviene leer los textos completos antes de citarlos.

## Resumen en diez líneas

1. Ley 1581 aplica porque el tratamiento ocurre en Colombia (art. 2), sin importar la nacionalidad de las personas usuarias.
2. Plazos: consulta 10 días hábiles (+5); reclamo o supresión 15 días hábiles (+8) (arts. 14 y 15).
3. La norma no fija un plazo máximo de conservación en respaldos. Una baja lógica de 30 días más 90 días de respaldos es defendible si se informa y se cumple el plazo de respuesta.
4. Conservar el nombre con «(cuenta eliminada)» por defecto es el punto más débil. No hay en Colombia un «interés legítimo» como en el RGPD, y Splitwise y Tricount quitan o seudonimizan el nombre.
5. Opción recomendada: en la baja, una elección explícita y sin casilla marcada de antemano. Por defecto, seudonimizar si no se elige.
6. Cloudflare y GitHub son «encargados» (transmisión). Google, para el inicio de sesión, no lo es.
7. EE. UU. figura en la lista de la SIC de países con nivel adecuado, según la versión 2022 de la Circular Única. El proyecto de 2026 solo propone agregar países. Falta el contrato de transmisión documentado.
8. Una persona natural no está obligada a inscribirse en el RNBD: el Decreto 1074 la limita a sociedades y entidades sin ánimo de lucro con más de 100.000 UVT, y a entidades públicas.
9. Los datos financieros no son «sensibles» por definición (art. 5). Pero hay riesgo de datos sensibles incidentales en las descripciones libres.
10. Hoy faltan: aviso y registro de aceptación en el inicio de sesión, plazos y procedimiento en la política, y mención de GitHub y de los respaldos.

---

## 1. Plazos y forma de atender derechos

**La norma dice.**
- **Consultas.** Se atienden en un máximo de **10 días hábiles** desde el recibo. Si no se puede, se avisa con los motivos y la nueva fecha, que no puede pasar de **5 días hábiles** más (Ley 1581, art. 14). Fuente: [Función Pública, Ley 1581](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981).
- **Reclamos** (corrección, actualización o supresión; art. 15):
  - Si el reclamo está incompleto, se pide subsanar dentro de los 5 días siguientes. Si pasan 2 meses sin respuesta, se entiende desistido.
  - Si quien lo recibe no es competente, da traslado en 2 días hábiles.
  - Se incluye la leyenda «reclamo en trámite» en 2 días hábiles y se mantiene hasta decidir.
  - Plazo máximo: **15 días hábiles** desde el día siguiente al recibo, prorrogable hasta **8 días hábiles** más con aviso motivado.
- **Acceso gratuito:** art. 8 f). El Decreto 1074 (art. 2.2.2.25.4.2) lo ofrece al menos una vez por mes calendario. Fuente: [Decreto 1074, compilación Colpensiones, parte 26](https://normativa.colpensiones.gov.co/colpensiones/docs/decreto_1074_2015_pr026.htm).
- **Procedibilidad:** solo se puede quejar ante la SIC después de agotar la consulta o el reclamo (art. 16).
- **Supresión:**
  - El art. 8 e) la condiciona a que el tratamiento no respete principios o derechos. El texto literal de la ley dice que procede cuando la SIC haya determinado conductas contrarias a la ley.
  - El Decreto 1074 art. 2.2.2.25.2.6 es más amplio: la persona titular puede «en todo momento» pedir supresión o revocar la autorización mediante reclamo. **No procede** si tiene «un deber legal o contractual de permanecer en la base de datos». Fuente: [Decreto 1074, parte 25](https://normativa.colpensiones.gov.co/colpensiones/docs/decreto_1074_2015_pr025.htm). La SIC lo repite en el [Concepto 15-039288](https://sedeelectronica.sic.gov.co/sites/default/files/normatividad/Concepto_15-039288.pdf) (2015-04-09).
  - El art. 2.2.2.25.2.8 exige conservar los datos solo el tiempo «razonable y necesario» para la finalidad y suprimirlos después, «sin perjuicio de normas legales que dispongan lo contrario».
- **Política de tratamiento** (Decreto 1074, art. 2.2.2.25.3.1), lenguaje claro y con estos seis contenidos mínimos:
  1. Nombre, domicilio, correo y teléfono de quien responde.
  2. Tratamiento y finalidad.
  3. Derechos de la persona titular.
  4. Persona o área que atiende solicitudes.
  5. Procedimiento para acceso, actualización, rectificación, supresión y revocación (art. 2.2.2.25.3.6).
  6. Fecha de entrada en vigor y vigencia de la base de datos.
  - Los cambios sustanciales se comunican **antes** de aplicarlos.
- **Sanciones** (Ley 1581, art. 23): multas de hasta 2.000 SMMLV, suspensión o cierre.

**Interpretación.**
- La norma no fija un máximo de conservación en copias de respaldo ni dice cómo informarlo. Las reglas que sí lo tocan son el plazo de respuesta, la supresión y la limitación temporal.
- Baja lógica de 30 días más respaldos de 90 días: es defendible si se cumplen estas condiciones:
  - **a)** La baja lógica ya bloquea el acceso y el uso, y no es solo una marca.
  - **b)** Los respaldos están aislados y vencen solos.
  - **c)** Un restore no reintroduce datos suprimidos.
  - **d)** La respuesta al reclamo dice qué se suprimió ya y qué persiste hasta cuándo, dentro de 15 (o 23) días hábiles.
- **Riesgo concreto.** Si los 30 días son una ventana en la que los datos siguen activos, pueden pasar los 15 días hábiles (unas 3 semanas) o los 23 con prórroga (unas 4,5). Hay que tratar los 30 días como ventana de arrepentimiento y no esperar a que termine para contestar un reclamo.
- **Falta en la política actual:**
  - Plazos y requisitos del reclamo.
  - Mención de la SIC como autoridad.
  - Vigencia de la base de datos.
  - Detalle de qué pasa con respaldos y copias locales.

## 2. Supresión frente a registros compartidos

**La norma colombiana dice.**
- La única excepción a la supresión es el «deber legal o contractual de permanecer en la base de datos» (Decreto 1074, art. 2.2.2.25.2.6). No hay una excepción de «interés de terceros» ni de «interés legítimo».
- El tratamiento exige autorización previa, expresa e informada (arts. 4 c), 9 y 12 de la Ley 1581). Las excepciones del art. 10 son pocas (requerimiento de autoridad, datos públicos, urgencia médica, fines históricos o estadísticos autorizados por ley, registro civil).
- El principio de veracidad (art. 4 d) prohíbe tratar datos «parciales, incompletos, fraccionados o que induzcan a error». Se puede argumentar que borrar un nombre de un libro compartido fracciona el historial.
- El art. 2 a) excluye las bases «exclusivamente personales o domésticas». Pero si esa base se suministra a terceros, hay que informar y pedir autorización. Una plataforma que aloja el libro no queda cubierta por esa exclusión.

**Interpretación.**
- **Ninguna de las tres bases propuestas es sólida por sí sola.**
  - *Deber legal.* No identifico ninguno aplicable a un libro doméstico de gastos. El deber de conservar libros de comercio no aplica a gastos compartidos entre particulares.
  - *Deber contractual.* El contrato de la persona que se va es con Pablo (los términos). No la obliga frente al resto del grupo a quedar en la base.
  - *«Dato ya conocido por el grupo».* Es un argumento práctico, no jurídico. Sirve para ponderar el daño.
- **Camino más seguro bajo la Ley 1581: autorización informada más elección explícita.**
  - Informar al sumarse al grupo que, al darse de baja, el nombre puede quedar en el historial de las demás personas.
  - Pedir una elección activa en la baja.
- Un nombre con «(cuenta eliminada)» sigue siendo dato personal para quien conoce a la persona: es seudonimización, no anonimización. Así lo dice el RGPD (considerando 26).

**Referencias comparadas.**
- **RGPD art. 17.** Fuente no oficial: [gdpr-info.eu](https://gdpr-info.eu/art-17-gdpr/); el texto oficial de EUR-Lex no se pudo abrir.
  - Obliga a suprimir sin demora indebida cuando hay oposición sin motivos legítimos prevalecientes (17.1 c) y 21).
  - Exceptúa el tratamiento necesario para una obligación legal (17.3 b) o para defender reclamaciones legales (17.3 e).
  - Con base de interés legítimo (art. 6.1 f), el RGPD permite ponderar el interés del grupo en un libro exacto. Colombia no tiene esa base.
- **Splitwise.** Política del 26-05-2026, [splitwise.com/privacy](https://www.splitwise.com/privacy):
  - Borrar la cuenta quita «todos los datos personales».
  - La información no personal de gastos compartidos sigue visible en las cuentas de los demás.
  - Se quitan el nombre y los datos de contacto.
- **Tricount (bunq).** Política del 07-03-2025, [tricount.com/en/privacy-policy](https://tricount.com/en/privacy-policy), §5.1:
  - Los gastos no se borran porque «pueden seguir beneficiando a otras personas».
  - Los identificadores se **seudonimizan** dentro de los tricounts.
- Ambos servicios quitan o seudonimizan el nombre. Conservarlo por defecto es más agresivo que la práctica del sector. Esto sale de sus textos; su implementación real no la probé.
- **Argentina, Ley 25.326 art. 16 inc. 5** ([Infoleg](https://servicios.infoleg.gob.ar/infolegInternet/anexos/60000-64999/64790/norma.htm)): la supresión no procede si «pudiese causar perjuicios a derechos o intereses legítimos de terceros». Es la única de estas normas que nombra el interés de terceros.

**Opciones que cumplen (ordenadas de más a menos protectora).**
- **A. Seudonimizar por defecto.** Se muestra «Persona eliminada». Queda alineada con Splitwise y Tricount. Pierde claridad en el grupo.
- **B. Elección explícita en la baja (recomendada).**
  - Dos opciones sin casilla marcada de antemano: «Conservar mi nombre como "Nombre (cuenta eliminada)"» o «Quitar mi nombre».
  - No se puede terminar la baja sin elegir. El silencio no vale como autorización (Decreto 1074, art. 2.2.2.25.2.4).
  - Se guarda la elección como prueba.
  - Si la persona no pasa por la interfaz y pide la baja por correo, se aplica A.
- **C. Conservar por defecto, con opción de quitar.** Es la idea original. Es defendible solo si el aviso previo es claro y se atienden las solicitudes dentro del plazo. Es la más expuesta ante la SIC.

En cualquier opción, la baja inmediata quita el correo, la foto, el emoji, el color y el identificador de Google. Las descripciones libres de los movimientos pueden contener el nombre (por ejemplo, «cena con Ana») y no se pueden limpiar automáticamente: hay que decirlo en la política.

## 3. Transferencia o transmisión internacional

**La norma dice.**
- **Definiciones** (Decreto 1074, art. 2.2.2.25.1.3, según la compilación de Colpensiones): la *transmisión* es el tratamiento que implica comunicar datos, dentro o fuera del país, a un **encargado** que trata por cuenta del responsable. La SIC la distingue de la *transferencia*, que va a otro responsable: ver el considerando de la [Circular Externa 003 de 2025](https://sedeelectronica.sic.gov.co/sites/default/files/normativa/Circular%20Externa%20003%20de%202025.pdf) (2025-12-19).
- **Transmisión con contrato** (Decreto 1074, art. 2.2.2.25.5.2). No requiere informar a la persona titular ni obtener su consentimiento si existe un contrato de transmisión que:
  - señale alcances y actividades del encargado,
  - lo obligue a tratar los datos conforme a los principios y la política del responsable,
  - lo obligue a cuidar la seguridad y la confidencialidad.
- **Prohibición de transferir** a países sin nivel adecuado, con excepciones (Ley 1581, art. 26). Los países adecuados los fija la SIC (Circular Única, Título V, cap. 3, núm. 3.2).
  - **Estados Unidos figura** en esa lista en la versión del 29-09-2022: [Título V](https://sedeelectronica.sic.gov.co/sites/default/files/normatividad/092022/T%C3%ADtulo%20V%20Versi%C3%B3n%2029-09-2022.pdf), incluido por la Circular Externa 005 de 2017 ([compilación DIAN](https://normograma.dian.gov.co/dian/compilacion/docs/circular_superindustria_0005_2017.htm)).
  - Parágrafo 4: la transmisión a países adecuados es posible en los términos de la transferencia. Parágrafo 3: el simple tránsito de datos no es transferencia. Parágrafo 1 de 3.2: igual hay que poder demostrar medidas apropiadas (responsabilidad demostrada, Decreto 1074 art. 2.2.2.25.6.1).
  - **Vigencia.** No encontré una norma posterior que quite a EE. UU. La prensa (Asuntos Legales, 19-06-2026) informa un proyecto de la SIC para **agregar** Brasil, Ecuador, Kenia, Panamá y Sudáfrica. Es un proyecto, no lo verifiqué en la SIC, y no confirmé qué versión consolidada rige hoy: **no verificado** si hay una versión posterior a 2022.
- **Cláusulas modelo de la RIPD.** La Circular 003 de 2025 las reconoce como herramienta **facultativa**, para transferencias y transmisiones. No sustituyen las excepciones del art. 26 ni crean presunción de legalidad.
- **Datos que Google entrega en el inicio de sesión.** Google no actúa como encargado de HomeSuite: es proveedor de identidad. La política de datos de usuario de las API de Google exige publicar una política de privacidad exacta y accesible, y usar los datos solo como allí se informa ([Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), actualizada 15-02-2024). La página de DPA de Google Cloud no trata el inicio de sesión de cuentas personales ([cloud.google.com/terms/data-processing-addendum](https://cloud.google.com/terms/data-processing-addendum)).

**DPA de los proveedores.**
- **Cloudflare** ([DPA v6.4, 03-04-2026](https://www.cloudflare.com/cloudflare-customer-dpa/); [subencargados, actualizada 01-10-2025](https://www.cloudflare.com/gdpr/subprocessors/cloudflare-services/)):
  - Actúa como procesador.
  - Tiene cláusulas contractuales tipo de la UE, adenda del Reino Unido y Marco de Privacidad de Datos UE-EE. UU.
  - Autoriza subencargados con aviso de 30 días.
  - Borra o devuelve los datos al terminar.
  - Avisa las brechas «sin demora indebida».
  - Cubre leyes europeas y de EE. UU.; no menciona Colombia.
  - Se incorpora al contrato principal (self-serve). El texto no aclara si aplica a un plan gratuito.
- **GitHub** ([DPA, versión octubre de 2025](https://github.com/customer-terms/github-data-protection-agreement)):
  - Procesador por defecto.
  - Cláusulas tipo de la UE, Marco de Privacidad de Datos y adenda del Reino Unido.
  - Aviso de subencargados con 30 días.
  - Cubre «Online Services» bajo contrato escrito. Si una cuenta personal gratuita está bajo ese acuerdo: **no verificado**.
  - Su declaración general de privacidad no aclara si el DPA aplica a cuentas gratuitas.
- **Google:** el documento revisado es de Cloud. No hay DPA aplicable a este uso, y no hace falta si Google no actúa por cuenta de HomeSuite.

**Interpretación.**
- Cloudflare (Workers, D1, R2) y GitHub Actions (runner de respaldo) son **encargados**. El flujo es una **transmisión internacional**. Con EE. UU. como país adecuado y un contrato, no se necesita autorización adicional por la transmisión.
- **Los DPA estándar probablemente alcanzan como base**, porque cubren seguridad, confidencialidad, subencargados y borrado. Pero ninguno compromete expresamente a aplicar la política del responsable ni la Ley 1581, que el art. 2.2.2.25.5.2 pide.
  - Solución de bajo costo: dejar constancia escrita de que se aceptó el DPA de cada proveedor, con fecha, y agregar a la documentación del responsable la analogía con el art. 2.2.2.25.5.2. Opcionalmente, las cláusulas modelo de la RIPD.
- Cloudflare procesa en una red global y el nivel «adecuado» no cubre todos los países. La ubicación ENAM de D1 es una indicación de ubicación; que el almacenamiento y el procesamiento queden solo allí: **no verificado**. Las páginas de localización de datos de Cloudflare que consulté no hablan de D1 ni R2.
- **Mejora técnica para la brecha de GitHub:** cifrar el respaldo antes de que salga del runner, y no dejar artefactos ni registros con datos. Así GitHub solo ve datos cifrados.
- **Cambios en la política de privacidad.** Hoy dice que los proveedores «pueden tratar datos en otros países conforme a sus servicios». Es insuficiente: no nombra GitHub, no explica los respaldos ni dice que Cloudflare es encargado.

## 4. Obligaciones formales

**RNBD.**
- La Ley 1581 (art. 25) crea el registro. El Decreto 1074, art. 2.2.2.26.1.2 (modificado por el Decreto 090 de 2018), obliga a **sociedades y entidades sin ánimo de lucro con activos totales superiores a 100.000 UVT** y a personas jurídicas de naturaleza pública. La Circular Única, Título V, cap. 2, núm. 2.1, dice lo mismo. Las bases nuevas se inscriben dentro de los dos meses siguientes a su creación (art. 2.2.2.26.3.1).
- **Interpretación.** Una persona natural no figura entre quienes deben inscribirse, así que Pablo no está obligado hoy. Un precedente de lectura: fuentes secundarias de contabilidad lo resumen igual (no oficiales). Para una sociedad futura, el umbral es de miles de millones de pesos: mi cálculo con la UVT 2026 es del orden de COP 5.000 millones, **no verificado**.
- Si HomeSuite se constituye como sociedad o entidad sin ánimo de lucro, hay que revisar el umbral de activos. Seguir atento al proyecto de actualización del Título V de 2026.

**Aviso de privacidad y autorización.**
- Ley 1581, art. 12: al **solicitar** la autorización hay que informar la finalidad, el carácter facultativo de datos sensibles y de menores, los derechos y la identificación del responsable, y conservar prueba de ello.
- Art. 9: autorización previa e informada «por cualquier medio» consultable después. Decreto 1074, art. 2.2.2.25.2.4: puede ser escrita, oral o por conductas inequívocas; **el silencio nunca**.
- El aviso de privacidad (art. 2.2.2.25.3.2) se usa cuando no se puede poner la política a disposición de la persona titular.
- **Interpretación.** Basta con que el inicio de sesión muestre «Al continuar aceptás los términos y la política» con enlaces, siempre que se guarde prueba (fecha, versión).
- **Hallazgo en el repositorio.** La instantánea de pruebas de la pantalla sin sesión (`apps/app/test/__snapshots__/shell/raiz-sin-sesion.html`) no muestra enlaces a términos ni a privacidad ni aviso de aceptación. Verificarlo en producción. Tampoco encontré en el código un registro de la aceptación.
- **Personas sin cuenta.** Alguien las agrega sin que ellas lo sepan, así que no hay autorización previa de su parte. Es un riesgo que ya existe. La política debe darles un canal y explicar que quien las agregó es quien aporta el dato.

**Datos sensibles.**
- Ley 1581, art. 5: son los que afectan la intimidad o cuyo uso indebido puede generar discriminación. Los enumera con «tales como»: origen racial o étnico, orientación política, convicciones religiosas o filosóficas, sindicatos, salud, vida sexual, biométricos. **Los datos financieros no están en la lista.**
- Art. 6: su tratamiento está prohibido salvo autorización explícita u otras excepciones. El Decreto 1074 (art. 2.2.2.25.2.3) agrega que ninguna actividad puede condicionarse a darlos.
- **Interpretación.** Los importes y quién pagó no son sensibles por sí. Las descripciones libres sí pueden revelar salud, religión o afiliación («psicóloga», «diezmo», «cuota sindical»). La política y la interfaz deberían decir que HomeSuite no pide ese tipo de datos y que no hay que escribirlos.
- **Menores** (art. 7): su tratamiento está proscrito salvo datos públicos. Ni la política ni los términos fijan una edad mínima: conviene exigir 18 años o más.

## 5. Otras jurisdicciones (esencial)

- **Argentina, Ley 25.326** ([Infoleg](https://servicios.infoleg.gob.ar/infolegInternet/anexos/60000-64999/64790/norma.htm)).
  - Plazos: acceso en 10 días corridos (art. 14.2); rectificación, actualización o supresión en 5 días hábiles (art. 16.2). Más cortos que los colombianos.
  - La supresión no procede si perjudica derechos o intereses legítimos de terceros o hay obligación legal de conservar (art. 16.5).
  - Registro de bancos de datos de uso no personal (arts. 21 y 24).
  - Condición para que aplique: art. 44, ley de orden público en el territorio argentino; la jurisdicción depende de bases ubicadas o tratadas allí.
  - **No verificado** si la AAIP la ha aplicado a servicios extranjeros sin establecimiento local. Probablemente no obligue a Pablo, pero conviene responder rápido.
- **RGPD** (Reglamento 2016/679). Texto oficial de EUR-Lex: no pude abrirlo.
  - Aplica a responsables fuera de la UE si ofrecen bienes o servicios a personas en la UE o monitorean su conducta (art. 3.2). Plazo de respuesta: un mes, prorrogable dos más (art. 12.3, de memoria, **no verificado** en la fuente oficial).
  - Hoy no hay usuarios de la UE. Si hubiera, habría que evaluar si hay oferta dirigida a la UE (idioma, moneda, marketing), un representante en la UE (art. 27) y la base legal del art. 6.
  - Nota: Splitwise designa un representante en la UE y el Reino Unido en su política.

---

## Qué cambiaría en los changes de baja de cuenta y eliminación de grupos

**Nota.** En `openspec/changes/` hoy no hay un change con ese nombre. La necesidad figura en `docs/PRODUCT_BACKLOG.md` (Exportación y eliminación administrada de un grupo, prioridad alta), con el punto 4: «política para solicitudes de eliminación de cuenta cuando la identidad siga siendo necesaria en libros compartidos».

1. **Baja de cuenta con elección explícita.**
   - Pantalla con las dos opciones del punto 2-B, sin ninguna marcada de antemano.
   - Registrar la elección con fecha.
   - Por correo o sin elección, aplicar la seudonimización.
2. **Qué se borra al instante.** Correo, foto, emoji, color, identificador de Google y sesiones. Se queda un identificador interno opaco y, según la elección, el nombre o «Persona eliminada».
3. **Ventana de 30 días.** Es solo un arrepentimiento opcional. Un reclamo de supresión se resuelve en 15 días hábiles sin esperar. Ofrecer «borrar ahora».
4. **Historial.** Aplicar la misma seudonimización a revisiones y eventos (autoría), no solo a las filas de integrantes.
5. **Respaldos.** Mantener una lista de supresiones que se vuelva a aplicar en cualquier restore. Incluir en la prueba del change «exportar, eliminar y restaurar» una comprobación de que lo suprimido no reaparece.
6. **Copias locales.** Staging y TasKing en la computadora de Pablo: incluirlas en la supresión o no cargarles datos reales.
7. **Eliminación de grupos.** Quién puede eliminar, aviso a las demás personas integrantes, exportación previa y verificación de que no quedan filas huérfanas. Una persona integrante que pide supresión sale del grupo; no se borra el grupo entero.
8. **Personas sin cuenta.** Definir el trámite para ellas (por correo, con verificación de identidad) y aplicar el mismo criterio de nombre.
9. **Registro de aceptación.** Guardar versión de términos y política con fecha en el inicio de sesión.
10. **Atención de reclamos.** Registro simple con fechas (recibo, «reclamo en trámite», respuesta) para probar los plazos de los arts. 14 y 15.
11. **Exportación personal.** Sirve de respuesta gratuita a consultas (art. 8 f; Decreto 1074, art. 2.2.2.25.4.2).
12. **Respaldo en GitHub.** Cifrarlo antes de que salga del runner, sin artefactos.

## Qué habría que agregar a `privacidad.html` (TEXTO LEGAL: lo revisa Pablo)

Propuestas para revisar. No están validadas por una persona abogada.

1. **Finalidades y autorización.**
   «Al iniciar sesión aceptás el tratamiento descrito en esta política para estas finalidades: crear y mantener tu cuenta, operar los grupos de Cuentas Claras, proteger el servicio y atender tus solicitudes. Podés revocar tu autorización con los límites descritos más abajo.»
2. **Carácter facultativo y datos sensibles.**
   «HomeSuite no te pide datos sensibles. No los escribas en descripciones o nombres. Si lo hacés, tu respuesta es voluntaria y podés pedir su supresión. Para usar HomeSuite tenés que ser mayor de 18 años.»
3. **Encargados y transmisión internacional.**
   «Para operar usamos Cloudflare (alojamiento de la aplicación, base de datos y copias de seguridad, con procesamiento en Estados Unidos y otros países) y GitHub (ejecución transitoria de las copias de seguridad), como encargados que tratan datos por nuestra cuenta, con contratos de tratamiento de datos. Google es proveedor de identidad para el acceso con tu cuenta, bajo su propia política. Estados Unidos figura entre los países con nivel adecuado de protección según la Superintendencia de Industria y Comercio.»
4. **Derechos y plazos.**
   «Responsable de atender solicitudes: Pablo Tortorella, en pablotortorella@gmail.com. Las consultas se responden en un máximo de 10 días hábiles, prorrogables 5 días hábiles más con aviso. Los reclamos de corrección, actualización o supresión, en un máximo de 15 días hábiles, prorrogables 8 días hábiles más. El reclamo debe indicar tu identificación, los hechos y una dirección de respuesta; si falta algo, te lo pedimos dentro de los 5 días siguientes. El acceso a tus datos es gratuito. Podés presentar una queja ante la Superintendencia de Industria y Comercio después de agotar este trámite.»
5. **Baja de cuenta y registros compartidos.**
   «Si te das de baja, borramos tu correo, foto y datos de perfil. En los grupos de otras personas, los movimientos se conservan porque forman parte de su historial. Al darte de baja elegís si tu nombre queda como "Nombre (cuenta eliminada)" o se reemplaza por "Persona eliminada". Si no elegís, se reemplaza. Las descripciones escritas por otras personas pueden mencionarte y no se modifican automáticamente; podés pedirnos la revisión.»
6. **Copias de seguridad y vigencia.**
   «La baja se aplica de inmediato en la aplicación. Las copias de seguridad vencen a los 90 días y los datos suprimidos no se restauran. La base de datos de Cuentas Claras se conserva mientras exista la cuenta o el grupo y, en las copias, hasta 90 días más.»
7. **Personas sin cuenta.**
   «Si alguien te registró en un grupo sin que tengas cuenta, quien lo hizo aportó tu nombre. Podés escribirnos para conocer, corregir o pedir la supresión de ese dato.»
8. **Cambios sustanciales.**
   «Si cambia el tratamiento de forma sustancial, te avisaremos antes de que se aplique.»

Además de `privacidad.html`: en `terminos.html` falta la edad mínima, y en el inicio de sesión de la aplicación, el aviso con enlaces a ambos textos.
