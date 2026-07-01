# ADR-014 — Estándares de interacción por teclado

**Fecha**: 2026-07-01  
**Estado**: ✅ Aceptado e implementado  
**Autores**: Pablo Tortorella + Claude Sonnet 4.6

---

## Contexto

A medida que la UI crece (etiquetas, objetivos, columnas, checklists, comentarios, paneles laterales), cada feature nueva puede implementar comportamientos de teclado distintos si no hay una norma explícita. Esto ya generó inconsistencias detectadas en revisión.

---

## Decisión

Se adoptan los siguientes criterios **obligatorios** para toda la UI de FUN TasKing!:

### 1. `Enter` en campos de texto de una línea → confirmar/crear

Aplica a: nombre de etiqueta, nombre de objetivo, nombre de columna, campo de comentario, campo de invitación de miembro, renombrar tablero. En general: cualquier `<input type="text">` que sea parte de un formulario "crear X" o "confirmar X".

```js
input.addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); doCreate(); }
});
```

### 2. `Ctrl+Enter` (o `Cmd+Enter`) en áreas de texto multilinea → guardar

Aplica a: campo "Detalles" del modal de tarjeta (`<textarea>`), y cualquier textarea de edición larga que forme parte de un formulario con botón "Guardar".

**Razón**: `Enter` en un textarea inserta salto de línea (comportamiento esperado por el usuario). El atajo de "guardar" debe ser un gesto explícito que no interfiera con la escritura.

```js
textarea.addEventListener("keydown", e => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault(); save();
  }
});
```

### 3. `Enter` en campos de renombrado → confirmar con blur

Aplica a: renombrar columna, renombrar checklist, renombrar ítem de checklist. Basta con disparar `.blur()`, que activa el handler `focusout` existente donde se guarda el valor.

```js
input.addEventListener("keydown", e => {
  if (e.key === "Enter") input.blur();
});
```

### 4. `Escape` cierra paneles y overlays en orden de prioridad

La cadena de cierre sigue la lógica "lo más bloqueante primero":

| Prioridad | Elemento | Acción |
|-----------|----------|--------|
| 1 | Modal de tarjeta (overlay principal) | `closeModal()` |
| 2 | Overlay de perfil | `.classList.remove("open")` |
| 3 | Overlay de importación | `closeImportPreview()` |
| 4 | Overlay de configuración (settings) | `.classList.remove("open")` |
| 5 | Overlay de archivo | `.classList.remove("open")` |
| 6 | Panel lateral de Objetivos (drawer) | `closeGoalsDrawer()` |
| 7 | Panel lateral de Métricas (drawer) | `closeMetricsDrawer()` |

Si ninguno está abierto, ESC no hace nada (salvo cerrar el modal de ayuda F1 si está abierto).

**Implementado en**: el handler `document.addEventListener("keydown", ...)` en `public/index.html`.

---

## Alternativas consideradas

- **No documentar**: riesgo de inconsistencia creciente. Ya ocurrió: al agregar el panel de Objetivos y el de Métricas, el ESC no los cerraba. Se corrigió en sesión 2026-07-01.
- **`Cmd+S` como atajo universal de guardar**: más potente, pero choca con "Guardar página" del browser en algunos contextos. Descartado.
- **`Enter` en textarea también guarda**: cambia el comportamiento natural (insertar salto de línea). Confuso para usuarios de otras apps. Descartado.
- **`Escape` cierra siempre el más reciente (LIFO)**: requiere mantener un stack de apertura. Complejidad innecesaria para el volumen actual de la app. La cadena fija por prioridad es suficiente.

---

## Cómo aplicar en features nuevas

Cuando se agrega un nuevo formulario inline, campo o panel:

1. Si tiene `<input type="text">` para crear/confirmar → agregar handler de `Enter`
2. Si tiene `<textarea>` para editar contenido largo → agregar handler de `Ctrl+Enter`
3. Si tiene `<input>` para renombrar → agregar handler de `Enter` → `blur()`
4. Si es un panel/drawer que se abre → agregarlo a la cadena de `Escape` en el orden correspondiente
5. Referenciar este ADR en el PR como checklist cumplido

---

## Estado de implementación

| Elemento | Enter | Ctrl+Enter | ESC |
|----------|-------|------------|-----|
| Comentario (`#fCommentInput`) | ✅ | — | ✅ (vía close modal) |
| Etiqueta en tarjeta (`#newLabelName`) | ✅ | — | — |
| Etiqueta en settings (`#boardLabelName`) | ✅ | — | — |
| Objetivo (`#newGoalInline`) | ✅ | — | — |
| Columna nueva (input inline) | ✅ | — | ✅ (cancela) |
| Renombrar columna | ✅ (blur) | — | — |
| Detalles tarjeta (`fDetails`) | — | ✅ | — |
| Título tarjeta (`fTitle`) | ✅ (save) | — | — |
| Panel Objetivos | — | — | ✅ |
| Panel Métricas | — | — | ✅ |
| Invitar miembro (`#inviteEmail`) | ✅ | — | ✅ (vía settings) |
| Renombrar tablero (`#renameInput`) | ✅ | — | — |
