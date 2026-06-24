// ---------- Routes: Admin ----------

export function setupAdminRoutes(app) {
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

  // Estadísticas de la plataforma (super admin)
  app.get("/api/admin/stats", async c => {
    const email = c.get("email");
    const user = await c.env.DB.prepare("SELECT is_admin FROM users WHERE email = ?").bind(email).first();
    if (!user?.is_admin) return c.json({ error: "Solo admins pueden ver estadísticas." }, 403);

    const [users, boards, cards, inactive, attachments, userActivity] = await Promise.all([
      c.env.DB.prepare("SELECT COUNT(*) as count FROM users").first(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM boards").first(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM cards WHERE archived = 0").first(),
      c.env.DB.prepare(
        `SELECT u.email, u.name FROM users u
         LEFT JOIN allowed_emails ae ON u.email = ae.email
         WHERE ae.email IS NULL
         ORDER BY u.email ASC`
      ).all(),
      c.env.DB.prepare(
        `SELECT COUNT(*) as fileCount, SUM(size) as totalSize FROM attachments`
      ).first(),
      c.env.DB.prepare(
        `SELECT
          u.email,
          u.name,
          COUNT(DISTINCT b.id) as boardCount,
          COUNT(DISTINCT c.id) as cardCount,
          COUNT(DISTINCT cm.id) as commentCount
        FROM users u
        LEFT JOIN boards b ON u.email = b.owner_email
        LEFT JOIN cards c ON c.board_id = b.id
        LEFT JOIN comments cm ON cm.card_id = c.id
        GROUP BY u.email
        ORDER BY (COUNT(DISTINCT b.id) + COUNT(DISTINCT c.id) + COUNT(DISTINCT cm.id)) DESC
        LIMIT 10`
      ).all(),
    ]);

    const totalUsers = users?.count || 0;
    const inactiveCount = inactive?.results?.length || 0;

    return c.json({
      users: totalUsers,
      activeUsers: totalUsers - inactiveCount,
      inactiveUsers: inactive?.results?.map(r => ({ email: r.email, name: r.name })) || [],
      boards: boards?.count || 0,
      cards: cards?.count || 0,
      files: {
        count: attachments?.fileCount || 0,
        totalSize: attachments?.totalSize || 0,
      },
      topUsers: (userActivity?.results || []).map(r => ({
        email: r.email,
        name: r.name,
        boards: r.boardCount,
        cards: r.cardCount,
        comments: r.commentCount,
        activity: r.boardCount + r.cardCount + r.commentCount,
      })),
      timestamp: new Date().toISOString(),
    });
  });
}
