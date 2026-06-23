# Instrucciones para Claude

## Al inicio de cada sesión
Leer `AI_HANDOFF.md` antes de cualquier acción. Ese archivo tiene el estado actual del
proyecto, el objetivo inmediato, decisiones tomadas y lo que no hay que hacer.

Leer `TESTING.md` antes de modificar comportamiento. Todo bug corregido debe sumar un test de
regresión y toda funcionalidad nueva debe evaluarse en la capa adecuada (unitaria, API o E2E).
Antes de dar una tarea por terminada, ejecutar los tests afectados; antes de deploy, ejecutar
`npm run test:all` y completar el checklist manual correspondiente.

## Al finalizar cada sesión
Actualizar los siguientes archivos si hubo cambios relevantes:

- **`AI_HANDOFF.md`**: sección "Último handoff" con resumen de lo que se hizo, y
  sección "Pendientes" tachando o agregando ítems según corresponda.
- **`README.md`**: si se agregaron funcionalidades, secrets, comandos o cambió el stack.
- **`docs/backlog.txt`**: si se completó o reordenó algún ítem del backlog.

Hacer commit y push de esos cambios al finalizar.
