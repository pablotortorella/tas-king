import { membership } from "../db/helpers.js";

const uid = () => crypto.randomUUID();
const now = () => Date.now();

// Material Design 10-color palette (debe coincidir con LABEL_COLORS en frontend)
const VALID_COLORS = [
  "#F44336", "#2196F3", "#4CAF50", "#FFC107", "#FF9800",
  "#9C27B0", "#00BCD4", "#009688", "#E91E63", "#3F51B5",
];

export function setupLabelRoutes(app) {
  // GET /api/boards/:boardId/labels — lista todas las etiquetas del tablero
  app.get("/api/boards/:boardId/labels", async c => {
    const email = c.get("email");
    const boardId = c.req.param("boardId");

    if (!(await membership(c.env.DB, boardId, email))) {
      return c.json({ error: "Sin acceso a este tablero." }, 403);
    }

    const result = await c.env.DB
      .prepare(`
        SELECT id, name, color, position
        FROM labels
        WHERE board_id = ?
        ORDER BY position, name
      `)
      .bind(boardId)
      .all();

    return c.json(result.results || []);
  });

  // POST /api/boards/:boardId/labels — crear etiqueta
  app.post("/api/boards/:boardId/labels", async c => {
    const email = c.get("email");
    const boardId = c.req.param("boardId");

    if (!(await membership(c.env.DB, boardId, email))) {
      return c.json({ error: "Sin acceso a este tablero." }, 403);
    }

    const { name, color } = await c.req.json().catch(() => ({}));

    if (!name || !color) {
      return c.json({ error: "Falta name o color." }, 400);
    }

    if (!VALID_COLORS.includes(color)) {
      return c.json({ error: "Color no válido." }, 400);
    }

    const count = await c.env.DB
      .prepare("SELECT COUNT(*) as cnt FROM labels WHERE board_id = ?")
      .bind(boardId)
      .first();

    if (count.cnt >= 10) {
      return c.json({ error: "Máximo 10 etiquetas por tablero." }, 400);
    }

    const maxPos = await c.env.DB
      .prepare("SELECT MAX(position) as maxPos FROM labels WHERE board_id = ?")
      .bind(boardId)
      .first();

    const id = uid();
    const position = (maxPos.maxPos ?? -1) + 1;

    await c.env.DB
      .prepare(
        `INSERT INTO labels (id, board_id, name, color, position, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(id, boardId, name, color, position, now())
      .run();

    return c.json({ id, name, color, position });
  });

  // PUT /api/boards/:boardId/labels/:labelId — editar etiqueta
  app.put("/api/boards/:boardId/labels/:labelId", async c => {
    const email = c.get("email");
    const boardId = c.req.param("boardId");
    const labelId = c.req.param("labelId");

    if (!(await membership(c.env.DB, boardId, email))) {
      return c.json({ error: "Sin acceso a este tablero." }, 403);
    }

    const { name, color } = await c.req.json().catch(() => ({}));

    if (color && !VALID_COLORS.includes(color)) {
      return c.json({ error: "Color no válido." }, 400);
    }

    const label = await c.env.DB
      .prepare("SELECT board_id FROM labels WHERE id = ?")
      .bind(labelId)
      .first();

    if (!label || label.board_id !== boardId) {
      return c.json({ error: "La etiqueta no existe." }, 404);
    }

    const updates = [];
    const values = [];

    if (name) {
      updates.push("name = ?");
      values.push(name);
    }
    if (color) {
      updates.push("color = ?");
      values.push(color);
    }

    if (updates.length === 0) {
      return c.json({ error: "No hay cambios." }, 400);
    }

    values.push(labelId);

    await c.env.DB
      .prepare(`UPDATE labels SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await c.env.DB
      .prepare("SELECT id, name, color, position FROM labels WHERE id = ?")
      .bind(labelId)
      .first();

    return c.json(updated);
  });

  // DELETE /api/boards/:boardId/labels/:labelId — eliminar etiqueta
  app.delete("/api/boards/:boardId/labels/:labelId", async c => {
    const email = c.get("email");
    const boardId = c.req.param("boardId");
    const labelId = c.req.param("labelId");

    if (!(await membership(c.env.DB, boardId, email))) {
      return c.json({ error: "Sin acceso a este tablero." }, 403);
    }

    const label = await c.env.DB
      .prepare("SELECT board_id FROM labels WHERE id = ?")
      .bind(labelId)
      .first();

    if (!label || label.board_id !== boardId) {
      return c.json({ error: "La etiqueta no existe." }, 404);
    }

    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM card_labels WHERE label_id = ?").bind(labelId),
      c.env.DB.prepare("DELETE FROM labels WHERE id = ?").bind(labelId),
    ]);

    return c.json({ deleted: 1 });
  });

  // POST /api/cards/:cardId/labels/:labelId — asignar etiqueta a tarjeta
  app.post("/api/cards/:cardId/labels/:labelId", async c => {
    const email = c.get("email");
    const cardId = c.req.param("cardId");
    const labelId = c.req.param("labelId");

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

    const label = await c.env.DB
      .prepare("SELECT id FROM labels WHERE id = ? AND board_id = ?")
      .bind(labelId, card.board_id)
      .first();

    if (!label) {
      return c.json({ error: "La etiqueta no existe." }, 404);
    }

    const existing = await c.env.DB
      .prepare("SELECT 1 FROM card_labels WHERE card_id = ? AND label_id = ?")
      .bind(cardId, labelId)
      .first();

    if (existing) {
      return c.json({ error: "La etiqueta ya está asignada." }, 400);
    }

    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO card_labels (card_id, label_id) VALUES (?, ?)").bind(cardId, labelId),
      c.env.DB.prepare("UPDATE cards SET updated_at = ? WHERE id = ?").bind(now(), cardId),
    ]);

    return c.json({ assigned: 1 });
  });

  // DELETE /api/cards/:cardId/labels/:labelId — quitar etiqueta de tarjeta
  app.delete("/api/cards/:cardId/labels/:labelId", async c => {
    const email = c.get("email");
    const cardId = c.req.param("cardId");
    const labelId = c.req.param("labelId");

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

    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM card_labels WHERE card_id = ? AND label_id = ?").bind(cardId, labelId),
      c.env.DB.prepare("UPDATE cards SET updated_at = ? WHERE id = ?").bind(now(), cardId),
    ]);

    return c.json({ deleted: 1 });
  });
}
