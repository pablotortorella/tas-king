// ---------- Routes: Users ----------

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

// Fecha del día según el navegador de la persona. El día tiene que cambiar a SU
// medianoche, no a la del servidor: con la fecha en UTC, alguien en Argentina
// vería cambiar el tip a las 21:00. Si no llega o viene mal formada, caemos a UTC.
export function hoyDelCliente(valor) {
  return FECHA_RE.test(String(valor || "")) ? String(valor) : new Date().toISOString().slice(0, 10);
}

// Regla de avance del tip diario. Pura, para poder testearla sin base ni red.
// `tipIndex` es un contador monótono de tips vistos, no una posición: el frontend
// resuelve DAILY_TIPS[index % DAILY_TIPS.length], así que el ciclado vive junto
// al catálogo y acá nunca hace falta saber cuántos tips hay.
export function avanzarTip({ tipIndex, tipDate, hoy }) {
  const visto = Number.isInteger(tipIndex) && tipIndex >= 0 ? tipIndex : null;
  // Primera vez: empieza por el primero, sin saltear nada.
  if (visto === null) return { index: 0, date: hoy, guardar: true };
  // Misma jornada: el tip no se mueve, aunque recargue mil veces.
  if (tipDate === hoy) return { index: visto, date: hoy, guardar: false };
  // Otro día: avanza UNO solo, hayan pasado uno o treinta días sin entrar.
  return { index: visto + 1, date: hoy, guardar: true };
}

export function setupUserRoutes(app) {
  app.get("/api/me", async c => {
    const email = c.get("email");
    const [rows, user] = await Promise.all([
      c.env.DB.prepare(`
        SELECT b.id, b.name, b.is_personal, b.owner_email, b.due_soon_days, b.theme, b.theme_prompt_seen, bm.role,
          (SELECT COUNT(*) FROM board_members x WHERE x.board_id = b.id) AS member_count
        FROM boards b
        JOIN board_members bm ON bm.board_id = b.id
        WHERE bm.email = ?
        ORDER BY b.is_personal DESC, b.created_at ASC
      `).bind(email).all(),
      c.env.DB.prepare("SELECT name, avatar_emoji, avatar_color, is_admin, tip_index, tip_date FROM users WHERE email = ?").bind(email).first(),
    ]);

    let pendingCount = 0;
    if (user?.is_admin) {
      try {
        const p = await c.env.DB.prepare("SELECT COUNT(*) as n FROM pending_access WHERE seen = 0").first();
        pendingCount = p?.n || 0;
      } catch (_) { /* tabla puede no existir en entornos viejos */ }
    }

    // Tip diario: se resuelve acá porque el frontend llama /api/me una sola vez al
    // cargar el tablero (no en el polling), así que es a lo sumo un UPDATE por día.
    const tip = avanzarTip({
      tipIndex: user?.tip_index,
      tipDate: user?.tip_date,
      hoy: hoyDelCliente(c.req.query("today")),
    });
    if (tip.guardar) {
      // Si falla, el tip igual se muestra: el avance se recalcula en la próxima carga.
      try {
        await c.env.DB.prepare("UPDATE users SET tip_index = ?, tip_date = ? WHERE email = ?")
          .bind(tip.index, tip.date, email).run();
      } catch (_) { /* no bloquear la carga del tablero por el tip */ }
    }

    return c.json({
      email,
      isAdmin: !!(user && user.is_admin),
      pendingCount,
      tipIndex: tip.index,
      profile: {
        name: (user && user.name) || email.split("@")[0],
        avatarEmoji: (user && user.avatar_emoji) || null,
        avatarColor: (user && user.avatar_color) || null,
      },
      boards: rows.results.map(r => ({
        id: r.id, name: r.name, isPersonal: !!r.is_personal,
        role: r.role, ownerEmail: r.owner_email, memberCount: r.member_count,
        dueSoonDays: r.due_soon_days,
        theme: r.theme, themePromptSeen: !!r.theme_prompt_seen,
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
