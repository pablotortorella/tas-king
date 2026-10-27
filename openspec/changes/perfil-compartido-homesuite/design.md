## Context

Propuesta técnica, sin código implementado. Los comportamientos aprobados viven
en la exploración y los deltas. Los límites técnicos de abajo son propuestas de
implementación, no decisiones de producto atribuidas retrospectivamente a Pablo.

Revisión local: `main` `df25195`; integración funcional `973ce4a` (referencia remota
local, no una consulta al servicio desplegado). Ambas ramas tienen `users` con
`google_sub`, email y `display_name`; OAuth descarta `picture` y actualiza el
nombre en cada login. La base funcional agrega seis migraciones hasta
`0006_group_slugs`, CSRF en `src/csrf.js`, libros, participantes vinculados y eventos.
El nombre de participante se persiste en `ledger_participants.display_name`.
No se importa ni integra esa rama como parte de este cambio documental.

## Goals / Non-Goals

Datos y gestión comunes; contratos independientes de UI; incorporación inicial
de Cuentas Claras; compatibilidad con sesiones y datos existentes. Quedan fuera
UI, diseño visual, despliegue, migración de TasKing y operaciones financieras nuevas.

## Decisions

### D1. Módulos de plataforma, mismo Worker

Separar `profiles` (reglas/persistencia), `presentations` (resolución autorizada y
lectura colectiva) y rutas de transporte. Nombres de archivos orientativos.
Los módulos de producto consumen las funciones de plataforma; no dependen de sus
vistas ni repiten SQL de resolución. No crear paquetes públicos, framework de
componentes ni servicios remotos para este corte.

### D2. Perfil global separado de identidad

Nueva tabla `user_profiles`, `user_id` PK/FK a `users`. Datos propuestos:

| Campo | Contrato |
|---|---|
| `name_source` | `google` o `custom` |
| `google_display_name` | Último nombre válido recibido, nullable |
| `custom_display_name` | Nombre propio; requerido en modo custom |
| `google_picture_url` | Referencia opcional validada, sin copia de imagen |
| `avatar_mode` | `google`, `emoji` o `initial`; independiente del nombre |
| `avatar_emoji` | Secuencia emoji opcional, requerida al elegir modo emoji |
| `avatar_color` | Token de paleta compartida, nunca CSS libre |
| `revision` | Entero creciente, edición condicional |
| `created_at`, `updated_at` | Operación y diagnóstico |

Identidad, email y `sub` permanecen en `users`. `users.display_name` se mantiene
como proyección de compatibilidad del nombre resuelto; no es segunda autoridad.
Mutaciones actualizan perfil y proyección en una misma transacción. Nuevas lecturas
usan la resolución común, no el campo legacy. No guardar apodos en el perfil.

Para altas nuevas: nombre automático si Google lo entrega, alternativa estable
«Usuario» si falta; modo Google como preferencia inicial, incluso si no viene foto.
La alternativa de inicial no modifica el modo. Color por defecto determinista por
ID interno, no por email, con token de paleta común.

### D3. Apodo en la membresía

Agregar `nickname` nullable, `presentation_revision` y `membership_generation`
a `memberships`. Vacío se normaliza a NULL; nunca se inicializa desde el nombre.
Creación de grupo, aceptación y cualquier futuro reingreso crean generación
nueva y apodo vacío. No cambiar generación por editar rol o apodo.

El control de edición incluye generación y revisión: una petición retenida antes
de salir no puede escribir al reingresar aunque la revisión vuelva a su valor inicial.
Para compatibilidad con INSERT del Worker anterior, nickname empieza NULL y
revisión en cero. Generación puede ser NULL durante la ventana de transición:
el Worker nuevo la materializa una sola vez con actualización condicional antes
de emitir/aceptar tokens de edición. La gestión nunca acepta generación NULL.
Cubrir dos accesos concurrentes y una alta realizada por código anterior.

Al perder membresía deja de exponerse el apodo. Si un futuro ciclo de vida usa
baja lógica en vez de borrar filas, deberá limpiar el apodo y renovar generación
al reactivar. No implementar ahora un flujo nuevo de salida/expulsión.

### D4. Resolver presentación sin mezclar contabilidad

Representación mínima de persona: `{ userId, displayName, avatar }`. Dentro de un
grupo agrega `nickname: string | null`, siempre separado y secundario.
`avatar` incluye modo elegido, tipo efectivo, URL cuando corresponde, emoji,
color y alternativa de inicial según el caso; no expone preferencias privadas
ni datos Google innecesarios. Un fallo de carga se resuelve con la alternativa
sin persistir un cambio de modo.

Sólo una ruta de gestión propia entrega fuente del nombre, revisiones y catálogo
para editar. No incluir email, `sub`, token, cookie ni nombre original de Google
en presentaciones ajenas. No crear un directorio global por ID.

Nombre/avatar/apodo actuales pueden mostrarse en actividad antigua por ID de autor.
Si el autor ya no es miembro, el lector autorizado al recurso histórico recibe su
perfil global sin apodo. Esto no autoriza consultar otros perfiles arbitrarios.
Los nombres de participantes, snapshots y exportaciones financieras conservan
sus contratos. No sustituir `ledger_participants.display_name` al editar perfil;
si una vista necesita persona vinculada, entregar `personPresentation` separada.

### D5. Gestión y contratos de transporte

Contratos propuestos, con sesión real y autorización vigente en servidor:

| Ruta | Resultado / mutación |
|---|---|
| `GET /api/me/profile` | Perfil propio editable, revisión, presentación y catálogo válido |
| `PATCH /api/me/profile` | Cambios explícitos de nombre/avatar/color con `expectedRevision` |
| `GET /api/groups/:groupId/me/presentation` | Presentación propia, apodo, generación y revisión |
| `PATCH /api/groups/:groupId/me/presentation` | Sólo apodo propio con generación y revisión esperadas |

No aceptar `userId`, email, `sub`, rol ni URL de foto suministrada por el usuario
en las escrituras. Sesión identifica al actor; la ruta de grupo sólo identifica
el contexto. `PATCH` conserva campos omitidos y rechaza campos desconocidos.
Nombre Google se selecciona mediante `nameSource: google`; no mediante vaciar
accidentalmente un input. En modo custom se requiere nombre no vacío.

Mantener `GET /api/me` compatible, calculando su `displayName` desde plataforma.
Inyectar presentaciones en lecturas autorizadas ya existentes de integrantes y
actividad mediante función colectiva. No crear un endpoint por persona en cada
producto. Acceso a grupo por ID o slug pasa por el resolver vigente.

Mutaciones requieren JSON, tamaño acotado, protección CSRF y origen según el
mecanismo de la base funcional. No rebajar ese mecanismo para que funcione en main
antiguo; integrar sobre una base que lo incluya. Asegurar un modo local explícito
con las mismas reglas de dominio y sin bypass accesible remotamente.

### D6. Validación y conflictos

Límites técnicos propuestos: JSON hasta 8 KiB; nombre normalizado NFC, trim y
espacios internos colapsados, 1–120 puntos de código; apodo 0–60 puntos de código,
vacío/espacios → NULL. Rechazar tipos incorrectos, control characters y markup
no escapado en salida; guardar texto, no HTML. No truncar silenciosamente.

Emoji: una secuencia emoji completa de un único grafema, con tope de 32 puntos
de código, validada en servidor; cubrir combinaciones ZWJ, modificadores,
banderas y keycaps y rechazar texto arbitrario. Implementación debe demostrar
validación con fixtures; no cortar por unidades UTF-16 como TasKing.

Paleta: tokens estables y valores RGB publicados por el módulo común; arrancar
con los nueve colores de avatar existentes en TasKing como datos, sin importar
su módulo DOM. Catálogo y resolver se prueban juntos. La futura UI consume tokens.

Cada escritura usa compare-and-swap; conflicto → 409 `profile_conflict` o
`presentation_conflict`, sin escribir parcialmente ni registrar éxito. Falta de
sesión → 401; CSRF fallido → 403; grupo inaccesible/no encontrado → 404 sin
filtrar existencia; validación → 400. La respuesta exitosa devuelve estado
confirmado y revisión, evitando una lectura global adicional.

### D7. Login y foto remota

Conservar `picture` únicamente desde identidad criptográficamente validada. URL
HTTPS acotada, sin credenciales, con hosts explícitos verificados para Google;
una URL inválida no bloquea identidad válida: se trata como foto no disponible.
No aceptar URLs arbitrarias desde PATCH, no hacer fetch servidor ni crear proxy.
Al implementar, obtener el conjunto de hosts permitido de documentación/proveedor
verificados y un login de staging, y dejarlo configurable/testeado sin comodines generales.

Actualizar datos automáticos en cada login. Ausencia de foto en el nuevo token
produce alternativa de inicial para ese login/perfil; no cambia el modo ni borra
emoji/color. Ausencia de nombre conserva el último nombre Google válido o usa
«Usuario». No sustituir elecciones custom, incluso con logins concurrentes.
La URL actual puede actualizarse mientras se usa emoji, pero no se expone a otros
si no es necesaria para su presentación. Auditar sin URLs, nombres ni tokens.

Las vistas actuales no necesitan mostrar fotos en este corte. Antes de una futura
UI con imágenes, verificar `img-src` para los hosts permitidos y alternativa de
error sin ampliar `script-src` ni introducir handlers inline. Documentar que la
carga directa del navegador consulta al proveedor; no prometer privacidad de proxy.

### D8. Atomicidad, auditoría y costo

Escritura de perfil/proyección y auditoría mínima como unidad atómica. Auditoría
sólo de actor, entidad, campos cambiados y revisión; no snapshots de nombres,
apodos ni URL de foto. Apodo usa evento de grupo sin registrar su contenido.
Un conflicto o fallo revierte cambios y evento; no emitir evento incondicional
tras UPDATE con cero filas. Nombre global no produce avisos a todos sus grupos.

Google actualiza columnas de proveedor y proyección resolviendo la preferencia
vigente en la transacción: no guardar un perfil completo leído antes del canje.
Si cambian datos visibles incrementa revisión; si no cambia nada, no incrementarla
ni crear evento de edición manual. Preservar independencia de revisión del libro.

Lectura de presentaciones: consultas colectivas por usuarios autorizados, sin una
consulta por fila. Costo acotado por colección, no N+1. Las respuestas de gestión
propia son `private, no-store`; no cachear membresía entre peticiones. Refresco
entre pestañas no es objetivo: cada lectura posterior observa estado confirmado.

## Migration Plan

1. Revalidar base funcional, migraciones y consumidores. Elegir el siguiente número
   de migración libre, no asumir que main y la integración tienen igual esquema.
2. Migración aditiva de tabla perfil y columnas de membresía; crear perfil junto a
   usuario en rutas reales/locales. Para usuarios previos, conservar `display_name`
   como valor custom por cautela al no existir procedencia demostrable. No afirmar
   que eligieron personalizarlo: es una salvaguarda de migración. Volver a Google
   es explícito; backfill de foto desconocida NULL. Toda membresía empieza sin apodo.
3. Si el Worker anterior crea usuarios entre migración y deploy, materializar de
   forma idempotente el perfil faltante al acceder desde el Worker nuevo; no sólo
   backfill puntual. Probar nueva alta en esa ventana.
4. Integrar resolver y gestión, OAuth y consumidores sin reescribir datos financieros.
   Compatibilidad de `users.display_name` se mantiene dentro de la transacción.
5. Ensayar actualización con datos y rollback de Worker: mantener tabla/columnas
   aditivas. El Worker viejo puede sobrescribir la proyección legacy; los datos
   autoritativos de perfil permanecen y el Worker nuevo debe reconciliarla al volver.
6. Ejecutar suites de plataforma y Cuentas Claras afectadas; staging sólo cuando
   se implemente y se prepare evidencia. Este change documental no despliega nada.

## Risks / Trade-offs

- Tabla separada requiere joins, pero separa fuente, preferencias e identidad.
- Foto externa falla o cambia; alternativa obligatoria, sin copia permanente.
- Representación actual de historia puede cambiar; IDs y snapshots financieros
  se conservan. Presentación no debe alterar su contenido ni saldos.
- Base funcional en evolución: no implementar sobre el main antiguo sin adaptar
  CSRF, participantes y migraciones. No tratar esta propuesta como merge de esa base.
- Foto/emoji se guardan para selección posterior; no se publican datos innecesarios.

## Open Questions

No quedan preguntas de producto bloqueantes del alcance conversado. La revisión
técnica debe confirmar límites, catálogo/validación Unicode y hosts antes de apply.
La UI, borrado de cuenta y futura migración de TasKing tienen exploración propia;
no se resuelven por inferencia dentro de este change.
