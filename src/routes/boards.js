// ---------- Routes: Boards ----------

import { membership, ensureUser } from "../db/helpers.js";
import { getBoard, auditRowToJSON } from "../db/queries.js";
import { createDefaultColumns } from "./columns.js";

const uid = () => crypto.randomUUID();
const now = () => Date.now();

export function setupBoardRoutes(app) {
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
    await createDefaultColumns(c.env.DB, id);
    return c.json({ id, name, isPersonal: false, role: "owner", ownerEmail: email, memberCount: 1 });
  });

  app.patch("/api/boards/:boardId", async c => {
    const email = c.get("email");
    const boardId = c.req.param("boardId");
    const m = await membership(c.env.DB, boardId, email);
    if (!m) return c.json({ error: "Sin acceso a este tablero." }, 403);
    if (m.role !== "owner") return c.json({ error: "Solo el dueño puede editar el tablero." }, 403);
    const b = await c.req.json().catch(() => ({}));

    const sets = [];
    const binds = [];
    if (b.name !== undefined) {
      const name = String(b.name).trim();
      if (!name) return c.json({ error: "Falta el nombre." }, 400);
      sets.push("name = ?"); binds.push(name);
    }
    if (b.dueSoonDays !== undefined) {
      const days = parseInt(b.dueSoonDays, 10);
      if (!Number.isInteger(days) || days < 0 || days > 90) {
        return c.json({ error: "Los días de anticipación deben ser un número entre 0 y 90." }, 400);
      }
      sets.push("due_soon_days = ?"); binds.push(days);
    }
    if (!sets.length) return c.json({ error: "Nada para actualizar." }, 400);

    binds.push(boardId);
    await c.env.DB.prepare(`UPDATE boards SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
    const row = await c.env.DB.prepare("SELECT name, due_soon_days FROM boards WHERE id = ?").bind(boardId).first();
    return c.json({ id: boardId, name: row.name, dueSoonDays: row.due_soon_days });
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
      c.env.DB.prepare("DELETE FROM columns WHERE board_id = ?").bind(boardId),
      c.env.DB.prepare("DELETE FROM board_members WHERE board_id = ?").bind(boardId),
      c.env.DB.prepare("DELETE FROM boards WHERE id = ?").bind(boardId),
    ]);
    await Promise.all(files.results.map(f => c.env.BUCKET.delete(f.stored_name)));
    return c.json({ deleted: 1 });
  });

  // ---------- Board Members ----------
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

  // ---------- Board Activity ----------
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
}
