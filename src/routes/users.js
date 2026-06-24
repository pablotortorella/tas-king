// ---------- Routes: Users ----------

export function setupUserRoutes(app) {
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

    let pendingCount = 0;
    if (user?.is_admin) {
      try {
        const p = await c.env.DB.prepare("SELECT COUNT(*) as n FROM pending_access WHERE seen = 0").first();
        pendingCount = p?.n || 0;
      } catch (_) { /* tabla puede no existir en entornos viejos */ }
    }

    return c.json({
      email,
      isAdmin: !!(user && user.is_admin),
      pendingCount,
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
}
