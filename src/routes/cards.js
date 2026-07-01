// ---------- Routes: Cards ----------

import { membership, logEvent } from "../db/helpers.js";
import { getColumnName } from "../db/columns.js";
import {
  getBoard, getCardRow, cardJSONById, nextPosition, cardWithAccess,
  replaceCommentsStmts, commentToJSON, auditRowToJSON
} from "../db/queries.js";

const uid = () => crypto.randomUUID();
const now = () => Date.now();

export function setupCardRoutes(app) {
  app.get("/api/boards/:boardId/version", async c => {
    const email = c.get("email");
    const boardId = c.req.param("boardId");
    if (!(await membership(c.env.DB, boardId, email))) return c.json({ error: "Sin acceso a este tablero." }, 403);
    const row = await c.env.DB.prepare(
      "SELECT MAX(updated_at) AS v FROM cards WHERE board_id = ?"
    ).bind(boardId).first();
    return c.json({ version: row ? (row.v || 0) : 0 });
  });

  app.get("/api/boards/:boardId/cards", async c => {
    const email = c.get("email");
    const boardId = c.req.param("boardId");
    if (!(await membership(c.env.DB, boardId, email))) return c.json({ error: "Sin acceso a este tablero." }, 403);
    return c.json(await getBoard(c.env.DB, boardId));
  });

  app.post("/api/boards/:boardId/cards", async c => {
    const email = c.get("email");
    const boardId = c.req.param("boardId");
    if (!(await membership(c.env.DB, boardId, email))) return c.json({ error: "Sin acceso a este tablero." }, 403);
    const b = await c.req.json().catch(() => ({}));
    if (!b.title || !b.column) return c.json({ error: "Faltan title y column." }, 400);
    const id = uid();
    const t = now();
    const pos = await nextPosition(c.env.DB, boardId, b.column);
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO cards (id, board_id, title, column_id, details, due, assignee_email, archived, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
      ).bind(id, boardId, String(b.title).trim(), b.column, b.details || "", b.due || "", b.assignee || null, pos, t, t),
    ]);
    const columnName = await getColumnName(c.env.DB, boardId, b.column);
    await logEvent(c.env.DB, boardId, id, "card_created", email, { column: b.column, columnName });
    return c.json(await cardJSONById(c.env.DB, id));
  });

  app.get("/api/cards/:id", async c => {
    const { card, error } = await cardWithAccess(c);
    if (error) return error;
    const json = await cardJSONById(c.env.DB, card.id);
    return c.json({ ...json, boardId: card.board_id });
  });

  app.put("/api/cards/:id", async c => {
    const { card, error } = await cardWithAccess(c);
    if (error) return error;
    const b = await c.req.json().catch(() => ({}));
    const column = b.column || card.column_id;
    const position = column !== card.column_id ? await nextPosition(c.env.DB, card.board_id, column) : card.position;
    const stmts = [
      c.env.DB.prepare(
        `UPDATE cards SET title = ?, column_id = ?, details = ?, due = ?, assignee_email = ?, position = ?, updated_at = ? WHERE id = ?`
      ).bind(
        b.title != null ? String(b.title).trim() : card.title,
        column,
        b.details != null ? b.details : card.details,
        b.due != null ? b.due : card.due,
        b.assignee !== undefined ? (b.assignee || null) : card.assignee_email,
        position,
        now(),
        card.id
      ),
    ];
    await c.env.DB.batch(stmts);

    const changes = {};
    if (b.title != null && String(b.title).trim() !== card.title) changes.title = { from: card.title, to: String(b.title).trim() };
    if (column !== card.column_id) {
      const [fromName, toName] = await Promise.all([
        getColumnName(c.env.DB, card.board_id, card.column_id),
        getColumnName(c.env.DB, card.board_id, column),
      ]);
      changes.column = { from: card.column_id, to: column, fromName, toName };
    }
    if (b.details != null && b.details !== card.details) changes.details = true;
    if (b.due != null && b.due !== card.due) changes.due = { from: card.due || null, to: b.due || null };
    if (b.assignee !== undefined && (b.assignee || null) !== card.assignee_email) {
      changes.assignee = { from: card.assignee_email || null, to: b.assignee || null };
    }
    if (Object.keys(changes).length > 0) {
      const action = changes.column && Object.keys(changes).length === 1 ? "card_moved" : "card_edited";
      await logEvent(c.env.DB, card.board_id, card.id, action, c.get("email"), changes);
    }

    return c.json(await cardJSONById(c.env.DB, card.id));
  });

  app.delete("/api/cards/:id", async c => {
    const { card, error } = await cardWithAccess(c);
    if (error) return error;
    const files = await c.env.DB.prepare("SELECT stored_name FROM attachments WHERE card_id = ?").bind(card.id).all();
    await logEvent(c.env.DB, card.board_id, card.id, "card_deleted", c.get("email"), { title: card.title });
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM comments WHERE card_id = ?").bind(card.id),
      c.env.DB.prepare("DELETE FROM attachments WHERE card_id = ?").bind(card.id),
      c.env.DB.prepare("DELETE FROM cards WHERE id = ?").bind(card.id),
    ]);
    await Promise.all(files.results.map(f => c.env.BUCKET.delete(f.stored_name)));
    return c.json({ deleted: 1 });
  });

  app.post("/api/cards/:id/archive", async c => {
    const { card, error } = await cardWithAccess(c);
    if (error) return error;
    await c.env.DB.prepare("UPDATE cards SET archived = 1, archived_at = ?, updated_at = ? WHERE id = ?")
      .bind(now(), now(), card.id).run();
    await logEvent(c.env.DB, card.board_id, card.id, "card_archived", c.get("email"), {});
    return c.json(await cardJSONById(c.env.DB, card.id));
  });

  app.post("/api/cards/:id/restore", async c => {
    const { card, error } = await cardWithAccess(c);
    if (error) return error;
    await c.env.DB.prepare("UPDATE cards SET archived = 0, archived_at = NULL, updated_at = ? WHERE id = ?")
      .bind(now(), card.id).run();
    await logEvent(c.env.DB, card.board_id, card.id, "card_restored", c.get("email"), {});
    return c.json(await cardJSONById(c.env.DB, card.id));
  });

  app.post("/api/boards/:boardId/reorder", async c => {
    const email = c.get("email");
    const boardId = c.req.param("boardId");
    if (!(await membership(c.env.DB, boardId, email))) return c.json({ error: "Sin acceso a este tablero." }, 403);
    const body = await c.req.json().catch(() => []);
    const items = Array.isArray(body) ? body : (body && body.items) || [];
    if (!items.length) return c.json({ updated: 0 });

    // Detectar cambios de columna para auditoría (sin IN spread: evita límite de variables en D1)
    const current = await c.env.DB.prepare(
      `SELECT id, column_id FROM cards WHERE board_id = ?`
    ).bind(boardId).all();
    const colMap = new Map(current.results.map(r => [r.id, r.column_id]));

    // Batch en bloques de 40 (5 vars × 40 = 200 por batch, dentro del límite de D1 local)
    const upd = c.env.DB.prepare("UPDATE cards SET column_id = ?, position = ?, updated_at = ? WHERE id = ? AND board_id = ?");
    const CHUNK = 40;
    for (let i = 0; i < items.length; i += CHUNK) {
      await c.env.DB.batch(items.slice(i, i + CHUNK).map((it, j) =>
        upd.bind(it.column, it.position != null ? it.position : i + j, now(), it.id, boardId)));
    }

    // Loguear sólo las tarjetas que cambiaron de columna
    const colNameCache = new Map();
    const cachedColName = async (colId) => {
      if (!colNameCache.has(colId)) colNameCache.set(colId, await getColumnName(c.env.DB, boardId, colId));
      return colNameCache.get(colId);
    };
    for (const it of items) {
      const prev = colMap.get(it.id);
      if (prev && prev !== it.column) {
        const [fromName, toName] = await Promise.all([cachedColName(prev), cachedColName(it.column)]);
        await logEvent(c.env.DB, boardId, it.id, "card_moved", email, { column: { from: prev, to: it.column, fromName, toName } });
      }
    }

    return c.json({ updated: items.length });
  });

  // ---------- Comments ----------
  app.post("/api/cards/:id/comments", async c => {
    const { card, error } = await cardWithAccess(c);
    if (error) return error;
    const b = await c.req.json().catch(() => ({}));
    const text = (b.text || "").trim();
    if (!text) return c.json({ error: "El comentario está vacío." }, 400);
    const id = uid();
    await c.env.DB.prepare("INSERT INTO comments (id, card_id, text, author_email, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(id, card.id, text, c.get("email"), now()).run();
    await logEvent(c.env.DB, card.board_id, card.id, "comment_added", c.get("email"), {});
    const row = await c.env.DB.prepare(`
      SELECT cm.id, cm.text, cm.created_at, cm.author_email,
        u.name AS author_name, u.avatar_emoji AS author_emoji, u.avatar_color AS author_color
      FROM comments cm LEFT JOIN users u ON u.email = cm.author_email WHERE cm.id = ?
    `).bind(id).first();
    return c.json(commentToJSON(row));
  });

  app.delete("/api/comments/:id", async c => {
    const cm = await c.env.DB.prepare("SELECT * FROM comments WHERE id = ?").bind(c.req.param("id")).first();
    if (!cm) return c.json({ error: "No existe el comentario." }, 404);
    const card = await getCardRow(c.env.DB, cm.card_id);
    if (card && !(await membership(c.env.DB, card.board_id, c.get("email")))) {
      return c.json({ error: "Sin acceso a este comentario." }, 403);
    }
    await c.env.DB.prepare("DELETE FROM comments WHERE id = ?").bind(cm.id).run();
    return c.json({ deleted: 1 });
  });

  // ---------- Card History ----------
  app.get("/api/cards/:id/history", async c => {
    const { card, error } = await cardWithAccess(c);
    if (error) return error;
    const rows = await c.env.DB.prepare(
      `SELECT al.id, al.card_id, al.action, al.email, al.ts, al.details,
         NULL AS card_title, u.name AS author_name, u.avatar_emoji, u.avatar_color
       FROM audit_log al LEFT JOIN users u ON u.email = al.email
       WHERE al.card_id = ? ORDER BY al.ts DESC LIMIT 100`
    ).bind(card.id).all();
    let history = rows.results.map(auditRowToJSON);

    // Si no hay historial, crear un evento sintético de creación
    if (!history.length) {
      const board = await c.env.DB.prepare("SELECT owner_email FROM boards WHERE id = ?").bind(card.board_id).first();
      const owner = board && await c.env.DB.prepare("SELECT name, avatar_emoji, avatar_color FROM users WHERE email = ?").bind(board.owner_email).first();

      history = [{
        id: "synthetic_" + card.id,
        cardId: card.id,
        action: "card_created",
        email: board?.owner_email || "desconocido",
        ts: card.created_at,
        details: { column: card.column_id },
        author: {
          name: (owner?.name || board?.owner_email?.split("@")[0]) || "Sistema",
          avatarEmoji: owner?.avatar_emoji || null,
          avatarColor: owner?.avatar_color || null
        },
      }];
    }

    return c.json({ history });
  });

  // ---------- Import ----------
  app.post("/api/boards/:boardId/import", async c => {
    const email = c.get("email");
    const boardId = c.req.param("boardId");
    if (!(await membership(c.env.DB, boardId, email))) return c.json({ error: "Sin acceso a este tablero." }, 403);
    const data = await c.req.json().catch(() => ({}));
    if (!Array.isArray(data.cards)) return c.json({ error: "Formato inválido: falta cards[]." }, 400);

    const maxRows = await c.env.DB.prepare("SELECT column_id, MAX(position) AS m FROM cards WHERE board_id = ? GROUP BY column_id")
      .bind(boardId).all();
    const posByCol = {};
    for (const r of maxRows.results) posByCol[r.column_id] = r.m || 0;

    const insCard = c.env.DB.prepare(
      `INSERT INTO cards (id, board_id, title, column_id, details, due, archived, archived_at, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const stmts = [];
    for (const card of data.cards) {
      const id = uid();
      const t = card.created || now();
      const col = card.column || "por_conversar";
      posByCol[col] = (posByCol[col] || 0) + 1;
      stmts.push(insCard.bind(
        id, boardId, (card.title || "").trim(), col, card.details || "", card.due || "",
        card.archived ? 1 : 0, card.archived ? (card.archivedAt || now()) : null, posByCol[col], t, t
      ));
      stmts.push(...replaceCommentsStmts(c.env.DB, id, card.comments));
    }
    if (stmts.length) await c.env.DB.batch(stmts);
    return c.json(await getBoard(c.env.DB, boardId));
  });
}
