## 1. Contratos y esquema aditivo

- [ ] 1.1 Incorporar la aclaración de permisos por tablero en ADR-018, la ficha de TasKing y el glosario, enlazando este change; verificar coherencia con las specs de Tareas y el delta de protección operativa, incluidos sus límites por ruta, y enlaces internos.
- [ ] 1.2 Crear migración nueva de tablas `tasking_*`, relaciones, índices y triggers equivalentes a las migraciones heredadas; verificar instalación limpia y actualización sobre HomeSuite con datos financieros, sin modificar esos datos.
- [ ] 1.3 Crear identidades pendientes/vinculadas, restricciones de vínculo único y de un personal por titular; verificar que duplicados de identidad, vínculo y personal sean rechazados por la base.
- [ ] 1.4 Crear control de lote/activación para impedir uso normal de un traslado incompleto; verificar que API y aprovisionamiento permanecen cerrados mientras falta conciliación.

## 2. Identidad y autorización por tablero

- [ ] 2.1 Adaptar resolución de identidad a sesión HomeSuite y vinculación inicial segura, persistiendo después `user_id`; verificar cuentas anteriores/posteriores al traslado, cambio posterior de email, cuenta equivocada, suplantación y conflicto. Conservar datos internos validados de autoridad Google y bloquear reclamaciones automáticas por correos externos o correspondencias ambiguas sin comprobación adicional.
- [ ] 2.2 Adaptar el personal para recuperar antes de crear y persistir tablero/membresía/columnas atómicamente; verificar accesos concurrentes, reintentos, personal heredado y rechazo de eliminación.
- [ ] 2.3 Adaptar titulares, integrantes e incorporación directa por email sin crear usuarios OAuth ficticios; verificar invitación antes del alta HomeSuite, roles, reintentos y recuperación al entrar con Google.
- [ ] 2.4 Aplicar autorización vigente a todos los recursos y rutas relacionadas de Tareas; verificar accesos cruzados, operaciones masivas e importación y que los grupos compartidos no conceden permisos de tablero.
- [ ] 2.5 Cubrir revocación de membresía con sesión activa, incluidas descargas y exportaciones; verificar rechazo en la petición siguiente sin cerrar ni alterar el acceso a otros productos.
- [ ] 2.6 Automatizar la conciliación de cuentas/roles y la recuperación de tableros con la cuenta Google habitual; verificar que el recorrido normal no requiere alta previa de HomeSuite, aviso personal, preparación o aprobación individual de Pablitux. Una ambigüedad real debe fallar sin conceder datos y ofrecer contacto como incidencia excepcional, sin construir transferencias entre cuentas ni un sistema adicional de reclamación.

## 3. Backend y seguridad de integración

- [ ] 3.1 Componer el módulo bajo `/api/tareas/*` sin reemplazar `/api/me`; verificar contratos de plataforma, perfil y rutas de Cuentas Claras junto con la API de Tareas.
- [ ] 3.2 Adaptar handlers de tableros, columnas y tarjetas conservando IDs, orden y validación de pertenencia; verificar las regresiones pertinentes de `test/boards.test.js` y las rutas de tarjetas en la base integrada.
- [ ] 3.3 Adaptar comentarios, etiquetas, checklists, objetivos, métricas y actividad; verificar persistencia, permisos y múltiples columnas de cierre con migraciones reales.
- [ ] 3.4 Conservar archivo/restauración e intercambio JSON/CSV aditivo; verificar casos de `test/import.test.js` y los recorridos de exportación/importación sobre API integrada.
- [ ] 3.5 Adaptar revisión persistente y consultas del tablero; verificar `test/board-sync.test.js` y presupuestos de `test/backend-performance.test.js`, separando el costo de sesión HomeSuite y justificando diferencias.
- [ ] 3.6 Aplicar sesión, origen, CSRF y rate limits compartidos a todas las mutaciones de Tareas; verificar token ausente, inválido, de otra sesión y origen externo, incluidos multipart y administración.
- [ ] 3.7 Implementar límites específicos de subida/importación sin ampliar otros endpoints y servir adjuntos protegidos en `/tareas/adjuntos/:key`; verificar archivos dentro/fuera del límite actual, peticiones sin `Content-Length`, descargas ajenas, fallos parciales y política de caché privada.
- [ ] 3.8 Adaptar roles y estadísticas administrativos propios de Tareas sin trasladar autorización global; verificar permisos de estadísticas y gestión de roles, ausencia de datos financieros y retiro de conteos ligados exclusivamente a la lista.
- [ ] 3.9 Revisar y proteger interpolaciones, URLs y contenido migrado en el origen compartido; verificar payloads XSS en campos de dominio, rechazar esquemas de URL peligrosos y servir archivos con tipo/`nosniff`/disposición seguros incluso con nombre o MIME engañoso.
- [ ] 3.10 Verificar que búsquedas, invitaciones y errores de Tareas sólo revelen las identidades necesarias del tablero, no el directorio de HomeSuite; comprobar accesos ajenos y que los respaldos SQL del bucket antiguo nunca estén disponibles como adjuntos.

## 4. Frontend conservado en HomeSuite

- [ ] 4.1 Servir documento y assets de Tareas bajo su namespace, adaptando el cliente API y el `fetch` multipart con CSRF; verificar carga real, subidas, errores, reintentos y ausencia de colisiones con assets de otros productos.
- [ ] 4.2 Conectar perfil y salida con las rutas comunes y ofrecer retorno al inicio; verificar edición del perfil HomeSuite sin sobrescritura heredada y logout efectivo desde TasKing con sesión real de test.
- [ ] 4.3 Adaptar proyecciones de autoría/asignación y preferencias propias, incluido tip; verificar presentación de personas aún sin HomeSuite, progreso persistido y valores predeterminados de preferencias sólo locales del origen antiguo.
- [ ] 4.4 Sustituir estilos incompatibles con CSP conservando composición, estados, temas y arrastre; verificar el documento y assets por HTTP real y E2E sin violaciones relevantes de CSP ni cambio global de políticas.
- [ ] 4.5 Reutilizar recorridos E2E actuales sobre TasKing integrado: teclado/foco, búsqueda/filtros, arrastre/scroll, modal con borrador, textos largos, archivo, checklists, objetivos y celebraciones; verificar escritorio, móvil, zoom y movimiento reducido, registrando motores/dispositivos no disponibles.
- [ ] 4.6 Adaptar pruebas de sincronización y mutación de tarjeta a HomeSuite; verificar dos contextos de navegador y `e2e/card-mutation-performance.spec.js`, sin respuestas viejas ni pérdida de borradores al cambiar tablero.
- [ ] 4.7 Comprobar compatibilidad con la PWA ya integrada; verificar instalación anterior al traslado, actualización, cambio de cuenta, caché caliente, logout y vuelta sin red, sin guardar Tareas privadas ni crear otro manifiesto o SW.
- [ ] 4.8 Inventariar y trasladar assets de identidad/funcionamiento y documentos públicos, incluido `public/favicon.svg` a `/tareas/favicon.v1.svg`, con opción de favicon por producto; verificar igualdad del SVG, MIME, versión, enlaces y cero referencias nuevas al bundle antiguo, sin reemplazar iconos de instalación HomeSuite.
- [ ] 4.9 Trasladar novedades e historia de términos como documentos inertes con favicon y enlaces corregidos; verificar que sus URLs antiguas encuentran una equivalencia útil y que los términos históricos se distinguen de los vigentes.

## 5. Herramientas de traslado y recuperación

- [ ] 5.1 Implementar extracción operativa versionada del esquema TasKing con manifiesto y cobertura declarada; verificar fixture completo incluyendo personas sin HomeSuite, actividad, preferencias y todas las relaciones, sin limitarse al export de tarjetas.
- [ ] 5.2 Configurar almacenamiento de adjuntos de Tareas por ambiente y copia con metadatos/checksums; verificar aislamiento de buckets, bytes idénticos, archivo faltante y reintento de copia interrumpida.
- [ ] 5.3 Implementar carga de lotes oculta e idempotente conservando identificadores; verificar mismo lote repetido, contenido distinto con la misma clave, interrupción entre lotes y ausencia de cambios en plataforma/finanzas.
- [ ] 5.4 Implementar conciliación de entidades, relaciones, roles, revisión, personales y archivos previa a activación; verificar que inconsistencias o varios personales heredados abortan con diagnóstico, sin borrar ni corregir silenciosamente datos.
- [ ] 5.5 Incorporar adjuntos de Tareas a respaldo y restauración operativos de HomeSuite; verificar restauración aislada de D1/R2 con restricciones, índices y triggers y comparación del manifiesto completo.
- [ ] 5.6 Ensayar traslado de punta a punta desde el esquema anterior con datos sintéticos representativos; verificar alta posterior de HomeSuite, reanudación y recuperación sin pérdida, registrando duración y cobertura.

## 6. Convivencia y corte controlado

- [ ] 6.1 Implementar guardia de mantenimiento en el origen sin activarla durante desarrollo; verificar que el modo normal conserva funcionamiento y autorización actuales.
- [ ] 6.2 Bloquear todas las escrituras del origen al activar mantenimiento, incluidos GET con efectos, OAuth/aprovisionamiento, archivos y tareas programadas pertinentes; verificar cobertura de rutas, pestañas antiguas y drenaje de peticiones admitidas antes del snapshot final.
- [ ] 6.3 Preparar activación del destino sólo después de conciliación y redirección segura del origen; verificar un único escritor, enlaces de tablero/tarjeta/adjuntos y que mutaciones antiguas no se reproducen como nuevas.
- [ ] 6.4 Documentar runbook con recursos explícitos, ventana medida, retención de copias, SHA, responsables, aborto y rollback antes/después de nuevas escrituras; verificarlo mediante simulación de fallo antes del corte y después de guardar en destino, sin restaurar finanzas a un estado anterior.
- [ ] 6.5 Implementar el aviso de mudanza del Worker original con el texto del diseño, firma Pablitux, invitación a contactarlo y botón **Ir a HomeSuite**, sin bundle, fallback de assets, handlers de negocio ni permisos D1/R2; verificar HTML público, ausencia de redirect externo automático/temporizador, clic único, navegación, API/métodos, iconos con MIME correcto, archivos y rutas desconocidas.
- [ ] 6.6 Preservar `?card` y retorno de descargas a través del login HomeSuite, con destinos fijos por ambiente; verificar sesión ausente, tarjeta/archivo ajeno o borrado, query codificada, fragmentos y ausencia de bucles y redirects abiertos. Los callbacks antiguos no reenvían ni registran `code/state` ni credenciales.
- [ ] 6.7 Incorporar cerrojo persistente de escrituras del origen y protección de despliegue/rollback; verificar que una versión vieja o script de publicación no puede reabrir negocio después del corte y que archivos/crons tampoco eluden el cierre.
- [ ] 6.8 Comunicar mantenimiento/mudanza desde la propia interfaz al llegar al origen, sin avisos externos ni coordinación individual de Pablo; preparar manejo de `tasking_migrated` con parada de polling/reintentos y borradores preservados antes de pulsar el botón. Verificar con borrador, envío en curso, timeout y JS antiguo, sin confirmación falsa ni navegación forzada.
- [ ] 6.9 Inventariar hosts, aliases, previews/version URLs, crons, secretos/bindings, triggers de CI y cachés del origen; entregar una matriz sin caminos de escritura alcanzables ni reparto de tráfico con la app editable. Verificar cobertura remota al preparar publicación, sin asumirla de los archivos locales.
- [ ] 6.10 Preparar invalidación/revalidación de cachés controlables y expiración de cookies propias sin borrar borradores ni datos ajenos; verificar caché caliente, volver atrás y adjunto previamente visitado, documentando que no se pueden revocar archivos ya descargados.
- [ ] 6.11 Configurar observabilidad del puente con versión/ambiente/clase de ruta y resultado, sin URLs completas ni payloads privados; verificar logs/traces reales, respuesta de continuidad si el destino falla y que no se reactive la copia antigua para recuperarlo.

## 7. Verificación integrada y aceptación

- [ ] 7.1 Ejecutar suites de TasKing y HomeSuite afectadas, integraciones D1/R2 y E2E del origen integrado con puertos/estado aislados; verificar CI de todas las unidades tocadas y registrar SHA, comandos, resultados y límites.
- [ ] 7.2 Desplegar el SHA revisado a staging coordinado, usando sólo datos del ambiente; verificar con dos cuentas Google reales recuperación de tableros, invitación, revocación, aislamiento, adjuntos y login/logout, registrando evidencia conforme a operación.
- [ ] 7.3 Preparar enlaces/catálogo de app/sitio y ampliar la comprobación de coherencia con ambos Workers; verificar en staging aviso firmado y botón desde entradas viejas, Google sin cuenta HomeSuite previa, sesión HomeSuite vigente, enlace de tarjeta, favicon, aliases/previews, pestaña antigua y PWA ya instalada, sin dos versiones operativas ni destinos de otro ambiente.
- [ ] 7.4 Presentar artefacto y runbook revisables para la aprobación de publicación de Pablo; verificar que la aprobación corresponde al SHA, recursos y ventana concretos antes de tocar producción.

## 8. Traslado definitivo y retiro

- [ ] 8.1 Con aprobación de publicación aplicable, respaldar origen/destino y archivos, bloquear/drenar origen y trasladar la copia final; verificar manifiestos y finanzas conservadas antes de habilitar destino y registrar lote/versiones.
- [ ] 8.2 Con origen cerrado y destino conciliado, activar puente al 100 % y HomeSuite como único escritor; verificar smoke real de entrada/salida, recuperación, edición, permisos, adjuntos, favicon y favoritos antiguos, además de `verify:coherence:production`. Si falla antes de nuevas escrituras, abortar de forma controlada; después, conservar los nuevos cambios y mantener el origen cerrado.
- [ ] 8.3 Tras aceptación del traslado, retirar lista global, solicitudes, controles, endpoints y configuración independiente que ya no se use; verificar que una cuenta HomeSuite sin autorización antigua usa su personal mientras roles por tablero y administrativos siguen protegidos. Mantener respaldos según el runbook, sin eliminar infraestructura o datos históricos implícitamente.
- [ ] 8.4 Actualizar ficha, operación, estado y backlog distinguiendo implementado/integrado/desplegado/aceptado y manteniendo el dock fuera de alcance; verificar enlaces y registrar límites de preferencias locales y cualquier incidencia de identidad.
- [ ] 8.5 Validar el change con `openspec validate migrar-tasking-homesuite --strict` y archivarlo sólo después de satisfacer escenarios y aceptación; verificar que no quedan tareas necesarias pendientes ni evidencia de recuperación faltante.
