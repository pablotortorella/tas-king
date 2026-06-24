// ---------- Database Helpers ----------

const uid = () => crypto.randomUUID();
const now = () => Date.now();

export async function ensureUser(db, email) {
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

export async function membership(db, boardId, email) {
  return db.prepare("SELECT role FROM board_members WHERE board_id = ? AND email = ?").bind(boardId, email).first();
}

export async function isEmailAllowed(db, email, legacySecret) {
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

export async function seedAdminIfNeeded(db, email, adminEmailsSecret) {
  if (!adminEmailsSecret) return;
  const admins = adminEmailsSecret.toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
  if (admins.includes(email)) {
    await db.prepare("UPDATE users SET is_admin = 1 WHERE email = ? AND is_admin = 0").bind(email).run();
  }
}

export async function logEvent(db, boardId, cardId, action, email, details = {}) {
  await db.prepare(
    "INSERT INTO audit_log (id, board_id, card_id, action, email, ts, details) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(uid(), boardId, cardId || null, action, email, now(), JSON.stringify(details)).run();
}
