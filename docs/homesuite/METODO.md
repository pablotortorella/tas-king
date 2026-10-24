# Método de trabajo de HomeSuite

Parte de la [base común](README.md). Aplica a humanos y agentes.

## Antes de cambiar

Leer la base común, la ficha del producto, el estado fechado y las instrucciones
aplicables. Inspeccionar rama, diff, worktrees y código antes de asumir que una
capacidad falta o está terminada. Preservar trabajo ajeno y archivos no versionados.
No ejecutar instalaciones, resets ni toda la suite como ritual para una lectura o
un cambio documental: elegir comprobaciones que aporten evidencia al cambio.

Para funcionalidades nuevas: explorar → proponer → implementar → verificar →
archivar. La exploración acuerda problema, personas, recorrido, alcance,
invariantes, exclusiones y preguntas abiertas con Pablo, de una decisión por vez.
No inventar decisiones para completar artefactos. Una petición explícita que ya
resuelve una decisión se registra sin volver a pedirla.

OpenSpec es el soporte actual: `/opsx:explore`, `/opsx:propose`, `/opsx:apply`,
`/opsx:archive`. Si el cliente no expone comandos, seguir las mismas etapas con
archivos. `openspec/specs/` contiene contratos vigentes; `changes/` sólo trabajo
activo; `changes/archive/` historia; el backlog conserva ideas. No escribir specs
retroactivas de todo el sistema. Un fix acotado o documentación no necesita una
propuesta de feature, pero sí problema, alcance y validación claros.

## Unidad de trabajo y colaboración

Una rama por cambio lógico, también para documentación. `main` es integración;
no desarrollar ni confirmar cambios directamente allí. Con tareas concurrentes,
un worktree propio por tarea; anunciar rama, carpeta y zonas afectadas. Crear
worktrees dentro de una ruta autorizada. No mover cambios sin commit suponiendo
que crear otro worktree los copia: verificar dónde quedó cada archivo.

Actualizar referencias antes de elegir la base. Si no hay red, identificar la
referencia local usada y su límite. El checkout principal se actualiza con
`git pull --ff-only origin main` sólo si no pone en riesgo trabajo local.

Los worktrees no aíslan puertos, procesos, staging ni recursos remotos. Acordar
quién usa cada uno; serializar suites que reutilizan el mismo servidor o asignar
puertos y estado independientes. No detener procesos ajenos sin identificar su dueño.

## Implementar un corte completo

Entregar recorridos pequeños y utilizables, incluidos permisos, errores y estados
vacíos. Cuando cambia una regla, revisar API, UI, imports, exports, sincronización,
auditoría, backups y documentación aplicables. Buscar rutas equivalentes; el reporte
original no delimita necesariamente todos los lugares con el mismo defecto.

Mantener frontend, backend y migraciones compatibles durante la transición. Un
cambio lógico puede requerir varios commits o despliegues compatibles; no forzar
un despliegue indivisible si el esquema necesita una transición gradual.

Cada decisión transversal vive en la base o un ADR; las particularidades van en
la ficha o especificación del producto. Registrar la decisión junto al cambio,
con alternativas y consecuencias cuando sean relevantes.

## Revisión e integración

Agregar archivos por ruta, revisar `git diff --cached` y evitar `git add .`.
Commits pequeños, con mensajes que expliquen el cambio. El PR presenta problema,
resultado, validación y límites; incluye excepciones y migraciones si aplica.

Actualizar la rama contra la base de integración y resolver conflictos antes de
integrar. Repetir los checks cuyo resultado pudo cambiar; un rebase limpio no
prueba compatibilidad semántica. Ejecutar las suites de los productos afectados
antes de integrar; si toca plataforma o contratos comunes, verificar consumidores.
Una falla sin explicar impide afirmar que el cambio está listo. Distinguir fallo
del producto, del test y del entorno con evidencia; no ocultarlo con reintentos.

## Definición de terminado

- Criterios de aceptación satisfechos y casos negativos relevantes cubiertos.
- Diff revisado; contratos, permisos, datos y performance conservados o cambiados explícitamente.
- Checks pertinentes aprobados, con comandos y resultado; pruebas reales afectadas registradas.
- Especificaciones, decisiones y estado actualizados sin duplicar políticas.
- Deuda y límites pendientes identificados, con responsable o instancia de seguimiento.
- Si se publica: versión integrada identificada, validación del mismo SHA y protocolo de operación cumplido.

Distinguir implementado en rama, integrado, desplegado y aceptado. Documentación
sola se valida por enlaces, coherencia y diff; no requiere desplegar la aplicación.
Actualizar el handoff cuando se solicita o existe una entrega explícita de trabajo,
sin duplicar el historial de STATUS. Archivar OpenSpec cuando se verificó el cambio,
no sólo porque se generaron los archivos.
