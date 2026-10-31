# Inicio rápido — HomeSuite y TasKing

## Lectura de entrada

1. [Base común](docs/homesuite/README.md): documentos madre y estado de controles.
2. Ficha del área: [TasKing](docs/productos/TASKING.md),
   [plataforma/sitio](docs/productos/PLATAFORMA.md),
   [Cuentas Claras](docs/productos/CUENTAS-CLARAS.md), [Compras](docs/productos/COMPRAS.md)
   o [Remanso](docs/productos/REMANSO.md).
3. [Estado fechado](docs/STATUS.md), [backlog](docs/PRODUCT_BACKLOG.md) y change OpenSpec afectado.

No se copian aquí versiones desplegadas ni cantidades de tests. El
[handoff](AI_HANDOFF.md) conserva contexto fechado; contrastarlo con STATUS y Git.

## Preparar la tarea

Inspeccionar `git status -sb`, `git diff` y `git worktree list`. Elegir una rama
propia y base identificada; preservar archivos ajenos. El [método](docs/homesuite/METODO.md)
explica aislamiento, exploración, integración y cierre.

Para un worktree nuevo con dependencias ausentes usar `npm ci` con el lockfile;
no reinstalar como paso automático en una tarea documental. `npm run check:env`
diagnostica TasKing. Comandos de desarrollo y tests en cada ficha; `npm run test:all`
verifica TasKing y no incluye las suites específicas de HomeSuite App.

OpenSpec: `openspec list`, `openspec status --change <nombre>` y
`openspec validate <nombre> --strict`. Las etapas se describen en el método común;
no crear propuestas que decidan por el usuario lo que aún falta explorar.

## Dónde consultar

| Necesidad | Fuente |
|---|---|
| Identidad, tono y copy de marca | [Identidad y visión](docs/HOMESUITE_IDENTIDAD_Y_VISION.md) |
| Reglas de colaboración | [Método](docs/homesuite/METODO.md) |
| Criterios técnicos | [Arquitectura](docs/homesuite/ARQUITECTURA.md) |
| Escenarios y aceptación | [Verificación](docs/homesuite/VERIFICACION.md) |
| Publicación y recuperación | [Operación](docs/homesuite/OPERACION.md) |
| Errores y prevención | [Aprendizajes](docs/homesuite/APRENDIZAJES.md) |
| Decisiones y alternativas | [ADRs](docs/ADRs.md) |
| Dominios y recursos | [Infraestructura](docs/HOMESUITE_INFRASTRUCTURE.md) |
