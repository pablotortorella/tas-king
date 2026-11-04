# HomeSuite: ciclo de vida de datos

**Estado:** contrato previo a datos financieros reales

**Fecha:** 2026-10-20

## Principios

- Staging contiene datos sintéticos o introducidos expresamente para pruebas.
- Producción y el registro de movimientos reales permanecen bloqueados hasta
  completar las condiciones de esta página.
- Los importes se almacenan como enteros en unidad menor y con moneda explícita.
- La historia financiera y su auditoría no se purgan por antigüedad.
- Una eliminación destructiva ofrece la exportación antes de confirmar (no es obligatoria) y exige una acción explícita; el grupo eliminado queda recuperable y exportable por su titular durante 30 días.

## Clases y retención

| Clase | Ejemplos | Retención y eliminación |
|---|---|---|
| OAuth temporal | `state`, nonce, PKCE verifier | Sólo cookie firmada durante el flujo; vence a los 10 minutos y no se persiste en D1. |
| Sesión | cookie e identificador aleatorio en D1 | Vigente hasta 14 días. El cron elimina sesiones vencidas o revocadas hace más de 30 días. |
| Identidad | Google `sub`, email verificado, nombre | Mientras exista la cuenta o sea necesaria para una membresía o auditoría. No se usa el email como identidad estable. |
| Colaboración | grupos, membresías e invitaciones | Mientras exista el grupo. Una invitación pendiente vence a los 30 días; se conserva como `expired` para auditoría. |
| Finanzas | libros, participantes, movimientos y componentes | Mientras exista el grupo. No hay purga temporal automática ni borrado físico de participantes con historia. |
| Historial | revisiones y eventos | Inmutable y retenido junto al libro para explicar cada cambio. |
| Idempotencia | claves, hash y respuesta confirmada | Se conserva mientras pueda repetirse la operación correspondiente; no se purga hasta fijar la ventana de reintentos de la API. |
| Aceptaciones | `legal_acceptances`: identificador opaco de la persona, documento (`terms` o `privacy`), versión, fecha y método (`login` o `gate`); sin dirección IP ni agente de usuario | Prueba de la autorización (Ley 1581, arts. 9 y 12). Se conserva aun después de una baja de cuenta, porque solo contiene un identificador opaco, una versión y una fecha, y puede hacer falta para demostrar la autorización durante el plazo de prescripción. Viaja en las copias de seguridad como cualquier tabla. Ver [politica-y-aceptacion](../openspec/changes/politica-y-aceptacion/design.md), D2. |
| Solicitudes de datos | planilla privada fuera del repositorio: identificador `SOL-AAAA-nnn`, tipo, fechas de recibo, de la leyenda «reclamo en trámite» y de respuesta, y resultado en una línea; sin el contenido del reclamo | Prueba de que se cumplieron los plazos de los arts. 14 y 15. No está en D1 ni en las copias de seguridad. Se conserva mientras pueda hacer falta demostrar el cumplimiento; el plazo de conservación lo decide Pablo con la revisión profesional. Ver [solicitudes de datos](HOMESUITE_SOLICITUDES_DATOS.md). |
| Operación | request ID y logs estructurados | Según la retención configurada en Workers Observability. Nunca incluye cookies, tokens, email ni cuerpos. |
| Backup | bookmark, SQL y manifiesto | Staging: artefacto local previo a cada migración. Producción: copia en R2 privado con expiración a los 90 días, restore drill de la base vacía y primera ejecución automatizada acreditados (2026-10-27). Falta observar la primera ejecución programada y alertas. |

## Exportación y eliminación

El export de infraestructura actual produce un SQL completo para recuperación,
pero no sustituye una exportación de producto entendible por una persona. Antes
de aceptar datos financieros reales deben existir:

1. exportación de un grupo con miembros, movimientos, componentes, moneda,
   revisiones y eventos en un formato documentado;
2. eliminación administrada del grupo completo, con confirmación reforzada y
   autorización exclusiva de quien corresponda;
3. exportación ofrecida antes de la eliminación (no obligatoria; decisión de Pablo, 2026-11-02) y comprobación de que no quedan filas
   financieras huérfanas;
4. una política para solicitudes de eliminación de cuenta cuando la identidad
   siga siendo necesaria en libros compartidos o auditoría.

Referencia normativa (Ley 1581 de 2012, Decreto 1074 de 2015; no es
asesoramiento legal): [HOMESUITE_NORMATIVA_DATOS.md](HOMESUITE_NORMATIVA_DATOS.md).
Las reglas viven en los specs de OpenSpec, no allí.

Hasta entonces no se implementa borrado directo de filas financieras. Anular o
editar un movimiento crea una revisión nueva; no reescribe el pasado.

## Bloqueos de producción

No abrir producción a usuarios ni registrar finanzas reales hasta comprobar:

- backup externo independiente de D1 y de la máquina del operador;
- retención de backups y restore drill del ambiente productivo;
- exportación y eliminación administrada del producto;
- rotación de credenciales que hayan quedado expuestas durante la preparación;
- recursos, OAuth, secretos, dominio y D1 exclusivos de producción;
- monitoreo, alertas y revisión de logs sin datos sensibles;
- recorrido manual con dos cuentas reales y pruebas de autorización completas.

La aprobación para staging no implica aprobación para producción.

Pablo autorizó expresamente el 2026-10-27 preparar recursos productivos vacíos
antes de completar estos controles. Se crearon D1, R2 y un Worker sin rutas ni
tráfico; esta excepción puntual no habilita uso real ni elimina los bloqueos
restantes. Ver [STATUS](STATUS.md) y [recuperación](HOMESUITE_RECOVERY.md).
