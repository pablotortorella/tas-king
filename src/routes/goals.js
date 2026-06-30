import { membership } from "../db/helpers.js";
import { getDoneColumnId } from "../db/columns.js";

const uid = () => crypto.randomUUID();
const now = () => Date.now();

const MAX_GOALS = 30;

// Devuelve los objetivos del tablero con su progreso calculado.
// Progreso = tarjetas vinculadas (no archivadas) que están en la columna
// marcada como "done" sobre el total de tarjetas vinculadas (no archivadas).
export async function goalsWithProgress(db, boardId) {
  const doneColumnId = await getDoneColumnId(db, boardId);

  const goals = await db
    .prepare("SELECT id, title, description, position FROM goals WHERE board_id = ? ORDER BY position, title")
    .bind(boardId)
    .all();

  const progress = await db
    .prepare(
      `SELECT cg.goal_id AS goal_id,
              COUNT(*) AS total,
              SUM(CASE WHEN c.column_id = ? THEN 1 ELSE 0 END) AS done
       FROM card_goals cg
       JOIN goals g ON g.id = cg.goal_id
       JOIN cards c ON c.id = cg.card_id
       WHERE g.board_id = ? AND c.archived = 0
       GROUP BY cg.goal_id`
    )
    .bind(doneColumnId, boardId)
    .all();

  const byGoal = new Map();
  for (const r of progress.results || []) {
    byGoal.set(r.goal_id, { total: r.total || 0, done: r.done || 0 });
  }

  return (goals.results || []).map(g => {
    const p = byGoal.get(g.id) || { total: 0, done: 0 };
    return {
      id: g.id,
      title: g.title,
      description: g.description || "",
      position: g.position,
      total: p.total,
      done: p.done,
      pct: p.total > 0 ? Math.round((p.done / p.total) * 100) : 0,
    };
  });
}

export function setupGoalRoutes(app) {
  // GET /api/boards/:boardId/goals — lista objetivos del tablero con progreso
  app.get("/api/boards/:boardId/goals", async c => {
    const email = c.get("email");
    const boardId = c.req.param("boardId");

    if (!(await membership(c.env.DB, boardId, email))) {
      return c.json({ error: "Sin acceso a este tablero." }, 403);
    }

    return c.json(await goalsWithProgress(c.env.DB, boardId));
  });

  // POST /api/boards/:boardId/goals — crear objetivo
  app.post("/api/boards/:boardId/goals", async c => {
    const email = c.get("email");
    const boardId = c.req.param("boardId");

    if (!(await membership(c.env.DB, boardId, email))) {
      return c.json({ error: "Sin acceso a este tablero." }, 403);
    }

    const { title, description } = await c.req.json().catch(() => ({}));
    const name = (title || "").trim();

    if (!name) {
      return c.json({ error: "Falta el título del objetivo." }, 400);
    }

    const count = await c.env.DB
      .prepare("SELECT COUNT(*) AS cnt FROM goals WHERE board_id = ?")
      .bind(boardId)
      .first();

    if (count.cnt >= MAX_GOALS) {
      return c.json({ error: `Máximo ${MAX_GOALS} objetivos por tablero.` }, 400);
    }

    const maxPos = await c.env.DB
      .prepare("SELECT MAX(position) AS maxPos FROM goals WHERE board_id = ?")
      .bind(boardId)
      .first();

    const id = uid();
    const position = (maxPos.maxPos ?? -1) + 1;
    const desc = (description || "").trim();

    await c.env.DB
      .prepare(
        `INSERT INTO goals (id, board_id, title, description, position, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(id, boardId, name, desc, position, now())
      .run();

    return c.json({ id, title: name, description: desc, position, total: 0, done: 0, pct: 0 });
  });

  // PUT /api/boards/:boardId/goals/:goalId — editar objetivo
  app.put("/api/boards/:boardId/goals/:goalId", async c => {
    const email = c.get("email");
    const boardId = c.req.param("boardId");
    const goalId = c.req.param("goalId");

    if (!(await membership(c.env.DB, boardId, email))) {
      return c.json({ error: "Sin acceso a este tablero." }, 403);
    }

    const goal = await c.env.DB
      .prepare("SELECT board_id FROM goals WHERE id = ?")
      .bind(goalId)
      .first();

    if (!goal || goal.board_id !== boardId) {
      return c.json({ error: "El objetivo no existe." }, 404);
    }

    const { title, description } = await c.req.json().catch(() => ({}));
    const updates = [];
    const values = [];

    if (title !== undefined) {
      const name = (title || "").trim();
      if (!name) return c.json({ error: "El título no puede quedar vacío." }, 400);
      updates.push("title = ?");
      values.push(name);
    }
    if (description !== undefined) {
      updates.push("description = ?");
      values.push((description || "").trim());
    }

    if (updates.length === 0) {
      return c.json({ error: "No hay cambios." }, 400);
    }

    values.push(goalId);

    await c.env.DB
      .prepare(`UPDATE goals SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    const goals = await goalsWithProgress(c.env.DB, boardId);
    return c.json(goals.find(g => g.id === goalId) || { id: goalId });
  });

  // DELETE /api/boards/:boardId/goals/:goalId — eliminar objetivo (cascade a card_goals)
  app.delete("/api/boards/:boardId/goals/:goalId", async c => {
    const email = c.get("email");
    const boardId = c.req.param("boardId");
    const goalId = c.req.param("goalId");

    if (!(await membership(c.env.DB, boardId, email))) {
      return c.json({ error: "Sin acceso a este tablero." }, 403);
    }

    const goal = await c.env.DB
      .prepare("SELECT board_id FROM goals WHERE id = ?")
      .bind(goalId)
      .first();

    if (!goal || goal.board_id !== boardId) {
      return c.json({ error: "El objetivo no existe." }, 404);
    }

    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM card_goals WHERE goal_id = ?").bind(goalId),
      c.env.DB.prepare("DELETE FROM goals WHERE id = ?").bind(goalId),
    ]);

    return c.json({ deleted: 1 });
  });

  // POST /api/cards/:cardId/goals/:goalId — vincular tarjeta a objetivo
  app.post("/api/cards/:cardId/goals/:goalId", async c => {
    const email = c.get("email");
    const cardId = c.req.param("cardId");
    const goalId = c.req.param("goalId");

    const card = await c.env.DB
      .prepare(
        `SELECT c.id, c.board_id FROM cards c
         INNER JOIN board_members bm ON bm.board_id = c.board_id
         WHERE c.id = ? AND bm.email = ?`
      )
      .bind(cardId, email)
      .first();

    if (!card) {
      return c.json({ error: "No existe la tarjeta o sin acceso." }, 404);
    }

    const goal = await c.env.DB
      .prepare("SELECT id FROM goals WHERE id = ? AND board_id = ?")
      .bind(goalId, card.board_id)
      .first();

    if (!goal) {
      return c.json({ error: "El objetivo no existe." }, 404);
    }

    const existing = await c.env.DB
      .prepare("SELECT 1 FROM card_goals WHERE card_id = ? AND goal_id = ?")
      .bind(cardId, goalId)
      .first();

    if (existing) {
      return c.json({ error: "La tarjeta ya está vinculada a este objetivo." }, 400);
    }

    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO card_goals (card_id, goal_id) VALUES (?, ?)").bind(cardId, goalId),
      c.env.DB.prepare("UPDATE cards SET updated_at = ? WHERE id = ?").bind(now(), cardId),
    ]);

    return c.json({ assigned: 1 });
  });

  // DELETE /api/cards/:cardId/goals/:goalId — desvincular tarjeta de objetivo
  app.delete("/api/cards/:cardId/goals/:goalId", async c => {
    const email = c.get("email");
    const cardId = c.req.param("cardId");
    const goalId = c.req.param("goalId");

    const card = await c.env.DB
      .prepare(
        `SELECT c.id FROM cards c
         INNER JOIN board_members bm ON bm.board_id = c.board_id
         WHERE c.id = ? AND bm.email = ?`
      )
      .bind(cardId, email)
      .first();

    if (!card) {
      return c.json({ error: "No existe la tarjeta o sin acceso." }, 404);
    }

    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM card_goals WHERE card_id = ? AND goal_id = ?").bind(cardId, goalId),
      c.env.DB.prepare("UPDATE cards SET updated_at = ? WHERE id = ?").bind(now(), cardId),
    ]);

    return c.json({ deleted: 1 });
  });
}
