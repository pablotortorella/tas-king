import { Hono } from "hono";

const app = new Hono();

// ---------- Helpers básicos ----------
const now = () => Date.now();
const uid = () => crypto.randomUUID();

function extOf(name) {
  const i = (name || "").lastIndexOf(".");
  return i > 0 ? name.slice(i) : "";
}

function attachmentToJSON(a) {
  return {
    id: a.id,
    originalName: a.original_name,
    mime: a.mime,
    size: a.size,
    isImage: (a.mime || "").startsWith("image/"),
    url: "/uploads/" + a.stored_name,
  };
}

function cardToJSON(c, commentsByCard, attsByCard) {
  const comments = (commentsByCard.get(c.id) || []).map(r => ({ id: r.id, text: r.text, ts: r.created_at }));
  const attachments = (attsByCard.get(c.id) || []).map(attachmentToJSON);
  return {
    id: c.id,
    title: c.title,
    column: c.column_id,
    details: c.details,
    due: c.due,
    archived: !!c.archived,
    archivedAt: c.archived_at || undefined,
    position: c.position,
    assignee: c.assignee_email || null,
    created: c.created_at,
    comments,
    attachments,
  };
}

// Board completo (cards + comentarios + adjuntos) de un tablero, con 3 queries.
async function getBoard(db, boardId) {
  const [cards, comments, atts] = await Promise.all([
    db.prepare("SELECT * FROM cards WHERE board_id = ? ORDER BY column_id, position ASC").bind(boardId).all(),
    db.prepare("SELECT cm.id, cm.card_id, cm.text, cm.created_at FROM comments cm JOIN cards c ON c.id = cm.card_id WHERE c.board_id = ? ORDER BY cm.created_at ASC").bind(boardId).all(),
    db.prepare("SELECT a.* FROM attachments a JOIN cards c ON c.id = a.card_id WHERE c.board_id = ? ORDER BY a.created_at ASC").bind(boardId).all(),
  ]);
  const commentsByCard = new Map();
  for (const r of comments.results) {
    if (!commentsByCard.has(r.card_id)) commentsByCard.set(r.card_id, []);
    commentsByCard.get(r.card_id).push(r);
  }
  const attsByCard = new Map();
  for (const r of atts.results) {
    if (!attsByCard.has(r.card_id)) attsByCard.set(r.card_id, []);
    attsByCard.get(r.card_id).push(r);
  }
  return { cards: cards.results.map(c => cardToJSON(c, commentsByCard, attsByCard)) };
}

async function getCardRow(db, id) {
  return db.prepare("SELECT * FROM cards WHERE id = ?").bind(id).first();
}

// JSON de una sola card (con sus comentarios y adjuntos).
async function cardJSONById(db, id) {
  const c = await getCardRow(db, id);
  if (!c) return null;
  const [comments, atts] = await Promise.all([
    db.prepare("SELECT id, text, created_at FROM comments WHERE card_id = ? ORDER BY created_at ASC").bind(id).all(),
    db.prepare("SELECT * FROM attachments WHERE card_id = ? ORDER BY created_at ASC").bind(id).all(),
  ]);
  return cardToJSON(c, new Map([[id, comments.results]]), new Map([[id, atts.results]]));
}

async function nextPosition(db, boardId, columnId) {
  const row = await db.prepare("SELECT MAX(position) AS m FROM cards WHERE board_id = ? AND column_id = ?")
    .bind(boardId, columnId).first();
  return (row && row.m != null ? row.m : 0) + 1;
}

function replaceCommentsStmts(db, cardId, comments) {
  const stmts = [db.prepare("DELETE FROM comments WHERE card_id = ?").bind(cardId)];
  const ins = db.prepare("INSERT INTO comments (id, card_id, text, created_at) VALUES (?, ?, ?, ?)");
  (comments || []).forEach(cm => {
    const text = (cm && cm.text ? String(cm.text) : "").trim();
    if (text) stmts.push(ins.bind(uid(), cardId, text, cm.ts || now()));
  });
  return stmts;
}

// ---------- Identidad y autorización ----------

// Asegura que el usuario exista y tenga su tablero personal.
async function ensureUser(db, email) {
  await db.prepare("INSERT OR IGNORE INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)")
    .bind(uid(), email, email.split("@")[0], now()).run();
  const personal = await db.prepare("SELECT id FROM boards WHERE owner_email = ? AND is_personal = 1").bind(email).first();
  if (!personal) {
    const bid = uid();
    await db.batch([
      db.prepare("INSERT INTO boards (id, name, owner_email, is_personal, created_at) VALUES (?, ?, ?, 1, ?)")
        .bind(bid, "Mi tablero", email, now()),
      db.prepare("INSERT OR IGNORE INTO board_members (board_id, email, role, created_at) VALUES (?, ?, 'owner', ?)")
        .bind(bid, email, now()),
    ]);
  }
}

async function membership(db, boardId, email) {
  return db.prepare("SELECT role FROM board_members WHERE board_id = ? AND email = ?").bind(boardId, email).first();
}

// Middleware: resuelve el usuario en cada request /api/*.
app.use("/api/*", async (c, next) => {
  const email = (
    c.req.header("Cf-Access-Authenticated-User-Email") ||  // producción (Cloudflare Access)
    c.req.header("X-Dev-User") ||                            // desarrollo local (simular usuario)
    c.env.DEV_USER_EMAIL || ""
  ).trim().toLowerCase();
  if (!email) return c.json({ error: "No autenticado." }, 401);
  await ensureUser(c.env.DB, email);
  c.set("email", email);
  await next();
});

// ---------- API: usuario actual y sus tableros ----------
app.get("/api/me", async c => {
  const email = c.get("email");
  const rows = await c.env.DB.prepare(`
    SELECT b.id, b.name, b.is_personal, b.owner_email, bm.role,
      (SELECT COUNT(*) FROM board_members x WHERE x.board_id = b.id) AS member_count
    FROM boards b
    JOIN board_members bm ON bm.board_id = b.id
    WHERE bm.email = ?
    ORDER BY b.is_personal DESC, b.created_at ASC
  `).bind(email).all();
  return c.json({
    email,
    boards: rows.results.map(r => ({
      id: r.id, name: r.name, isPersonal: !!r.is_personal,
      role: r.role, ownerEmail: r.owner_email, memberCount: r.member_count,
    })),
  });
});

// ---------- API: boards ----------
app.post("/api/boards", async c => {
  const email = c.get("email");
  const b = await c.req.json().catch(() => ({}));
  const name = (b.name || "").trim();
  if (!name) return c.json({ error: "Falta el nombre del tablero." }, 400);
  const id = uid();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO boards (id, name, owner_email, is_personal, created_at) VALUES (?, ?, ?, 0, ?)")
      .bind(id, name, email, now()),
    c.env.DB.prepare("INSERT INTO board_members (board_id, email, role, created_at) VALUES (?, ?, 'owner', ?)")
      .bind(id, email, now()),
  ]);
  return c.json({ id, name, isPersonal: false, role: "owner", ownerEmail: email, memberCount: 1 });
});

app.patch("/api/boards/:boardId", async c => {
  const email = c.get("email");
  const boardId = c.req.param("boardId");
  const m = await membership(c.env.DB, boardId, email);
  if (!m) return c.json({ error: "Sin acceso a este tablero." }, 403);
  if (m.role !== "owner") return c.json({ error: "Solo el dueño puede renombrar el tablero." }, 403);
  const b = await c.req.json().catch(() => ({}));
  const name = (b.name || "").trim();
  if (!name) return c.json({ error: "Falta el nombre." }, 400);
  await c.env.DB.prepare("UPDATE boards SET name = ? WHERE id = ?").bind(name, boardId).run();
  return c.json({ id: boardId, name });
});

app.delete("/api/boards/:boardId", async c => {
  const email = c.get("email");
  const boardId = c.req.param("boardId");
  const board = await c.env.DB.prepare("SELECT * FROM boards WHERE id = ?").bind(boardId).first();
  if (!board) return c.json({ error: "No existe el tablero." }, 404);
  if (board.owner_email !== email) return c.json({ error: "Solo el dueño puede eliminar el tablero." }, 403);
  if (board.is_personal) return c.json({ error: "No se puede eliminar el tablero personal." }, 400);

  const files = await c.env.DB.prepare(
    "SELECT a.stored_name FROM attachments a JOIN cards c ON c.id = a.card_id WHERE c.board_id = ?"
  ).bind(boardId).all();
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM comments WHERE card_id IN (SELECT id FROM cards WHERE board_id = ?)").bind(boardId),
    c.env.DB.prepare("DELETE FROM attachments WHERE card_id IN (SELECT id FROM cards WHERE board_id = ?)").bind(boardId),
    c.env.DB.prepare("DELETE FROM cards WHERE board_id = ?").bind(boardId),
    c.env.DB.prepare("DELETE FROM board_members WHERE board_id = ?").bind(boardId),
    c.env.DB.prepare("DELETE FROM boards WHERE id = ?").bind(boardId),
  ]);
  await Promise.all(files.results.map(f => c.env.BUCKET.delete(f.stored_name)));
  return c.json({ deleted: 1 });
});

// ---------- API: miembros ----------
app.get("/api/boards/:boardId/members", async c => {
  const email = c.get("email");
  const boardId = c.req.param("boardId");
  if (!(await membership(c.env.DB, boardId, email))) return c.json({ error: "Sin acceso a este tablero." }, 403);
  const rows = await c.env.DB.prepare(
    "SELECT email, role FROM board_members WHERE board_id = ? ORDER BY role DESC, email ASC"
  ).bind(boardId).all();
  return c.json({ members: rows.results });
});

app.post("/api/boards/:boardId/members", async c => {
  const email = c.get("email");
  const boardId = c.req.param("boardId");
  const m = await membership(c.env.DB, boardId, email);
  if (!m || m.role !== "owner") return c.json({ error: "Solo el dueño puede invitar miembros." }, 403);
  const b = await c.req.json().catch(() => ({}));
  const invited = (b.email || "").trim().toLowerCase();
  if (!invited || !invited.includes("@")) return c.json({ error: "Email inválido." }, 400);
  await ensureUser(c.env.DB, invited);
  await c.env.DB.prepare("INSERT OR IGNORE INTO board_members (board_id, email, role, created_at) VALUES (?, ?, 'member', ?)")
    .bind(boardId, invited, now()).run();
  return c.json({ email: invited, role: "member" });
});

app.delete("/api/boards/:boardId/members/:email", async c => {
  const email = c.get("email");
  const boardId = c.req.param("boardId");
  const target = decodeURIComponent(c.req.param("email")).toLowerCase();
  const board = await c.env.DB.prepare("SELECT owner_email FROM boards WHERE id = ?").bind(boardId).first();
  if (!board) return c.json({ error: "No existe el tablero." }, 404);
  if (board.owner_email !== email) return c.json({ error: "Solo el dueño puede quitar miembros." }, 403);
  if (target === board.owner_email) return c.json({ error: "No se puede quitar al dueño." }, 400);
  await c.env.DB.prepare("DELETE FROM board_members WHERE board_id = ? AND email = ?").bind(boardId, target).run();
  return c.json({ removed: target });
});

// ---------- API: cards (board-scoped) ----------
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
    ...replaceCommentsStmts(c.env.DB, id, b.comments),
  ]);
  return c.json(await cardJSONById(c.env.DB, id));
});

// Helper: obtiene la card y verifica que el usuario sea miembro de su tablero.
async function cardWithAccess(c) {
  const card = await getCardRow(c.env.DB, c.req.param("id"));
  if (!card) return { error: c.json({ error: "No existe la tarjeta." }, 404) };
  if (!(await membership(c.env.DB, card.board_id, c.get("email")))) {
    return { error: c.json({ error: "Sin acceso a esta tarjeta." }, 403) };
  }
  return { card };
}

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
  if (b.comments !== undefined) stmts.push(...replaceCommentsStmts(c.env.DB, card.id, b.comments));
  await c.env.DB.batch(stmts);
  return c.json(await cardJSONById(c.env.DB, card.id));
});

app.delete("/api/cards/:id", async c => {
  const { card, error } = await cardWithAccess(c);
  if (error) return error;
  const files = await c.env.DB.prepare("SELECT stored_name FROM attachments WHERE card_id = ?").bind(card.id).all();
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
  return c.json(await cardJSONById(c.env.DB, card.id));
});

app.post("/api/cards/:id/restore", async c => {
  const { card, error } = await cardWithAccess(c);
  if (error) return error;
  await c.env.DB.prepare("UPDATE cards SET archived = 0, archived_at = NULL, updated_at = ? WHERE id = ?")
    .bind(now(), card.id).run();
  return c.json(await cardJSONById(c.env.DB, card.id));
});

// Reordenamiento dentro de un tablero: array de { id, column, position }
app.post("/api/boards/:boardId/reorder", async c => {
  const email = c.get("email");
  const boardId = c.req.param("boardId");
  if (!(await membership(c.env.DB, boardId, email))) return c.json({ error: "Sin acceso a este tablero." }, 403);
  const body = await c.req.json().catch(() => []);
  const items = Array.isArray(body) ? body : (body && body.items) || [];
  // Solo se actualizan cards que pertenecen a este tablero (defensa extra).
  const upd = c.env.DB.prepare("UPDATE cards SET column_id = ?, position = ?, updated_at = ? WHERE id = ? AND board_id = ?");
  if (items.length) {
    await c.env.DB.batch(items.map((it, i) =>
      upd.bind(it.column, it.position != null ? it.position : i, now(), it.id, boardId)));
  }
  return c.json({ updated: items.length });
});

// ---------- API: attachments ----------
const MAX_SIZE = 25 * 1024 * 1024;

app.post("/api/cards/:id/attachments", async c => {
  const { card, error } = await cardWithAccess(c);
  if (error) return error;
  const form = await c.req.formData();
  const files = form.getAll("files").filter(f => typeof f === "object" && f.arrayBuffer);
  const created = [];
  for (const file of files) {
    if (file.size > MAX_SIZE) return c.json({ error: "Archivo demasiado grande (máx. 25 MB)." }, 413);
    const key = uid() + extOf(file.name);
    await c.env.BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });
    const id = uid();
    await c.env.DB.prepare(
      `INSERT INTO attachments (id, card_id, stored_name, original_name, mime, size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, card.id, key, file.name, file.type || "", file.size, now()).run();
    created.push(attachmentToJSON({
      id, original_name: file.name, mime: file.type || "", size: file.size, stored_name: key,
    }));
  }
  return c.json({ attachments: created });
});

app.delete("/api/attachments/:id", async c => {
  const a = await c.env.DB.prepare("SELECT * FROM attachments WHERE id = ?").bind(c.req.param("id")).first();
  if (!a) return c.json({ error: "No existe el adjunto." }, 404);
  const card = await getCardRow(c.env.DB, a.card_id);
  if (card && !(await membership(c.env.DB, card.board_id, c.get("email")))) {
    return c.json({ error: "Sin acceso a este adjunto." }, 403);
  }
  await c.env.DB.prepare("DELETE FROM attachments WHERE id = ?").bind(a.id).run();
  await c.env.BUCKET.delete(a.stored_name);
  return c.json({ deleted: 1 });
});

// Servir archivos desde R2
app.get("/uploads/:key", async c => {
  const obj = await c.env.BUCKET.get(c.req.param("key"));
  if (!obj) return c.notFound();
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
});

// ---------- API: import (agrega al tablero actual, NO borra) ----------
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

export default app;
