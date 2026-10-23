# HomeSuite: ciclo de vida de datos

**Estado:** contrato previo a datos financieros reales

**Fecha:** 2026-10-20

## Principios

- Staging contiene datos sintéticos o introducidos expresamente para pruebas.
- Producción y el registro de movimientos reales permanecen bloqueados hasta
  completar las condiciones de esta página.
- Los importes se almacenan como enteros en unidad menor y con moneda explícita.
- La historia financiera y su auditoría no se purgan por antigüedad.
- Una eliminación destructiva exige exportación previa y una acción explícita.

## Clases y retención

| Clase | Ejemplos | Retención y eliminación |
|---|---|---|
| OAuth temporal | `state`, nonce, PKCE verifier | Sólo cookie firmada durante el flujo; vence a los 10 minutos y no se persiste en D1. |
| Sesión | cookie e identificador aleatorio en D1 | Vigente hasta 14 días. El cron elimina sesiones vencidas o revocadas hace más de 30 días. |
| Identidad | Google `sub`, email verificado, nombre | Mientras exista la cuenta o sea necesaria para una membresía o auditoría. No se usa el email como identidad estable. |
| Colaboración | espacios, membresías e invitaciones | Mientras exista el espacio. Una invitación pendiente vence a los 30 días; se conserva como `expired` para auditoría. |
| Finanzas | libros, participantes, movimientos y componentes | Mientras exista el espacio. No hay purga temporal automática ni borrado físico de participantes con historia. |
| Historial | revisiones y eventos | Inmutable y retenido junto al libro para explicar cada cambio. |
| Idempotencia | claves, hash y respuesta confirmada | Se conserva mientras pueda repetirse la operación correspondiente; no se purga hasta fijar la ventana de reintentos de la API. |
| Operación | request ID y logs estructurados | Según la retención configurada en Workers Observability. Nunca incluye cookies, tokens, email ni cuerpos. |
| Backup | bookmark, SQL y manifiesto | Staging: artefacto local previo a cada migración. Producción requerirá copia externa, retención definida y restore drill propio. |

## Exportación y eliminación

El export de infraestructura actual produce un SQL completo para recuperación,
pero no sustituye una exportación de producto entendible por una persona. Antes
de aceptar datos financieros reales deben existir:

1. exportación de un espacio con miembros, movimientos, componentes, moneda,
   revisiones y eventos en un formato documentado;
2. eliminación administrada del espacio completo, con confirmación reforzada y
   autorización exclusiva de quien corresponda;
3. exportación previa a la eliminación y comprobación de que no quedan filas
   financieras huérfanas;
4. una política para solicitudes de eliminación de cuenta cuando la identidad
   siga siendo necesaria en libros compartidos o auditoría.

Hasta entonces no se implementa borrado directo de filas financieras. Anular o
editar un movimiento crea una revisión nueva; no reescribe el pasado.

## Bloqueos de producción

No crear recursos productivos ni registrar finanzas reales hasta comprobar:

- backup externo independiente de D1 y de la máquina del operador;
- retención de backups y restore drill del ambiente productivo;
- exportación y eliminación administrada del producto;
- rotación de credenciales que hayan quedado expuestas durante la preparación;
- recursos, OAuth, secretos, dominio y D1 exclusivos de producción;
- monitoreo, alertas y revisión de logs sin datos sensibles;
- recorrido manual con dos cuentas reales y pruebas de autorización completas.

La aprobación para staging no implica aprobación para producción.
