// ---------- Routes: Boards ----------

import { membership, ensureUser } from "../db/helpers.js";
import { getBoard, auditRowToJSON } from "../db/queries.js";
import { createDefaultColumns } from "./columns.js";
import { BOARD_THEMES } from "../constants.js";

const uid = () => crypto.randomUUID();
const now = () => Date.now();

export function setupBoardRoutes(app) {
  app.post("/api/tareas/boards", async c => {
    const identity_id = c.get("identity_id");
    const b = await c.req.json().catch(() => ({}));
    const name = (b.name || "").trim();
    if (!name) return c.json({ error: "Falta el nombre del tablero." }, 400);
    const id = uid();
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO tasking_boards (id, name, owner_identity_id, is_personal, created_at) VALUES (?, ?, ?, 0, ?)")
        .bind(id, name, identity_id, now()),
      c.env.DB.prepare("INSERT INTO tasking_board_members (board_id, identity_id, role, created_at) VALUES (?, ?, 'owner', ?)")
        .bind(id, identity_id, now()),
    ]);
    await createDefaultColumns(c.env.DB, id);
    return c.json({ id, name, isPersonal: false, role: "owner", ownerIdentityId: identity_id, memberCount: 1 });
  });

  app.patch("/api/tareas/boards/:boardId", async c => {
    const identity_id = c.get("identity_id");
    const boardId = c.req.param("boardId");
    const m = await membership(c.env.DB, boardId, identity_id);
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
    if (b.theme !== undefined) {
      if (!BOARD_THEMES.has(b.theme)) return c.json({ error: "Paleta de color inválida." }, 400);
      // Elegir una paleta implica ya haber visto/resuelto el prompt de bienvenida.
      sets.push("theme = ?", "theme_prompt_seen = 1"); binds.push(b.theme);
    }
    if (b.themePromptSeen !== undefined) {
      sets.push("theme_prompt_seen = ?"); binds.push(b.themePromptSeen ? 1 : 0);
    }
    if (!sets.length) return c.json({ error: "Nada para actualizar." }, 400);

    binds.push(boardId);
    await c.env.DB.prepare(`UPDATE tasking_boards SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
    const row = await c.env.DB.prepare("SELECT name, due_soon_days, theme, theme_prompt_seen FROM tasking_boards WHERE id = ?").bind(boardId).first();
    return c.json({
      id: boardId, name: row.name, dueSoonDays: row.due_soon_days,
      theme: row.theme, themePromptSeen: !!row.theme_prompt_seen,
    });
  });

  app.delete("/api/tareas/boards/:boardId", async c => {
    const identity_id = c.get("identity_id");
    const boardId = c.req.param("boardId");
    const board = await c.env.DB.prepare("SELECT * FROM tasking_boards WHERE id = ?").bind(boardId).first();
    if (!board) return c.json({ error: "No existe el tablero." }, 404);
    if (board.owner_identity_id !== identity_id) return c.json({ error: "Solo el dueño puede eliminar el tablero." }, 403);
    if (board.is_personal) return c.json({ error: "No se puede eliminar el tablero personal." }, 400);

    const files = await c.env.DB.prepare("SELECT a.stored_name FROM tasking_attachments a JOIN tasking_cards c ON c.id = a.card_id WHERE c.board_id = ?").bind(boardId).all();
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM tasking_comments WHERE card_id IN (SELECT id FROM tasking_cards WHERE board_id = ?)").bind(boardId),
      c.env.DB.prepare("DELETE FROM tasking_attachments WHERE card_id IN (SELECT id FROM tasking_cards WHERE board_id = ?)").bind(boardId),
      c.env.DB.prepare("DELETE FROM tasking_cards WHERE board_id = ?").bind(boardId),
      c.env.DB.prepare("DELETE FROM tasking_columns WHERE board_id = ?").bind(boardId),
      c.env.DB.prepare("DELETE FROM tasking_board_members WHERE board_id = ?").bind(boardId),
      c.env.DB.prepare("DELETE FROM tasking_boards WHERE id = ?").bind(boardId),
    ]);
    await Promise.all(files.results.map(f => c.env.TASKING_BUCKET.delete(f.stored_name)));
    return c.json({ deleted: 1 });
  });

  // ---------- Board Members ----------
  app.get("/api/tareas/boards/:boardId/members", async c => {
    const identity_id = c.get("identity_id");
    const boardId = c.req.param("boardId");
    if (!(await membership(c.env.DB, boardId, identity_id))) return c.json({ error: "Sin acceso a este tablero." }, 403);
    const rows = await c.env.DB.prepare(`
      SELECT bm.identity_id, u.contact_email, bm.role, u.name, u.avatar_emoji, u.avatar_color, u.avatar_photo
      FROM tasking_board_members bm LEFT JOIN tasking_presentations u ON u.identity_id = bm.identity_id
      WHERE bm.board_id = ? ORDER BY bm.role DESC, bm.identity_id ASC
    `).bind(boardId).all();
    return c.json({
      members: rows.results.map(r => ({
        identity_id: r.identity_id, contactEmail: r.contact_email, role: r.role,
        name: r.name || r.identity_id.split("@")[0],
        avatarEmoji: r.avatar_emoji || null,
        avatarColor: r.avatar_color || null, photoUrl: r.avatar_photo || null,
      })),
    });
  });

  app.post("/api/tareas/boards/:boardId/members", async c => {
    const identity_id = c.get("identity_id");
    const boardId = c.req.param("boardId");
    const m = await membership(c.env.DB, boardId, identity_id);
    if (!m || m.role !== "owner") return c.json({ error: "Solo el dueño puede invitar miembros." }, 403);
    const b = await c.req.json().catch(() => ({}));
    const invited = (b.email || "").trim().toLowerCase();
    if (!invited || !invited.includes("@")) return c.json({ error: "Email inválido." }, 400);
    const invitedId = await ensureUser(c.env.DB, invited);
    await c.env.DB.prepare("INSERT OR IGNORE INTO tasking_board_members (board_id, identity_id, role, created_at) VALUES (?, ?, 'member', ?)")
      .bind(boardId, invitedId, now()).run();
    return c.json({ identity_id: invitedId, role: "member" });
  });

  app.delete("/api/tareas/boards/:boardId/members/:identity_id", async c => {
    const identity_id = c.get("identity_id");
    const boardId = c.req.param("boardId");
    const target = c.req.param("identity_id").toLowerCase();
    const board = await c.env.DB.prepare("SELECT owner_identity_id FROM tasking_boards WHERE id = ?").bind(boardId).first();
    if (!board) return c.json({ error: "No existe el tablero." }, 404);
    if (board.owner_identity_id !== identity_id) return c.json({ error: "Solo el dueño puede quitar miembros." }, 403);
    if (target === board.owner_identity_id) return c.json({ error: "No se puede quitar al dueño." }, 400);
    await c.env.DB.prepare("DELETE FROM tasking_board_members WHERE board_id = ? AND identity_id = ?").bind(boardId, target).run();
    return c.json({ removed: target });
  });

  // ---------- Board Activity ----------
  app.get("/api/tareas/boards/:boardId/activity", async c => {
    const identity_id = c.get("identity_id");
    const boardId = c.req.param("boardId");
    if (!(await membership(c.env.DB, boardId, identity_id))) return c.json({ error: "Sin acceso a este tablero." }, 403);
    const q = c.req.query();
    const conditions = ["al.board_id = ?"];
    const binds = [boardId];
    if (q.user)  { conditions.push("al.identity_id = ?");  binds.push(q.user); }
    if (q.from)  { conditions.push("al.ts >= ?");    binds.push(Number(q.from)); }
    if (q.to)    { conditions.push("al.ts <= ?");    binds.push(Number(q.to)); }
    const lim = Math.min(parseInt(q.limit) || 100, 500);
    const rows = await c.env.DB.prepare(`SELECT al.id, al.card_id, al.action, al.identity_id, al.ts, al.details,
         c.title AS card_title, u.name AS author_name, u.avatar_emoji, u.avatar_color, u.avatar_photo
       FROM tasking_audit_log al
       LEFT JOIN tasking_cards c ON c.id = al.card_id
       LEFT JOIN tasking_presentations u ON u.identity_id = al.identity_id
       WHERE ${conditions.join(" AND ")} ORDER BY al.ts DESC LIMIT ${lim}`).bind(...binds).all();
    return c.json({ activity: rows.results.map(auditRowToJSON) });
  });
}
