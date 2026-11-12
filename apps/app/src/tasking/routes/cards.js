// ---------- Routes: Cards ----------

import { membership, logEvent, resolveAssignee } from "../db/helpers.js";
import { findColumnName, getColumnIds, getColumnName } from "../db/columns.js";
import {
  getBoard, getCardRow, cardJSONById, nextPosition, cardWithAccess,
  replaceCommentsStmts, commentToJSON, auditRowToJSON
} from "../db/queries.js";

const uid = () => crypto.randomUUID();
const now = () => Date.now();
const COLUMN_NOT_FOUND = "La columna no existe en este tablero.";

export function setupCardRoutes(app) {
  app.get("/api/tareas/boards/:boardId/version", async c => {
    const identity_id = c.get("identity_id");
    const boardId = c.req.param("boardId");
    if (!(await membership(c.env.DB, boardId, identity_id))) return c.json({ error: "Sin acceso a este tablero." }, 403);
    const row = await c.env.DB.prepare("SELECT sync_version AS v FROM tasking_boards WHERE id = ?").bind(boardId).first();
    return c.json({ version: row ? (row.v || 0) : 0 });
  });

  app.get("/api/tareas/boards/:boardId/cards", async c => {
    const identity_id = c.get("identity_id");
    const boardId = c.req.param("boardId");
    if (!(await membership(c.env.DB, boardId, identity_id))) return c.json({ error: "Sin acceso a este tablero." }, 403);
    return c.json(await getBoard(c.env.DB, boardId));
  });

  app.post("/api/tareas/boards/:boardId/cards", async c => {
    const identity_id = c.get("identity_id");
    const boardId = c.req.param("boardId");
    if (!(await membership(c.env.DB, boardId, identity_id))) return c.json({ error: "Sin acceso a este tablero." }, 403);
    const b = await c.req.json().catch(() => ({}));
    if (!b.title || !b.column) return c.json({ error: "Faltan title y column." }, 400);
    const columnName = await findColumnName(c.env.DB, boardId, b.column);
    if (columnName === null) return c.json({ error: COLUMN_NOT_FOUND }, 400);
    const id = uid();
    const t = now();
    b.assignee = await resolveAssignee(c.env.DB, boardId, b.assignee);
    const pos = await nextPosition(c.env.DB, boardId, b.column);
    await c.env.DB.batch([
      c.env.DB.prepare(`INSERT INTO tasking_cards (id, board_id, title, column_id, details, due, assignee_identity_id, archived, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`).bind(id, boardId, String(b.title).trim(), b.column, b.details || "", b.due || "", b.assignee || null, pos, t, t),
    ]);
    await logEvent(c.env.DB, boardId, id, "card_created", identity_id, { column: b.column, columnName });
    return c.json(await cardJSONById(c.env.DB, id));
  });

  app.get("/api/tareas/cards/:id", async c => {
    const { card, error } = await cardWithAccess(c);
    if (error) return error;
    const json = await cardJSONById(c.env.DB, card.id);
    return c.json({ ...json, boardId: card.board_id });
  });

  app.put("/api/tareas/cards/:id", async c => {
    const { card, error } = await cardWithAccess(c);
    if (error) return error;
    const b = await c.req.json().catch(() => ({}));
    const column = b.column || card.column_id;
    let columnNames = null;
    if (column !== card.column_id) {
      const [fromName, toName] = await Promise.all([
        getColumnName(c.env.DB, card.board_id, card.column_id),
        findColumnName(c.env.DB, card.board_id, column),
      ]);
      if (toName === null) return c.json({ error: COLUMN_NOT_FOUND }, 400);
      columnNames = { fromName, toName };
    }
    if (b.assignee !== undefined) b.assignee = await resolveAssignee(c.env.DB, card.board_id, b.assignee);
    const position = column !== card.column_id ? await nextPosition(c.env.DB, card.board_id, column) : card.position;
    const stmts = [
      c.env.DB.prepare(`UPDATE tasking_cards SET title = ?, column_id = ?, details = ?, due = ?, assignee_identity_id = ?, position = ?, updated_at = ? WHERE id = ?`).bind(
        b.title != null ? String(b.title).trim() : card.title,
        column,
        b.details != null ? b.details : card.details,
        b.due != null ? b.due : card.due,
        b.assignee !== undefined ? (b.assignee || null) : card.assignee_identity_id,
        position,
        now(),
        card.id
      ),
    ];
    await c.env.DB.batch(stmts);

    const changes = {};
    if (b.title != null && String(b.title).trim() !== card.title) changes.title = { from: card.title, to: String(b.title).trim() };
    if (columnNames) changes.column = { from: card.column_id, to: column, ...columnNames };
    if (b.details != null && b.details !== card.details) changes.details = true;
    if (b.due != null && b.due !== card.due) changes.due = { from: card.due || null, to: b.due || null };
    if (b.assignee !== undefined && (b.assignee || null) !== card.assignee_identity_id) {
      changes.assignee = { from: card.assignee_identity_id || null, to: b.assignee || null };
    }
    if (Object.keys(changes).length > 0) {
      const action = changes.column && Object.keys(changes).length === 1 ? "card_moved" : "card_edited";
      await logEvent(c.env.DB, card.board_id, card.id, action, c.get("identity_id"), changes);
    }

    return c.json(await cardJSONById(c.env.DB, card.id));
  });

  app.delete("/api/tareas/cards/:id", async c => {
    const { card, error } = await cardWithAccess(c);
    if (error) return error;
    const files = await c.env.DB.prepare("SELECT stored_name FROM tasking_attachments WHERE card_id = ?").bind(card.id).all();
    await logEvent(c.env.DB, card.board_id, card.id, "card_deleted", c.get("identity_id"), { title: card.title });
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM tasking_comments WHERE card_id = ?").bind(card.id),
      c.env.DB.prepare("DELETE FROM tasking_attachments WHERE card_id = ?").bind(card.id),
      c.env.DB.prepare("DELETE FROM tasking_cards WHERE id = ?").bind(card.id),
    ]);
    await Promise.all(files.results.map(f => c.env.TASKING_BUCKET.delete(f.stored_name)));
    return c.json({ deleted: 1 });
  });

  app.post("/api/tareas/cards/:id/archive", async c => {
    const { card, error } = await cardWithAccess(c);
    if (error) return error;
    await c.env.DB.prepare("UPDATE tasking_cards SET archived = 1, archived_at = ?, updated_at = ? WHERE id = ?")
      .bind(now(), now(), card.id).run();
    await logEvent(c.env.DB, card.board_id, card.id, "card_archived", c.get("identity_id"), {});
    return c.json(await cardJSONById(c.env.DB, card.id));
  });

  app.post("/api/tareas/cards/:id/restore", async c => {
    const { card, error } = await cardWithAccess(c);
    if (error) return error;
    await c.env.DB.prepare("UPDATE tasking_cards SET archived = 0, archived_at = NULL, updated_at = ? WHERE id = ?")
      .bind(now(), card.id).run();
    await logEvent(c.env.DB, card.board_id, card.id, "card_restored", c.get("identity_id"), {});
    return c.json(await cardJSONById(c.env.DB, card.id));
  });

  app.post("/api/tareas/boards/:boardId/reorder", async c => {
    const identity_id = c.get("identity_id");
    const boardId = c.req.param("boardId");
    if (!(await membership(c.env.DB, boardId, identity_id))) return c.json({ error: "Sin acceso a este tablero." }, 403);
    const body = await c.req.json().catch(() => []);
    const items = Array.isArray(body) ? body : (body && body.items) || [];
    if (!items.length) return c.json({ updated: 0 });

    // Detectar cambios de columna para auditoría (sin IN spread: evita límite de variables en D1)
    const [current, columnIds] = await Promise.all([
      c.env.DB.prepare(`SELECT id, column_id FROM tasking_cards WHERE board_id = ?`).bind(boardId).all(),
      getColumnIds(c.env.DB, boardId),
    ]);
    const validColumns = new Set(columnIds);
    if (items.some(it => !validColumns.has(it.column))) return c.json({ error: COLUMN_NOT_FOUND }, 400);
    const colMap = new Map(current.results.map(r => [r.id, r.column_id]));

    // Batch en bloques de 40 (5 vars × 40 = 200 por batch, dentro del límite de D1 local)
    const upd = c.env.DB.prepare("UPDATE tasking_cards SET column_id = ?, position = ?, updated_at = ? WHERE id = ? AND board_id = ?");
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
        await logEvent(c.env.DB, boardId, it.id, "card_moved", identity_id, { column: { from: prev, to: it.column, fromName, toName } });
      }
    }

    return c.json({ updated: items.length });
  });

  // ---------- Comments ----------
  app.post("/api/tareas/cards/:id/comments", async c => {
    const { card, error } = await cardWithAccess(c);
    if (error) return error;
    const b = await c.req.json().catch(() => ({}));
    const text = (b.text || "").trim();
    if (!text) return c.json({ error: "El comentario está vacío." }, 400);
    const id = uid();
    await c.env.DB.prepare("INSERT INTO tasking_comments (id, card_id, text, author_identity_id, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(id, card.id, text, c.get("identity_id"), now()).run();
    await logEvent(c.env.DB, card.board_id, card.id, "comment_added", c.get("identity_id"), {});
    const row = await c.env.DB.prepare(`
      SELECT cm.id, cm.text, cm.created_at, cm.author_identity_id,
        u.name AS author_name, u.avatar_emoji AS author_emoji, u.avatar_color AS author_color
      FROM tasking_comments cm LEFT JOIN tasking_presentations u ON u.identity_id = cm.author_identity_id WHERE cm.id = ?
    `).bind(id).first();
    return c.json(commentToJSON(row));
  });

  app.delete("/api/tareas/comments/:id", async c => {
    const cm = await c.env.DB.prepare("SELECT * FROM tasking_comments WHERE id = ?").bind(c.req.param("id")).first();
    if (!cm) return c.json({ error: "No existe el comentario." }, 404);
    const card = await getCardRow(c.env.DB, cm.card_id);
    if (card && !(await membership(c.env.DB, card.board_id, c.get("identity_id")))) {
      return c.json({ error: "Sin acceso a este comentario." }, 403);
    }
    await c.env.DB.prepare("DELETE FROM tasking_comments WHERE id = ?").bind(cm.id).run();
    return c.json({ deleted: 1 });
  });

  // ---------- Card History ----------
  app.get("/api/tareas/cards/:id/history", async c => {
    const { card, error } = await cardWithAccess(c);
    if (error) return error;
    const rows = await c.env.DB.prepare(`SELECT al.id, al.card_id, al.action, al.identity_id, al.ts, al.details,
         NULL AS card_title, u.name AS author_name, u.avatar_emoji, u.avatar_color
       FROM tasking_audit_log al LEFT JOIN tasking_presentations u ON u.identity_id = al.identity_id
       WHERE al.card_id = ? ORDER BY al.ts DESC LIMIT 100`).bind(card.id).all();
    let history = rows.results.map(auditRowToJSON);

    // Si no hay historial, crear un evento sintético de creación
    if (!history.length) {
      const board = await c.env.DB.prepare("SELECT owner_identity_id FROM tasking_boards WHERE id = ?").bind(card.board_id).first();
      const owner = board && await c.env.DB.prepare("SELECT name, avatar_emoji, avatar_color FROM tasking_presentations WHERE identity_id = ?").bind(board.owner_identity_id).first();

      history = [{
        id: "synthetic_" + card.id,
        cardId: card.id,
        action: "card_created",
        identity_id: board?.owner_identity_id || "desconocido",
        ts: card.created_at,
        details: { column: card.column_id },
        author: {
          name: (owner?.name || board?.owner_identity_id?.split("@")[0]) || "Sistema",
          avatarEmoji: owner?.avatar_emoji || null,
          avatarColor: owner?.avatar_color || null
        },
      }];
    }

    return c.json({ history });
  });

  // ---------- Import ----------
  app.post("/api/tareas/boards/:boardId/import", async c => {
    const identity_id = c.get("identity_id");
    const boardId = c.req.param("boardId");
    if (!(await membership(c.env.DB, boardId, identity_id))) return c.json({ error: "Sin acceso a este tablero." }, 403);
    const data = await c.req.json().catch(() => ({}));
    if (!Array.isArray(data.cards)) return c.json({ error: "Formato inválido: falta cards[]." }, 400);

    const [maxRows, existingLabels, members, columnIds] = await Promise.all([
      c.env.DB.prepare("SELECT column_id, MAX(position) AS m FROM tasking_cards WHERE board_id = ? GROUP BY column_id").bind(boardId).all(),
      c.env.DB.prepare("SELECT id, name, color FROM tasking_labels WHERE board_id = ? ORDER BY position").bind(boardId).all(),
      c.env.DB.prepare("SELECT identity_id FROM tasking_board_members WHERE board_id = ?").bind(boardId).all(),
      getColumnIds(c.env.DB, boardId),
    ]);
    // Una columna desconocida (de otro tablero, borrada o ausente) deja la tarjeta
    // invisible: se la manda a la primera columna en vez de perderla.
    const validColumns = new Set(columnIds);
    const fallbackColumn = columnIds[0] || "por_conversar";

    const posByCol = {};
    for (const r of maxRows.results) posByCol[r.column_id] = r.m || 0;

    // name (lowercase) → { id, color } — allows finding/creating labels by name
    const labelCache = new Map();
    for (const l of existingLabels.results) labelCache.set(l.name.toLowerCase(), { id: l.id, color: l.color });
    let nextLabelPos = existingLabels.results.length;

    const memberSet = new Set(members.results.map(m => m.identity_id));

    const insCard = c.env.DB.prepare(`INSERT INTO tasking_cards (id, board_id, title, column_id, details, due, assignee_identity_id, archived, archived_at, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insLabel      = c.env.DB.prepare("INSERT INTO tasking_labels (id, board_id, name, color, position, created_at) VALUES (?, ?, ?, ?, ?, ?)");
    const insCardLabel  = c.env.DB.prepare("INSERT OR IGNORE INTO tasking_card_labels (card_id, label_id) VALUES (?, ?)");
    const insChecklist  = c.env.DB.prepare("INSERT INTO tasking_checklists (id, card_id, name, position, created_at) VALUES (?, ?, ?, ?, ?)");
    const insItem       = c.env.DB.prepare("INSERT INTO tasking_checklist_items (id, checklist_id, text, checked, position, created_at) VALUES (?, ?, ?, ?, ?, ?)");

    const stmts = [];
    for (const card of data.cards) {
      const id = uid();
      const t = card.created || now();
      const col = validColumns.has(card.column) ? card.column : fallbackColumn;
      posByCol[col] = (posByCol[col] || 0) + 1;
      const assignee = card.assignee ? await resolveAssignee(c.env.DB, boardId, card.assignee).catch(() => null) : null;

      stmts.push(insCard.bind(
        id, boardId, (card.title || "").trim(), col, card.details || "", card.due || "",
        assignee, card.archived ? 1 : 0, card.archived ? (card.archivedAt || now()) : null,
        posByCol[col], t, t
      ));
      stmts.push(...replaceCommentsStmts(c.env.DB, id, card.comments));

      // Labels: find by name, create if not found (up to 10 per board)
      for (const l of (card.labels || [])) {
        if (!l.name) continue;
        const key = l.name.toLowerCase();
        let entry = labelCache.get(key);
        if (!entry && labelCache.size < 10) {
          const newId = uid();
          entry = { id: newId, color: l.color || "#9C27B0" };
          labelCache.set(key, entry);
          stmts.push(insLabel.bind(newId, boardId, l.name, entry.color, nextLabelPos++, t));
        }
        if (entry) stmts.push(insCardLabel.bind(id, entry.id));
      }

      // Checklists + items
      for (const cl of (card.checklists || [])) {
        const clId = uid();
        stmts.push(insChecklist.bind(clId, id, cl.name || "Lista de tareas", cl.position ?? 0, t));
        for (const item of (cl.items || [])) {
          stmts.push(insItem.bind(uid(), clId, item.text || "", item.checked ? 1 : 0, item.position ?? 0, t));
        }
      }
    }
    if (stmts.length) await c.env.DB.batch(stmts);
    return c.json(await getBoard(c.env.DB, boardId));
  });
}
