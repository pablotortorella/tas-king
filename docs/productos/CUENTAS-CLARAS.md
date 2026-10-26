# Cuentas Claras: particularidades de producto

Hereda la [base común](../homesuite/README.md) y usa la [plataforma](PLATAFORMA.md).
Su especificación funcional vive en el [MVP](../HOMESUITE_CUENTAS_CLARAS_MVP.md),
[exploración](../HOMESUITE_CUENTAS_CLARAS_EXPLORACION.md),
[journey](../HOMESUITE_CUENTAS_CLARAS_JOURNEY.md) y
[story map](../HOMESUITE_CUENTAS_CLARAS_STORY_MAP.md). Ver STATUS para distinguir
propuesta, implementación en rama, integración y despliegue.

La landing pública se abre desde la portada de HomeSuite; en staging enlaza a
`/cuentas-claras` de la app. Allí se inicia sesión con Google o se ve el aviso
«Muy pronto». La edición del perfil global usa la [capacidad común de la
plataforma](../HOMESUITE_PROFILE_API.md), accesible desde el avatar/nombre y el
menú general; el apodo sigue siendo contextual a cada espacio.

## Invariantes y riesgos propios

Los contratos funcionales gobiernan signos, precisión y redondeo de importes,
repartos y saldos por moneda. No sumar monedas diferentes ni usar coma flotante
binaria para persistir importes exactos. Participante contable e identidad con
acceso son conceptos diferentes: no dar permisos por aparecer en un reparto.

Gastos, ingresos y transferencias conservan historia auditable. Correcciones y
anulaciones siguen el contrato de inmutabilidad del libro; no reescribir historia
sin una decisión funcional explícita. Persistir una operación y sus efectos como
unidad atómica; reintentos e importación necesitan idempotencia comprobable.

Unir dos personas del grupo (decisión de Pablo, 2026-10-26: la persona destinataria
se elige en el momento de confirmar y todos los movimientos pasan a ella) no
reescribe la historia: cada movimiento recibe una revisión nueva marcada como unión,
la persona unida se conserva como registro y el saldo total del grupo no cambia. El
reparto por método de un movimiento afectado se reabre con importes exactos. Una
transferencia entre las dos personas se anula (quedaría de una persona a sí misma).
Cambio: `openspec/changes/personas-del-grupo`.

Verificar conservación de saldos por moneda, reparto exacto, signos, límites,
redondeo, reversión/corrección, duplicados, concurrencia y aislamiento entre espacios.
La importación necesita previsualización, decisiones explícitas, conciliación y
trazabilidad de filas rechazadas; un resultado parcial no debe parecer importación
completa. La exportación permite reconstruir la historia según su formato declarado.

Estas exigencias provienen de la naturaleza financiera del producto; no son
excepciones que relajen la base común. Las condiciones de recuperación y ciclo de
vida pendientes impiden afirmar preparación productiva sólo porque el demo funcione.
Los escenarios concretos se detallan en las specs; no duplicarlos aquí.

## Fuentes visuales

[Diseño](../diseno/cuentas-claras/README.md) y `visual/` son artefactos de diseño.
Su versión y estado por pantalla no acreditan implementación ni aceptación. Al
aplicar diseño preservar contratos POST, CSRF, rutas, permisos y estados; verificar
los cambios de estructura con las suites de plataforma y producto de la rama.
