import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";

const app = new Hono();

// ---------- Límites de adjuntos ----------
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_ATTACHMENTS_PER_CARD = 10;
const ALLOWED_MIME_TYPES = new Set([
  // Imágenes
  "image/jpeg", "image/png", "image/webp", "image/gif",
  // Documentos
  "application/pdf", "text/plain", "text/csv",
  // Office
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

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

// Mapea una fila de comentario (con campos de autor de un LEFT JOIN users) a JSON.
function commentToJSON(r) {
  return {
    id: r.id,
    text: r.text,
    ts: r.created_at,
    author: r.author_email ? {
      email: r.author_email,
      name: r.author_name || r.author_email.split("@")[0],
      avatarEmoji: r.author_emoji || null,
      avatarColor: r.author_color || null,
    } : null,
  };
}

function cardToJSON(c, commentsByCard, attsByCard) {
  const comments = (commentsByCard.get(c.id) || []).map(commentToJSON);
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
    db.prepare(`SELECT cm.id, cm.card_id, cm.text, cm.created_at, cm.author_email,
        u.name AS author_name, u.avatar_emoji AS author_emoji, u.avatar_color AS author_color
      FROM comments cm
      JOIN cards c ON c.id = cm.card_id
      LEFT JOIN users u ON u.email = cm.author_email
      WHERE c.board_id = ? ORDER BY cm.created_at ASC`).bind(boardId).all(),
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
  const version = cards.results.reduce((max, c) => Math.max(max, c.updated_at || 0), 0);
  return { version, cards: cards.results.map(c => cardToJSON(c, commentsByCard, attsByCard)) };
}

async function getCardRow(db, id) {
  return db.prepare("SELECT * FROM cards WHERE id = ?").bind(id).first();
}

// JSON de una sola card (con sus comentarios y adjuntos).
async function cardJSONById(db, id) {
  const c = await getCardRow(db, id);
  if (!c) return null;
  const [comments, atts] = await Promise.all([
    db.prepare(`SELECT cm.id, cm.text, cm.created_at, cm.author_email,
        u.name AS author_name, u.avatar_emoji AS author_emoji, u.avatar_color AS author_color
      FROM comments cm LEFT JOIN users u ON u.email = cm.author_email
      WHERE cm.card_id = ? ORDER BY cm.created_at ASC`).bind(id).all(),
    db.prepare("SELECT * FROM attachments WHERE card_id = ? ORDER BY created_at ASC").bind(id).all(),
  ]);
  return cardToJSON(c, new Map([[id, comments.results]]), new Map([[id, atts.results]]));
}

async function nextPosition(db, boardId, columnId) {
  const row = await db.prepare("SELECT MAX(position) AS m FROM cards WHERE board_id = ? AND column_id = ?")
    .bind(boardId, columnId).first();
  return (row && row.m != null ? row.m : 0) + 1;
}

async function logEvent(db, boardId, cardId, action, email, details = {}) {
  await db.prepare(
    "INSERT INTO audit_log (id, board_id, card_id, action, email, ts, details) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(uid(), boardId, cardId || null, action, email, now(), JSON.stringify(details)).run();
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

// ---------- Login con Google (OAuth dentro del Worker) ----------
// Cookies de sesión firmadas con HMAC-SHA256 (no se puede leer el header de Access
// en workers.dev, así que la identidad la maneja el propio Worker).

function b64urlFromBytes(buf) {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
const b64urlFromStr = s => b64urlFromBytes(new TextEncoder().encode(s));
const strFromB64url = s => new TextDecoder().decode(b64urlToBytes(s));

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret || ""),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function signSession(payload, secret) {
  const data = b64urlFromStr(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(data));
  return data + "." + b64urlFromBytes(sig);
}
async function verifySession(token, secret) {
  if (!token || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), b64urlToBytes(sig), new TextEncoder().encode(data));
  if (!ok) return null;
  try {
    const obj = JSON.parse(strFromB64url(data));
    if (obj.exp && Date.now() > obj.exp) return null;
    return obj;
  } catch (e) { return null; }
}

function deniedPage(msg) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Acceso</title><style>
    body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f5f7;color:#172b4d;
    display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
    .box{background:#fff;border-radius:10px;box-shadow:0 1px 4px rgba(9,30,66,.2);padding:28px 32px;max-width:420px;text-align:center}
    a{display:inline-block;margin-top:16px;background:#0079bf;color:#fff;text-decoration:none;padding:8px 16px;border-radius:5px}
    </style></head><body><div class="box"><h2>🔒 Acceso al tablero</h2><p>${msg}</p>
    <a href="/auth/login">Entrar con Google</a></div></body></html>`;
}

const COOKIE_OPTS = { httpOnly: true, secure: true, sameSite: "Lax", path: "/" };

// Verifica si un email puede acceder: primero D1, luego fallback al Secret legacy.
async function isEmailAllowed(db, email, legacySecret) {
  const row = await db.prepare("SELECT 1 FROM allowed_emails WHERE email = ?").bind(email).first();
  if (row) return true;
  // Fallback: si la tabla está vacía, usar el Secret para no romper deploys existentes
  const count = await db.prepare("SELECT COUNT(*) AS n FROM allowed_emails").first();
  if (count && count.n === 0 && legacySecret) {
    const list = legacySecret.toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
    return list.includes(email);
  }
  return false;
}

// Marca como admin a un email si está en el Secret ADMIN_EMAILS.
async function seedAdminIfNeeded(db, email, adminEmailsSecret) {
  if (!adminEmailsSecret) return;
  const admins = adminEmailsSecret.toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
  if (admins.includes(email)) {
    await db.prepare("UPDATE users SET is_admin = 1 WHERE email = ? AND is_admin = 0").bind(email).run();
  }
}

app.get("/auth/login", c => {
  const origin = new URL(c.req.url).origin;
  const state = crypto.randomUUID();
  setCookie(c, "oauth_state", state, { ...COOKIE_OPTS, maxAge: 600 });
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: origin + "/auth/callback",
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return c.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params.toString());
});

app.get("/auth/callback", async c => {
  const url = new URL(c.req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== getCookie(c, "oauth_state")) {
    return c.html(deniedPage("La sesión de login expiró o es inválida. Probá de nuevo."), 400);
  }
  deleteCookie(c, "oauth_state", { path: "/" });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID || "",
      client_secret: c.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: url.origin + "/auth/callback",
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!tokenRes.ok) return c.html(deniedPage("No se pudo completar el login con Google."), 502);
  const tok = await tokenRes.json();

  let claims;
  try { claims = JSON.parse(strFromB64url(tok.id_token.split(".")[1])); }
  catch (e) { return c.html(deniedPage("Respuesta de Google inesperada."), 502); }
  const email = (claims.email || "").trim().toLowerCase();
  if (!email || claims.email_verified === false) {
    return c.html(deniedPage("Tu cuenta de Google no tiene un email verificado."), 403);
  }

  // Verificar si el email está en la allowlist de D1 o en el Secret legacy ALLOWED_EMAILS
  const isAllowed = await isEmailAllowed(c.env.DB, email, c.env.ALLOWED_EMAILS);
  if (!isAllowed) {
    return c.html(deniedPage(`La cuenta <b>${email}</b> no está autorizada para esta app.`), 403);
  }

  // Asegurar que exista en D1 y aplicar is_admin si corresponde según ADMIN_EMAILS
  await seedAdminIfNeeded(c.env.DB, email, c.env.ADMIN_EMAILS);

  const session = await signSession({ email, exp: Date.now() + 30 * 24 * 3600 * 1000 }, c.env.SESSION_SECRET);
  setCookie(c, "session", session, { ...COOKIE_OPTS, maxAge: 30 * 24 * 3600 });
  return c.redirect("/");
});

app.get("/auth/logout", c => {
  deleteCookie(c, "session", { path: "/" });
  return c.redirect("/");
});

function isLocalRequest(url) {
  const hostname = new URL(url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

// Resuelve el email desde la cookie firmada de Google. La identidad simulada solo se
// habilita en localhost; nunca confiar en headers de identidad enviados por el cliente
// en producción. Si se adopta Cloudflare Access, validar primero su JWT assertion.
async function resolveEmail(c) {
  const token = getCookie(c, "session");
  if (token) {
    const sess = await verifySession(token, c.env.SESSION_SECRET);
    if (sess && sess.email) return sess.email.trim().toLowerCase();
  }
  if (!isLocalRequest(c.req.url)) return "";
  const dev = c.req.header("X-Dev-User") || c.env.DEV_USER_EMAIL;
  return dev ? dev.trim().toLowerCase() : "";
}

// Middleware: resuelve el usuario en cada request /api/*.
app.use("/api/*", async (c, next) => {
  const email = await resolveEmail(c);
  if (!email) return c.json({ error: "No autenticado." }, 401);
  await ensureUser(c.env.DB, email);
  await seedAdminIfNeeded(c.env.DB, email, c.env.ADMIN_EMAILS);
  c.set("email", email);
  await next();
});

// ---------- API: usuario actual y sus tableros ----------
app.get("/api/me", async c => {
  const email = c.get("email");
  const [rows, user] = await Promise.all([
    c.env.DB.prepare(`
      SELECT b.id, b.name, b.is_personal, b.owner_email, bm.role,
        (SELECT COUNT(*) FROM board_members x WHERE x.board_id = b.id) AS member_count
      FROM boards b
      JOIN board_members bm ON bm.board_id = b.id
      WHERE bm.email = ?
      ORDER BY b.is_personal DESC, b.created_at ASC
    `).bind(email).all(),
    c.env.DB.prepare("SELECT name, avatar_emoji, avatar_color, is_admin FROM users WHERE email = ?").bind(email).first(),
  ]);
  return c.json({
    email,
    isAdmin: !!(user && user.is_admin),
    profile: {
      name: (user && user.name) || email.split("@")[0],
      avatarEmoji: (user && user.avatar_emoji) || null,
      avatarColor: (user && user.avatar_color) || null,
    },
    boards: rows.results.map(r => ({
      id: r.id, name: r.name, isPersonal: !!r.is_personal,
      role: r.role, ownerEmail: r.owner_email, memberCount: r.member_count,
    })),
  });
});

// Actualizar el perfil del usuario actual.
app.put("/api/me", async c => {
  const email = c.get("email");
  const b = await c.req.json().catch(() => ({}));
  const name = (b.name != null ? String(b.name) : "").trim().slice(0, 60);
  const emoji = (b.avatarEmoji != null ? String(b.avatarEmoji) : "").trim().slice(0, 8) || null;
  const color = (b.avatarColor != null ? String(b.avatarColor) : "").trim().slice(0, 16) || null;
  await c.env.DB.prepare("UPDATE users SET name = ?, avatar_emoji = ?, avatar_color = ? WHERE email = ?")
    .bind(name || email.split("@")[0], emoji, color, email).run();
  return c.json({ name: name || email.split("@")[0], avatarEmoji: emoji, avatarColor: color });
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
  const rows = await c.env.DB.prepare(`
    SELECT bm.email, bm.role, u.name, u.avatar_emoji, u.avatar_color
    FROM board_members bm LEFT JOIN users u ON u.email = bm.email
    WHERE bm.board_id = ? ORDER BY bm.role DESC, bm.email ASC
  `).bind(boardId).all();
  return c.json({
    members: rows.results.map(r => ({
      email: r.email, role: r.role,
      name: r.name || r.email.split("@")[0],
      avatarEmoji: r.avatar_emoji || null,
      avatarColor: r.avatar_color || null,
    })),
  });
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
  await logEvent(c.env.DB, boardId, id, "card_created", email, { title: String(b.title).trim() });
  return c.json(await cardJSONById(c.env.DB, id));
});

// Devuelve una tarjeta por ID junto con el boardId, para deep-link desde el frontend.
app.get("/api/cards/:id", async c => {
  const { card, error } = await cardWithAccess(c);
  if (error) return error;
  const json = await cardJSONById(c.env.DB, card.id);
  return c.json({ ...json, boardId: card.board_id });
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
  await c.env.DB.batch(stmts);

  const changes = {};
  if (b.title != null && String(b.title).trim() !== card.title) changes.title = { from: card.title, to: String(b.title).trim() };
  if (column !== card.column_id) changes.column = { from: card.column_id, to: column };
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

// ---------- API: comentarios (con autor, se publican al instante) ----------
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
app.post("/api/cards/:id/attachments", async c => {
  const { card, error } = await cardWithAccess(c);
  if (error) return error;

  // Contar adjuntos existentes
  const existing = await c.env.DB.prepare(
    "SELECT COUNT(*) as n FROM attachments WHERE card_id = ?"
  ).bind(card.id).first();

  const form = await c.req.formData();
  const files = form.getAll("files").filter(f => typeof f === "object" && f.arrayBuffer);

  // Validar cantidad total
  if (existing.n + files.length > MAX_ATTACHMENTS_PER_CARD) {
    return c.json({
      error: `Máximo ${MAX_ATTACHMENTS_PER_CARD} archivos por tarjeta. Ya hay ${existing.n}.`
    }, 400);
  }

  const created = [];
  for (const file of files) {
    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: "Archivo demasiado grande (máx. 20 MB)." }, 413);
    }

    // Validar MIME type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return c.json({
        error: `Tipo de archivo no permitido: ${file.type || "desconocido"}`
      }, 400);
    }

    const key = uid() + extOf(file.name);
    await c.env.BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });
    const id = uid();
    await c.env.DB.prepare(
      `INSERT INTO attachments (id, card_id, stored_name, original_name, mime, size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, card.id, key, file.name, file.type, file.size, now()).run();
    created.push(attachmentToJSON({
      id, original_name: file.name, mime: file.type, size: file.size, stored_name: key,
    }));
  }
  if (created.length > 0) {
    await logEvent(c.env.DB, card.board_id, card.id, "attachment_added", c.get("email"),
      { files: created.map(f => f.originalName) });
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
  // Validar autenticación
  const email = await resolveEmail(c);
  if (!email) return c.json({ error: "No autenticado." }, 401);

  const key = c.req.param("key");

  // Buscar adjunto y validar acceso
  const att = await c.env.DB.prepare(
    `SELECT a.*, c.board_id FROM attachments a
     JOIN cards c ON a.card_id = c.id
     WHERE a.stored_name = ?`
  ).bind(key).first();

  if (!att) return c.notFound();

  // Validar membresía del tablero
  const isMember = await membership(c.env.DB, att.board_id, email);
  if (!isMember) return c.json({ error: "Sin acceso a este archivo." }, 403);

  // Servir archivo
  const obj = await c.env.BUCKET.get(key);
  if (!obj) return c.notFound();

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "private, max-age=31536000");
  return new Response(obj.body, { headers });
});

// ---------- API: historial de actividad ----------

function auditRowToJSON(r) {
  return {
    id: r.id,
    cardId: r.card_id || null,
    cardTitle: r.card_title || null,
    action: r.action,
    email: r.email,
    ts: r.ts,
    details: JSON.parse(r.details || "{}"),
    author: {
      name: r.author_name || r.email.split("@")[0],
      avatarEmoji: r.avatar_emoji || null,
      avatarColor: r.avatar_color || null,
    },
  };
}

// Historial de una tarjeta (visible para todos los miembros del tablero)
app.get("/api/cards/:id/history", async c => {
  const { card, error } = await cardWithAccess(c);
  if (error) return error;
  const rows = await c.env.DB.prepare(
    `SELECT al.id, al.card_id, al.action, al.email, al.ts, al.details,
       NULL AS card_title, u.name AS author_name, u.avatar_emoji, u.avatar_color
     FROM audit_log al LEFT JOIN users u ON u.email = al.email
     WHERE al.card_id = ? ORDER BY al.ts DESC LIMIT 100`
  ).bind(card.id).all();
  return c.json({ history: rows.results.map(auditRowToJSON) });
});

// Actividad del tablero (todos los miembros pueden ver; filtros de usuario/fecha para todos)
app.get("/api/boards/:boardId/activity", async c => {
  const email = c.get("email");
  const boardId = c.req.param("boardId");
  if (!(await membership(c.env.DB, boardId, email))) return c.json({ error: "Sin acceso a este tablero." }, 403);
  const q = c.req.query();
  const conditions = ["al.board_id = ?"];
  const binds = [boardId];
  if (q.user)  { conditions.push("al.email = ?");  binds.push(q.user); }
  if (q.from)  { conditions.push("al.ts >= ?");    binds.push(Number(q.from)); }
  if (q.to)    { conditions.push("al.ts <= ?");    binds.push(Number(q.to)); }
  const lim = Math.min(parseInt(q.limit) || 100, 500);
  const rows = await c.env.DB.prepare(
    `SELECT al.id, al.card_id, al.action, al.email, al.ts, al.details,
       c.title AS card_title, u.name AS author_name, u.avatar_emoji, u.avatar_color
     FROM audit_log al
     LEFT JOIN cards c ON c.id = al.card_id
     LEFT JOIN users u ON u.email = al.email
     WHERE ${conditions.join(" AND ")} ORDER BY al.ts DESC LIMIT ${lim}`
  ).bind(...binds).all();
  return c.json({ activity: rows.results.map(auditRowToJSON) });
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

// ---------- API: Admin ----------

async function requireAdmin(c, next) {
  const email = c.get("email");
  const user = await c.env.DB.prepare("SELECT is_admin FROM users WHERE email = ?").bind(email).first();
  if (!user || !user.is_admin) return c.json({ error: "Acceso denegado." }, 403);
  await next();
}

app.use("/api/admin/*", requireAdmin);

// Listar emails permitidos y admins
app.get("/api/admin/users", async c => {
  const [allowed, admins] = await Promise.all([
    c.env.DB.prepare("SELECT email, added_by, added_at FROM allowed_emails ORDER BY added_at ASC").all(),
    c.env.DB.prepare("SELECT email, name FROM users WHERE is_admin = 1 ORDER BY email ASC").all(),
  ]);
  return c.json({ allowed: allowed.results, admins: admins.results });
});

// Agregar email permitido
app.post("/api/admin/allowed", async c => {
  const { email } = await c.req.json();
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return c.json({ error: "Email inválido." }, 400);
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO allowed_emails (email, added_by, added_at) VALUES (?, ?, datetime('now'))"
  ).bind(normalized, c.get("email")).run();
  return c.json({ ok: true });
});

// Eliminar email permitido
app.delete("/api/admin/allowed/:email", async c => {
  const target = decodeURIComponent(c.req.param("email")).trim().toLowerCase();
  // No permitir que el admin se elimine a sí mismo
  if (target === c.get("email")) return c.json({ error: "No podés eliminarte a vos mismo." }, 400);
  await c.env.DB.prepare("DELETE FROM allowed_emails WHERE email = ?").bind(target).run();
  return c.json({ ok: true });
});

// Promover/degradar admin
app.post("/api/admin/set-admin", async c => {
  const { email, isAdmin } = await c.req.json();
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return c.json({ error: "Email inválido." }, 400);
  if (normalized === c.get("email")) return c.json({ error: "No podés cambiar tu propio rol." }, 400);
  await c.env.DB.prepare("UPDATE users SET is_admin = ? WHERE email = ?").bind(isAdmin ? 1 : 0, normalized).run();
  return c.json({ ok: true });
});

export default app;

// Exportaciones puras para tests unitarios. El Worker sigue usando el export default.
export {
  attachmentToJSON,
  b64urlFromBytes,
  b64urlFromStr,
  b64urlToBytes,
  cardToJSON,
  commentToJSON,
  extOf,
  isLocalRequest,
  signSession,
  strFromB64url,
  verifySession,
};
