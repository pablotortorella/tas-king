# Base común de HomeSuite

Vigente desde 2026-10-24. Aplica a plataforma, sitio público y todos los productos.

Esta es la entrada normativa de la suite. Las reglas compartidas se editan aquí;
los productos las referencian y documentan únicamente sus particularidades o
excepciones justificadas. Adoptar estos documentos no demuestra que todos los
controles estén implementados: consultar la matriz de cumplimiento más abajo.

## Documentos madre

| Documento | Responsabilidad |
|---|---|
| [Método de trabajo](METODO.md) | Exploración, cambios, colaboración, revisión y cierre |
| [Arquitectura y calidad técnica](ARQUITECTURA.md) | Fronteras, contratos, seguridad, datos, UX y performance |
| [Verificación](VERIFICACION.md) | Escenarios, regresiones y evidencia de aceptación |
| [Operación](OPERACION.md) | Entornos, publicación, migraciones, recuperación y secretos |
| [Aprendizajes](APRENDIZAJES.md) | Incidentes, causas, controles y asuntos abiertos |

## Precedencia y mantenimiento

1. Las instrucciones explícitas del usuario y las restricciones del entorno rigen
   la tarea. Una autorización excepcional no cambia automáticamente la regla futura.
2. Estos documentos fijan la política compartida. Los ADR explican decisiones y
   evolución; las especificaciones fijan comportamiento funcional.
3. Las fichas de producto añaden detalles propios. Sólo pueden apartarse de una
   regla común mediante una excepción explícita y revisada.
4. Runbooks contienen comandos; STATUS registra hechos fechados y estados de
   implementación; backlog registra pendientes; handoff facilita retomar. Ninguno
   redefine políticas ni convierte una intención en una capacidad implementada.

Ante contradicciones, comprobar código, pruebas y evidencia fechada, registrar la
resolución y corregir el documento desactualizado. Un ADR reemplazado conserva su
historia, con enlace a la decisión vigente. No reinterpretar incidentes pasados
como si hubiesen seguido las reglas actuales.

Las versiones desplegadas, cantidades de tests y ramas activas se registran en
[STATUS](../STATUS.md), no se duplican en guías de entrada. Un snapshot visual o
una especificación no certifican integración, despliegue ni aceptación.

Toda modificación de una regla común revisa sus enlaces, fichas afectadas y
controles. El PR explica el motivo y cómo se verificó. La revisión humana de
Pablo valida cambios de política; no se afirma aprobación sólo por escribirlos.

## Fichas y fuentes de producto

- [TasKing](../productos/TASKING.md): implementación existente y operación propia.
- [Plataforma y sitio público](../productos/PLATAFORMA.md): superficies y controles compartidos.
- [Cuentas Claras](../productos/CUENTAS-CLARAS.md): invariantes financieras y fuentes funcionales.
- [Compras](../productos/COMPRAS.md): alcance todavía por explorar.

No copiar estas políticas en cada producto, instrucción de agente o repositorio.
Si un producto se extrae, debe mantener un enlace estable a una revisión identificada
de la base común y registrar cuándo incorpora sus actualizaciones.

## Registro de excepciones

Cada excepción debe incluir: regla y enlace; alcance; necesidad propia del dominio;
alternativas descartadas; riesgos; mitigación; prueba verificable; responsable;
aprobación registrada y fecha o señal de revisión. Una excepción pendiente de
aprobación se marca como propuesta y no habilita omitir controles. Las brechas
heredadas son deuda identificada, no excepciones implícitamente aceptadas.

## Cumplimiento conocido al adoptar la base

Inspección inicial del código versionado en `bdd3b2e`, con la fila de CI
actualizada al 2026-10-25. No es una auditoría del servicio remoto.

| Control | Evidencia disponible | Falta / límite |
|---|---|---|
| Tests generales y de HomeSuite en CI | `.github/workflows/test.yml`: Vitest general, HomeSuite App unitaria e integración D1, sitio y Playwright | El login real con Google y recorridos entre dos cuentas requieren pruebas dirigidas en staging |
| Migración antes de Worker en TasKing | `package.json` y `test/deploy-scripts.test.js` | Sólo cubre migraciones compatibles; no demuestra restauración completa |
| Verificación antes de staging HomeSuite App | Script migra y despliega | No encadena tests; ejecutarlos y registrar resultados antes del comando |
| SHA revisado en staging, revisión y aprobación | Protocolo común | No hay un bloqueo automático que impida desplegar otro SHA |
| Detección de secretos | Revisión del diff; comprobaciones limitadas de `verify-ready` | El script no es un escáner fiable de secretos |
| Recuperación de datos | Runbook y regresión de triggers de TasKing | Sin simulacro completo acreditado; reset local de restore demasiado amplio; HomeSuite tiene preparación pendiente |
| Enlaces de documentación | Comprobación local durante este cambio | Sin control de enlaces dedicado en CI |

Estas brechas requieren seguimiento en el [backlog](../PRODUCT_BACKLOG.md).
No declarar una puerta automática de calidad hasta que exista y se haya probado.
