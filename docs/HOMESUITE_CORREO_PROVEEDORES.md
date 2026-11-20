# Correo electrónico: Brevo y Resend

**Para qué sirve:** elegir el proveedor de correo de la prioridad 3 del
[backlog](PRODUCT_BACKLOG.md#-prioridades-de-pablo-orden-del-2026-11-19).
Pablo pidió comparar los dos planes gratuitos con tres criterios: facilidad de
alta, facilidad de mantenimiento y, sobre todo, seguridad. La decisión es de Pablo
y está pendiente.

**Fuentes:** todo se leyó el 2026-11-19 en páginas oficiales de cada proveedor,
salvo donde se indica otra fuente. Lo marcado «no verificado» no se pudo confirmar
en una página oficial. Precios y límites cambian: volver a leerlos antes de dar de
alta una cuenta.

## El caso de HomeSuite

- **Qué correos:** invitaciones, avisos de cambios en los textos legales y
  notificaciones. Volumen bajo: hoy hay dos cuentas, a lo sumo serán decenas, muy
  por debajo de 100 correos por día.
- **Cómo se envía:** desde un Worker de Cloudflare. Una API HTTP con `fetch` es
  simple; SMTP desde un Worker es incómodo.
- **El dominio:** `homesuite.info` ya está en el DNS de Cloudflare.
- **El proveedor pasa a ser encargado** (Ley 1581): va en
  [encargados](HOMESUITE_ENCARGADOS.md) y en la política de privacidad, con el país
  del tratamiento. Sumarlo obliga a una versión nueva de la política, con aviso
  previo.

## Resumen

| | Brevo (Free) | Resend (Free) |
|---|---|---|
| **Cupo** | 300 por día. Hasta 1.000 transaccionales más quedan en cola de reintento. | 100 por día y 3.000 por mes (día UTC). Lo que pasa del cupo falla con 429, sin cola. Cada destinatario cuenta. |
| **Alta** | Aprobación manual de la cuenta y, además, activación del envío transaccional por ticket | Inmediata, sin aprobación |
| **DNS en Cloudflare** | Alta automática de registros; no verificado que funcione con Cloudflare. Verificación de hasta 48 h. | Botón «Sign in to Cloudflare» (Domain Connect); verifica en minutos |
| **Marca en los correos** | «Sent with Brevo» en el plan Free; no verificado si aplica a los transaccionales por API | Ninguna |
| **Tarjeta** | No | No |
| **Clave de API** | Permisos por recurso, pero **no hay «sólo enviar»**: quien envía también puede borrar registros y bloquear contactos. Vence de 7 días a 1 año. **Se desactiva tras 90 días sin uso.** | `sending_access`: **sólo enviar**, restringible a un dominio |
| **IPs permitidas** | Sí; bloquea IPs desconocidas después de una fase de aprendizaje | No documentado |
| **Firma de webhooks** | No: sólo usuario y contraseña, bearer o cabeceras propias | Sí (Svix, HMAC) |
| **2FA** | TOTP o SMS | TOTP |
| **Certificaciones** | ISO 27001:2022 | SOC 2 Type II (período 2025-02 a 2026-02), pentest anual |
| **Dónde están los datos** | Unión Europea (Francia, Alemania, Bélgica) | Estados Unidos (AWS) |
| **Retención de registros** | **Indefinida por defecto**, con vistas previas de los correos; configurable de 1 a 24 meses | 30 días, fija |
| **DPA** | Apéndice 3 de los términos, para todos los planes | Prefirmado desde el alta, para todos los planes |
| **Incidentes** | Dos en septiembre de 2026 | Una brecha de metadatos en enero de 2024 |
| **Empresa** | Brevo SAS, París | Plus Five Five, Inc., San Francisco |

## Alta y mantenimiento

### Brevo

- **Alta en dos pasos:** «Once we approve your account for sending, you can start
  sending up to 300 emails per day» ([precios](https://www.brevo.com/pricing/)). El
  transaccional pide aparte un ticket a soporte
  ([ayuda](https://help.brevo.com/hc/en-us/articles/115000188150)).
- **DNS:** código Brevo (TXT), DKIM y DMARC. Si ya existe un DMARC, el alta
  automática ofrece reemplazarlo, así que conviene cargarlo a mano
  ([ayuda](https://help.brevo.com/hc/en-us/articles/12163873383186)).
- **Envío:** `POST https://api.brevo.com/v3/smtp/email` con la cabecera `api-key`
  ([documentación](https://developers.brevo.com/docs/send-a-transactional-email)).
  Con `fetch` alcanza; no verificado que su SDK funcione en Workers.
- **Mantenimiento:**
  - la clave se desactiva tras 90 días sin una llamada exitosa, con aviso 7 días
    antes ([ayuda](https://help.brevo.com/hc/en-us/articles/209467485)). Con
    correos poco frecuentes, como los avisos legales, eso puede cortar el envío sin
    que nadie lo note;
  - una cuenta Free sin uso durante 4 meses se borra, aunque los envíos
    transaccionales cuentan como uso
    ([ayuda](https://help.brevo.com/hc/en-us/articles/4410311028626));
  - el bloqueo de IPs desconocidas puede chocar con las IPs de salida de Workers,
    que cambian (no verificado en Workers)
    ([ayuda](https://help.brevo.com/hc/en-us/articles/5740111683858));
  - hay cuentas que pasan a revisión o a envío restringido según rebotes y quejas
    ([ayuda](https://help.brevo.com/hc/en-us/articles/360017299259)).

### Resend

- **Alta:** «Free accounts have full production access immediately. There is no
  sandbox mode, no approval process»
  ([ayuda](https://resend.com/docs/knowledge-base/does-resend-require-production-approval.md)).
- **DNS:** MX y SPF en el subdominio `send`, DKIM y DMARC opcional. El valor del MX
  (`feedback-smtp.us-east-1.amazonses.com`) muestra que el envío sale por Amazon
  SES ([guía para Cloudflare](https://resend.com/docs/guides/dns/cloudflare.md)).
  Los registros no pueden ir con el proxy de Cloudflare (nube naranja).
- **Envío:** `POST https://api.resend.com/emails` con `Authorization: Bearer`.
  Tiene una guía oficial para Workers
  ([guía](https://resend.com/docs/send-with-cloudflare-workers.md)).
- **Mantenimiento:**
  - una clave no se puede volver a ver; para rotarla se crea otra y se borra la
    anterior. El panel muestra el último uso;
  - es socio del escaneo de secretos de GitHub: si una clave se publica por error,
    la revoca sola y avisa
    ([novedades](https://resend.com/changelog/github-secret-scanner.md));
  - suprime solos los destinatarios que rebotan o se quejan
    ([ayuda](https://resend.com/docs/dashboard/emails/email-suppressions.md));
  - con más de 4 % de rebotes o 0,08 % de quejas, puede cerrar la cuenta sin aviso
    ([uso aceptable](https://resend.com/legal/acceptable-use)).

## Seguridad

### Brevo

- **Certificación:** ISO 27001:2022
  ([seguridad](https://www.brevo.com/features/data-security/)). No se encontró un
  informe SOC 2 propio de Brevo.
- **Claves:** el permiso que permite enviar también permite borrar registros y
  bloquear contactos. Las claves antiguas conservan acceso total hasta que se
  editen ([ayuda](https://help.brevo.com/hc/en-us/articles/40158285046930)).
  Ofrece OAuth de máquina a máquina con tokens de una hora; no verificado si está
  en el plan Free ni si sirve para enviar.
- **Cuenta:** 2FA por app o SMS, sólo para cuentas validadas. Un solo usuario en
  Free. SSO sólo en Enterprise.
- **Webhooks sin firma:** quien conozca la URL puede falsificar un aviso de rebote,
  salvo que se agregue una credencial en la URL o una cabecera, y la lista de IPs
  de Brevo ([documentación](https://developers.brevo.com/docs/secured-webhooks.md)).
- **Datos:** «all located within the European Union»
  ([ayuda](https://help.brevo.com/hc/en-us/articles/360001005510)). Entre sus
  subencargados figuran Cloudflare y, como opcionales, proveedores de IA (DPA,
  anexo 2, en los [términos](https://www.brevo.com/legal/termsofuse/)).
- **Retención:** «Transactional logs and email previews are stored indefinitely by
  default» ([ayuda](https://help.brevo.com/hc/en-us/articles/4415743225746)). Si se
  elige Brevo, bajarla el primer día.

### Resend

- **Certificación:** SOC 2 Type II y pentest anual
  ([seguridad](https://resend.com/security)). El período del informe terminó en
  febrero de 2026; no verificado si ya hay uno nuevo.
- **Claves:** `sending_access` sólo envía y se puede limitar a `homesuite.info`
  ([API](https://resend.com/docs/api-reference/api-keys/create-api-key.md)). Si esa
  clave se filtra, sirve para mandar correos y nada más.
- **Cuenta:** 2FA por app TOTP desde octubre de 2026
  ([ayuda](https://resend.com/docs/knowledge-base/how-can-i-add-mfa.md)).
- **Webhooks firmados** con Svix
  ([documentación](https://resend.com/docs/webhooks/verify-webhooks-requests.md)).
  No verificado cómo comprobar la firma en un Worker sin su librería.
- **Cifrado:** AES-256 en reposo y TLS 1.3 en tránsito; se puede exigir TLS en la
  entrega de cada dominio ([seguridad](https://resend.com/security)).
- **Datos:** «Stored data is held in the United States», con cláusulas
  contractuales tipo y Data Privacy Framework. Entre sus subencargados figuran AWS,
  Cloudflare, Supabase y Vercel ([lista](https://resend.com/legal/subprocessors)).

## Incidentes

- **Brevo, 10 de septiembre de 2026:** una falla en su SSO con SAML dio acceso a
  138 cuentas; seis se usaron para mandar phishing
  ([informe](https://status.brevo.com/incidents/01M266V1CZKJQNGZRNEGFD5CQE/write-up)).
- **Brevo, 14 de septiembre de 2026:** una clave de Cloudflare con permisos totales,
  guardada en su código fuente, permitió inyectar un script malicioso durante unas
  cinco horas y media en sus sitios y en scripts que sus clientes incrustan. Según
  Brevo, la API y el envío no se vieron afectados
  ([informe](https://status.brevo.com/incidents/01M2QBC4EZ24ZACW6SWQYVW8N3/write-up);
  análisis independiente de [Sansec](https://sansec.io/research/brevo-supply-chain-attack)).
- **Resend, enero de 2024:** una clave de su base de datos quedó expuesta en el
  panel. Afectó a todas las cuentas: se accedió a metadatos (remitentes,
  destinatarios, asuntos, fechas), no al cuerpo de los correos ni a los adjuntos
  ([informe](https://resend.com/blog/incident-report-for-january-10-2024)). Desde
  entonces no se encontraron otras brechas.

Los dos incidentes de Brevo de 2026 son fallas de manejo de credenciales a cuatro
días de distancia. El de Resend es más viejo y fue contenido y declarado.

## Recomendación

**Resend** para este caso.

- **Seguridad:** tiene una clave que sólo envía y se limita al dominio, webhooks
  firmados, revocación automática si una clave se publica y retención corta.
- **Alta:** sin aprobación y con DNS automático en Cloudflare.
- **Mantenimiento:** la clave no vence por falta de uso.

Lo que hay que aceptar:

- los datos quedan en Estados Unidos;
- el cupo es de 100 por día sin cola: un aviso a muchas personas se escalona;
- la brecha de 2024.

**Brevo** conviene si lo que pesa es que los datos queden en la Unión Europea o el
cupo más alto. A cambio:

- el alta requiere aprobación y un ticket;
- la clave se desactiva sin uso;
- los webhooks no tienen firma;
- la retención viene indefinida;
- tuvo dos incidentes recientes.

Como referencia paga, **Cloudflare Email Service** (beta) no suma un encargado
nuevo: requiere Workers Paid, US$5 por mes con 3.000 correos incluidos, y
configura solo SPF, DKIM y DMARC
([precios](https://developers.cloudflare.com/email-service/platform/pricing/)). No
se revisó su seguridad para este documento.

## Antes de dar de alta

- Volver a leer cupos y precios del proveedor elegido.
- Verificar lo marcado «no verificado» que afecte la decisión. En Brevo: la marca
  en los transaccionales y el bloqueo de IPs con Workers. En Resend: las IPs
  permitidas.
- Activar 2FA con app, no SMS.
- Crear una clave de alcance mínimo, guardarla como secreto del Worker por entorno
  y anotar la fecha de rotación.
- Registrar el proveedor en [encargados](HOMESUITE_ENCARGADOS.md), con su DPA, y
  preparar la versión nueva de la política de privacidad.
