# HomeSuite: encargados del tratamiento y transmisión internacional

**Estado:** registro propuesto (change `politica-y-aceptacion`, tareas 6.1 y 7), con campos **pendientes de Pablo** marcados abajo. No es asesoramiento legal.

**Fecha:** 2026-11-04

Quién trata datos personales por cuenta de HomeSuite, en qué país, con qué contrato, y qué falta documentar. La [política de privacidad](../apps/site/public/privacidad.html) nombra a los mismos proveedores (sección «Con quién se comparten»); este documento es la constancia interna. Referencia normativa: [HOMESUITE_NORMATIVA_DATOS.md](HOMESUITE_NORMATIVA_DATOS.md), sección 3. Decisión de diseño: change [politica-y-aceptacion](../openspec/changes/politica-y-aceptacion/design.md), D8 y D10.

## Proveedores

Responsable del tratamiento: Pablo Tortorella (persona natural, Rionegro, Colombia).

| Proveedor | Papel | Qué hace con los datos | País | Datos tratados |
|---|---|---|---|---|
| Cloudflare | **Encargado** (transmisión internacional) | Aloja la aplicación y el sitio (Workers), la base de datos (D1), los adjuntos de Fun TasKing (R2 privado `homesuite-tasking-uploads`) y las copias de seguridad (R2). Desde el 2026-11-10 también guarda, congelada, la copia original de Fun TasKing (D1 `tas-king` y R2 `tas-king-uploads`) | Estados Unidos y otros países donde opera su red; la ubicación de D1 y R2 **no está verificada** (el parámetro de ubicación de D1 es una indicación, no una garantía) | Todos los de la aplicación: cuentas, perfiles, sesiones, grupos, movimientos, copias de seguridad |
| GitHub | **Encargado** (transmisión internacional) | Ejecuta la copia de seguridad diaria en un servidor temporal (GitHub Actions) | Estados Unidos y otros países | La base completa, sin cifrar, durante unos minutos de cada ejecución (ver «Respaldo en GitHub») |
| Google | **Proveedor de identidad**, no encargado | Autentica a la persona que inicia sesión y entrega identificador, correo verificado, nombre y foto; sirve la foto al navegador | Estados Unidos y otros países | Los que Google ya tiene de la persona; a HomeSuite le llegan los de inicio de sesión (`openid`, `email`, `profile`) |

## Base de la transmisión

El Decreto 1074 de 2015, art. 2.2.2.25.5.2, permite la transmisión a un encargado sin informar ni pedir consentimiento adicional si hay un **contrato de transmisión** que (a) señale los alcances y actividades del encargado, (b) lo obligue a tratar los datos conforme a los principios y la política del responsable y (c) lo obligue a cuidar su seguridad y confidencialidad. Además, la Ley 1581, art. 26, prohíbe transferir a países sin nivel adecuado; Estados Unidos figura entre los adecuados en la lista de la SIC (Circular Única, Título V; versión del 29-09-2022).

**Lectura propuesta (interpretación, sin validar con una persona abogada):** los contratos de tratamiento de datos (DPA) estándar de Cloudflare y GitHub cubren seguridad, confidencialidad, subencargados, avisos de brechas y borrado o devolución al terminar, pero ninguno se compromete expresamente a aplicar la política del responsable ni la Ley 1581. La solución de bajo costo es dejar **constancia escrita, con fecha y versión, de que Pablo aceptó cada DPA** y de que se invoca por analogía el art. 2.2.2.25.5.2; opcionalmente, agregar las cláusulas modelo de la Red Iberoamericana de Protección de Datos (RIPD; facultativas, Circular Externa 003 de 2025), tarea 6.3.

## Constancia de aceptación de los DPA (la completa Pablo)

| Proveedor | DPA y versión | Enlace | Lista de subencargados | Aceptado por Pablo el | Copia guardada |
|---|---|---|---|---|---|
| Cloudflare | Customer DPA, v6.4 (2026-04-03) según la investigación | <https://www.cloudflare.com/cloudflare-customer-dpa/> | <https://www.cloudflare.com/gdpr/subprocessors/cloudflare-services/> (actualizada el 2025-10-01 según la investigación) | **PENDIENTE: fecha** | **PENDIENTE** |
| GitHub | Data Protection Agreement, versión de octubre de 2025 según la investigación | <https://github.com/customer-terms/github-data-protection-agreement> | la que publica GitHub en esa misma página | **PENDIENTE: fecha** | **PENDIENTE** |
| Google | no aplica: no actúa por cuenta de HomeSuite | [Política de datos de usuario de las API de Google](https://developers.google.com/terms/api-services-user-data-policy) | no aplica | no aplica | no aplica |

Los enlaces y las versiones salen de la investigación del 2026-11-02 (resúmenes automáticos de las páginas oficiales); **hay que releerlos en un navegador** antes de citarlos en un texto publicado.

## Tareas de Pablo

- [ ] Leer y aceptar el DPA de Cloudflare desde la cuenta de Cloudflare; anotar fecha y versión arriba y, si el proveedor lo permite, guardar una copia.
- [ ] Leer y aceptar el DPA de GitHub desde la cuenta de GitHub; anotar fecha y versión y guardar una copia.
- [ ] Preguntar a cada proveedor si su DPA aplica al plan gratuito (ver «No verificado»).
- [ ] Decidir con una persona abogada si hace falta agregar las cláusulas modelo de la RIPD o una declaración propia que obligue a los encargados a aplicar la política del responsable (tarea 6.3); anotar la conclusión acá.
- [ ] Revisar en Google Cloud el estado de la pantalla de consentimiento (en pruebas o publicada), que incide en el texto del aviso de acceso (pregunta abierta 9 del design).

## Respaldo en GitHub

El respaldo diario corre en un servidor temporal de GitHub Actions (`.github/workflows/homesuite-production-backup.yml`).

**Verificación de las medidas técnicas (tarea 7.1, hecha el 2026-11-04 sobre el código del repositorio; no sobre una corrida real):**

- El flujo de trabajo **no usa** `actions/upload-artifact` ni guarda caché de datos: su único `cache` es el de paquetes de npm (`actions/setup-node` con `cache: npm`), que no contiene datos de la base.
- **No imprime contenido de la base.** La salida de `wrangler d1 export` se redirige a un archivo temporal que se borra y, si falla, solo se informa el código de error. `wrangler d1 time-travel info --json` se escribe a un archivo. `restore-drill` y la verificación descartan su salida estándar. Lo único que llega al registro del flujo son líneas fijas («Exportando…», «Restauración local e integridad correctas.») y el prefijo del respaldo en R2 (una marca de tiempo).
- **El directorio temporal se destruye**: `homesuite-app-backup.sh`, `homesuite-app-restore-drill.sh` y `homesuite-app-verify-backup.sh` crean su directorio con `mktemp -d` y lo borran con `trap … EXIT`; el flujo borra además su archivo de registro con `trap`. El servidor de GitHub Actions es efímero y se descarta al terminar el trabajo.
- Hay un límite no verificado: Wrangler guarda sus propios archivos de registro en el servidor durante la ejecución, y un mensaje de error de SQLite podría citar un fragmento de la consulta. Es un caso de error, sin artefactos, y el servidor se descarta; no se probó con una corrida real.

**Qué ve GitHub:** el servidor temporal tiene la base **descifrada** durante unos minutos (exportación, restauración local de prueba y subida a R2). GitHub también ve el token de la API de Cloudflare que usa el flujo (guardado como secreto del repositorio). No queda ninguna copia en GitHub después de la ejecución.

**Decisión de Pablo (2026-11-02): el respaldo no se cifra antes de que salga del servidor temporal, por ahora** (tarea 7.2; no se implementa el cifrado).

- Motivo: cifrar con una clave pública (por ejemplo `age`, con la clave privada solo en poder de Pablo) haría que GitHub y R2 vieran solo datos cifrados, pero `db:verify-backup` ya no podría restaurar ni probar la integridad automáticamente (solo comprobar suma y tamaño), y la recuperación dependería de custodiar la clave privada.
- Mitigación vigente: la verificación de arriba (sin artefactos ni salida de datos) y la política, que informa que la copia pasa por un servidor temporal de GitHub.
- **Se revisa esta decisión si:** el respaldo sale de Cloudflare (otro destino de almacenamiento), cambia el servidor o el modelo de ejecución del respaldo, o una revisión profesional o un cambio de la norma lo exige.

## No verificado

- Si el DPA de Cloudflare aplica a una cuenta de plan gratuito, y si el de GitHub aplica a una cuenta personal gratuita (los textos no lo aclaran).
- Dónde se almacenan y procesan realmente D1 y R2 (la ubicación de D1 es una indicación, no una garantía; por eso la política no promete un país).
- Si hay una versión de la lista de países con nivel adecuado de la SIC posterior a la de 2022.
- Que los enlaces y las versiones de los DPA citados sean los vigentes.
- Registro Nacional de Bases de Datos: una persona natural no está obligada (Decreto 1074, art. 2.2.2.26.1.2, modificado por el Decreto 090 de 2018); se revisa si HomeSuite se constituye como sociedad o entidad sin ánimo de lucro.
- Normas de otras jurisdicciones (RGPD, Ley 25.326 de Argentina): hoy no hay indicio de que apliquen; se revisan si cambia el público.
