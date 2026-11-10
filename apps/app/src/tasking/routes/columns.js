// ---------- Routes: Columns ----------

import { membership, logEvent } from "../db/helpers.js";
import { columnToJSON } from "../db/columns.js";

export { createDefaultColumns, columnToJSON } from "../db/columns.js";

const uid = () => crypto.randomUUID();
const now = () => Date.now();

export const MAX_COLUMNS = 10;

export function setupColumnRoutes(app) {
  // GET /api/tareas/boards/:boardId/columns
  app.get("/api/tareas/boards/:boardId/columns", async c => {
    const identity_id = c.get("identity_id");
    const boardId = c.req.param("boardId");
    if (!(await membership(c.env.DB, boardId, identity_id))) return c.json({ error: "Sin acceso a este tablero." }, 403);
    const rows = await c.env.DB.prepare("SELECT id, name, position, is_done FROM tasking_columns WHERE board_id = ? ORDER BY position ASC").bind(boardId).all();
    return c.json(rows.results.map(columnToJSON));
  });

  // POST /api/tareas/boards/:boardId/columns — crear columna (solo owner)
  app.post("/api/tareas/boards/:boardId/columns", async c => {
    const identity_id = c.get("identity_id");
    const boardId = c.req.param("boardId");
    const m = await membership(c.env.DB, boardId, identity_id);
    if (!m) return c.json({ error: "Sin acceso a este tablero." }, 403);
    if (m.role !== "owner") return c.json({ error: "Solo el dueño puede agregar columnas." }, 403);

    const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM tasking_columns WHERE board_id = ?").bind(boardId).first();
    if (count.n >= MAX_COLUMNS) return c.json({ error: `Máximo ${MAX_COLUMNS} columnas por tablero.` }, 400);

    const { name } = await c.req.json().catch(() => ({}));
    const colName = (name || "").trim();
    if (!colName) return c.json({ error: "Falta el nombre de la columna." }, 400);
    if (colName.length > 50) return c.json({ error: "Nombre muy largo (máximo 50 caracteres)." }, 400);

    const maxPos = await c.env.DB.prepare("SELECT MAX(position) AS m FROM tasking_columns WHERE board_id = ?").bind(boardId).first();
    const position = (maxPos.m ?? 0) + 1;
    const id = uid();
    await c.env.DB.prepare("INSERT INTO tasking_columns (id, board_id, name, position, is_done, created_at) VALUES (?, ?, ?, ?, 0, ?)").bind(id, boardId, colName, position, now()).run();

    await logEvent(c.env.DB, boardId, null, "column_created", identity_id, { name: colName });
    return c.json({ id, name: colName, position, isDone: false });
  });

  // PATCH /api/tareas/boards/:boardId/columns/:columnId — renombrar o marcar como done (solo owner)
  app.patch("/api/tareas/boards/:boardId/columns/:columnId", async c => {
    const identity_id = c.get("identity_id");
    const boardId = c.req.param("boardId");
    const columnId = c.req.param("columnId");
    const m = await membership(c.env.DB, boardId, identity_id);
    if (!m) return c.json({ error: "Sin acceso a este tablero." }, 403);
    if (m.role !== "owner") return c.json({ error: "Solo el dueño puede modificar columnas." }, 403);

    const col = await c.env.DB.prepare("SELECT id, name, position, is_done FROM tasking_columns WHERE board_id = ? AND id = ?").bind(boardId, columnId).first();
    if (!col) return c.json({ error: "Columna no encontrada." }, 404);

    const { name, isDone, direction } = await c.req.json().catch(() => ({}));

    // Reordenar: intercambiar posición con la columna adyacente
    if (direction === "left" || direction === "right") {
      const all = await c.env.DB.prepare("SELECT id, position FROM tasking_columns WHERE board_id = ? ORDER BY position ASC").bind(boardId).all();
      const idx = all.results.findIndex(c => c.id === columnId);
      const swapIdx = direction === "left" ? idx - 1 : idx + 1;
      if (idx < 0 || swapIdx < 0 || swapIdx >= all.results.length)
        return c.json({ error: "No se puede mover en esa dirección." }, 400);
      const swap = all.results[swapIdx];
      await c.env.DB.batch([
        c.env.DB.prepare("UPDATE tasking_columns SET position = ? WHERE board_id = ? AND id = ?").bind(swap.position, boardId, columnId),
        c.env.DB.prepare("UPDATE tasking_columns SET position = ? WHERE board_id = ? AND id = ?").bind(col.position, boardId, swap.id),
      ]);
      await logEvent(c.env.DB, boardId, null, "column_moved", identity_id, {
        columnId, name: col.name, direction,
      });
      const updated = await c.env.DB.prepare("SELECT id, name, position, is_done FROM tasking_columns WHERE board_id = ? AND id = ?").bind(boardId, columnId).first();
      return c.json(columnToJSON(updated));
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      const newName = (name || "").trim();
      if (!newName) return c.json({ error: "El nombre no puede quedar vacío." }, 400);
      if (newName.length > 50) return c.json({ error: "Nombre muy largo (máximo 50 caracteres)." }, 400);
      updates.push("name = ?");
      values.push(newName);
    }

    if (isDone === true || isDone === false) {
      updates.push("is_done = ?");
      values.push(isDone ? 1 : 0);
    }

    if (updates.length === 0) return c.json({ error: "Sin cambios." }, 400);

    values.push(boardId, columnId);
    await c.env.DB.prepare(`UPDATE tasking_columns SET ${updates.join(", ")} WHERE board_id = ? AND id = ?`).bind(...values).run();

    if (name !== undefined) {
      const newName = (name || "").trim();
      if (newName !== col.name) {
        await logEvent(c.env.DB, boardId, null, "column_renamed", identity_id, {
          columnId, from: col.name, to: newName,
        });
      }
    }

    const updated = await c.env.DB.prepare("SELECT id, name, position, is_done FROM tasking_columns WHERE board_id = ? AND id = ?").bind(boardId, columnId).first();
    return c.json(columnToJSON(updated));
  });

  // DELETE /api/tareas/boards/:boardId/columns/:columnId — eliminar columna (solo owner, sin tarjetas activas)
  app.delete("/api/tareas/boards/:boardId/columns/:columnId", async c => {
    const identity_id = c.get("identity_id");
    const boardId = c.req.param("boardId");
    const columnId = c.req.param("columnId");
    const m = await membership(c.env.DB, boardId, identity_id);
    if (!m) return c.json({ error: "Sin acceso a este tablero." }, 403);
    if (m.role !== "owner") return c.json({ error: "Solo el dueño puede eliminar columnas." }, 403);

    const colCount = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM tasking_columns WHERE board_id = ?").bind(boardId).first();
    if (colCount.n <= 1) return c.json({ error: "No se puede eliminar la única columna del tablero." }, 400);

    const col = await c.env.DB.prepare("SELECT id, name, is_done FROM tasking_columns WHERE board_id = ? AND id = ?").bind(boardId, columnId).first();
    if (!col) return c.json({ error: "Columna no encontrada." }, 404);

    const cards = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM tasking_cards WHERE board_id = ? AND column_id = ? AND archived = 0").bind(boardId, columnId).first();
    if (cards.n > 0) return c.json({ error: "No se puede eliminar una columna con tarjetas activas. Mové o archivá las tarjetas primero." }, 400);

    await c.env.DB.prepare("DELETE FROM tasking_columns WHERE board_id = ? AND id = ?").bind(boardId, columnId).run();
    await logEvent(c.env.DB, boardId, null, "column_deleted", identity_id, { name: col.name });

    // Si era una columna de cierre y ya no quedan otras, transferir el flag a la última restante
    if (col.is_done) {
      const remaining = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM tasking_columns WHERE board_id = ? AND is_done = 1").bind(boardId).first();
      if (remaining.n === 0) {
        const last = await c.env.DB.prepare("SELECT id FROM tasking_columns WHERE board_id = ? ORDER BY position DESC LIMIT 1").bind(boardId).first();
        if (last) {
          await c.env.DB.prepare("UPDATE tasking_columns SET is_done = 1 WHERE board_id = ? AND id = ?")
            .bind(boardId, last.id).run();
        }
      }
    }

    return c.json({ deleted: 1 });
  });
}
