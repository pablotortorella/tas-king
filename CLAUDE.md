# Instrucciones para Claude

## Al inicio de cada sesión

**1. Actualizar repositorio**: `git pull origin main` (por si hubo cambios externos)

**2. Leer documentación**:
   - `docs/STATUS.md`: qué está implementado, qué falta, estado de tests de cada feature
   - `AI_HANDOFF.md`: objetivo inmediato, decisiones, lo que no hay que hacer
   - `TESTING.md`: estrategia de testing (antes de modificar código)

**3. Correr tests**:
   ```bash
   npm run test:all
   ```
   Si fallan, investigar y reportar qué cambió. No continuar hasta que pasen.

**4. Confirmar feature del backlog**:
   Antes de proponer o implementar, revisar `docs/STATUS.md`:
   - Si dice "❌ No implementado" → confirma leyendo el código antes de empezar
   - Si dice "✅ Implementado, X% tests" → revisa qué tests faltan y agrega

No asumir nada del código sin leerlo. El handoff + STATUS.md son la fuente de verdad.

## Al finalizar cada sesión
Actualizar los siguientes archivos si hubo cambios relevantes:

- **`AI_HANDOFF.md`**: sección "Último handoff" con resumen de lo que se hizo, y
  sección "Pendientes" tachando o agregando ítems según corresponda.
- **`README.md`**: si se agregaron funcionalidades, secrets, comandos o cambió el stack.
- **`docs/backlog.txt`**: si se completó o reordenó algún ítem del backlog.

Hacer commit y push de esos cambios al finalizar.
