# HomeSuite: contrato común de perfil y presentación

**Estado:** contrato implementado en `main` para la plataforma básica; publicación en staging pendiente. La integración con la actividad financiera se hará cuando ese módulo entre en `main`.

Esta capacidad pertenece a la plataforma de HomeSuite y sirve a Cuentas Claras y a los demás productos de la suite. El nombre y el avatar se guardan una vez por persona. El apodo pertenece a una membresía de espacio y comienza vacío. Las interfaces visuales de edición y presentación quedan para un cambio posterior.

## Modelo y migración

`0007_shared_profiles.sql` añade `user_profiles` y campos de presentación a `memberships`. Conserva `users.id` como identidad, `users.display_name` como proyección de compatibilidad y las tablas financieras sin alterar. Los nombres existentes se clasifican conservadoramente como personalizados: no es posible inferir si provenían de Google. Si el Worker anterior crea un usuario durante el despliegue, la primera lectura crea su perfil de forma idempotente con ese mismo criterio.

El nombre tiene fuente `google` o `custom`. Un login actualiza el nombre y la referencia de foto recibidos de Google, pero sólo cambia el nombre visible cuando la fuente es `google`. La acción explícita `nameSource: "google"` retoma el último nombre válido del proveedor; si falta, muestra «Usuario». La URL de foto sólo se acepta por HTTPS desde los hosts permitidos de Google. No se copia ni sube una imagen.

El avatar guarda el modo `google`, `emoji` o `initial`, independientemente de la fuente del nombre. En modo Google, `photoUrl` puede ser nula y `initial` es la alternativa; el cliente también debe usarla si la imagen no carga. Emoji y color se conservan aunque se vuelva a mostrar la foto. El color es un token del catálogo entregado por la API.

## Rutas autenticadas

Todas las respuestas `/api/` usan `Cache-Control: private, no-store`. Las mutaciones requieren sesión, origen confiable y `X-CSRF-Token` ligado a la sesión. En desarrollo, el modo local sólo se admite en `localhost` y `127.0.0.1`. Las rutas reciben y devuelven JSON; los cuerpos de edición se limitan a 8 KiB. Errores de validación: 400; sin sesión: 401; sin membresía: 404; revisión obsoleta: 409; cuerpo excesivo: 413; tipo de contenido distinto de JSON: 415.

| Ruta | Uso |
|---|---|
| `GET /api/me/profile` | Perfil propio, nombre Google disponible, revisión y catálogo de colores. |
| `PATCH /api/me/profile` | Edita sólo el perfil de la sesión. |
| `GET /api/spaces/:spaceId/me/presentation` | Perfil propio contextual, apodo, revisión y generación de membresía. |
| `PATCH /api/spaces/:spaceId/me/presentation` | Edita o vacía sólo el apodo de la sesión. |
| `GET /api/spaces/:spaceId/members` | Presentaciones mínimas de integrantes vigentes, para integrantes vigentes. |

`GET /api/me` conserva `id`, `email` y `displayName` y añade `profile` resuelto y `csrfToken` para mutaciones de la sesión. Es un contrato propio: el email nunca se agrega al contrato de integrantes. Las presentaciones ajenas entregan `userId`, `displayName`, `nickname`, `avatar` y `role`; no incluyen email, `sub`, nombre Google sin resolver, cookie ni sesión.

Ejemplos de cuerpos de edición:

```json
{"expectedRevision":0,"displayName":"Pablo","avatarMode":"emoji","emoji":"⚽","color":"ocean"}
```

```json
{"expectedRevision":1,"nameSource":"google","avatarMode":"google"}
```

```json
{"expectedRevision":0,"generation":"membership_...","nickname":"Papá de Celes"}
```

Un apodo compuesto sólo de espacios se transforma en `null`. El cliente debe enviar la `generation` recibida al leer la presentación: una petición anterior a salir y reingresar al espacio recibe 409 aunque la revisión vuelva a cero. El titular no puede cambiar el apodo de otra persona.

## Consumo en Cuentas Claras

El primer consumo es el acceso con Google: tras autenticarse, la persona ve «Muy pronto» y su nombre de perfil. El libro financiero sigue en ramas de integración. Cuando entre en `main`, deberá agregar presentación actual de autoría sin cambiar participantes contables, vínculos, saldos, revisiones ni snapshots. La rama funcional `feature/homesuite-profile` ya contiene esa adaptación y sus pruebas; no forma parte de este corte de staging.

## Verificación y despliegue

Las pruebas unitarias e integraciones D1 cubren validación, Google, perfil previo, CSRF, privacidad, conflictos, auditoría, apodo, reingreso y la pantalla autenticada. Falta verificar un login real y la foto en staging. Para desplegar, seguir el orden operativo de HomeSuite: respaldo D1 → migración `0007` → Worker nuevo. La migración es aditiva y el Worker anterior puede continuar escribiendo usuarios; el Worker nuevo los materializa al leerlos. Este corte no habilita datos financieros reales ni producción.
