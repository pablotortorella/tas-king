import { createPlatformId } from "../platform.js";
import { ACTION_LABELS, TOOL_LABELS } from "../usage-catalog.js";
import { TOOLS } from "../usage.js";
import { colombiaDay, isPeriodKey, nextPeriod, periodDays, periodKey, periodRange, previousPeriod } from "../usage-periods.js";
import { ownerIds } from "./access.js";

// Datos de las pestañas de la consola (design.md D9 a D11). Ninguna consulta lee contenido de grupos, movimientos, tableros ni tarjetas.

// Tipos de período que se eligen en la pestaña Suite (sin «día»: el día se ve en la serie).
export const SUITE_PERIODS = Object.freeze({ semana: "week", mes: "month", trimestre: "quarter", anio: "year" });
export const PERIOD_NAMES = Object.freeze({ week: "Semana", month: "Mes", quarter: "Trimestre", year: "Año" });
const SERIES_LENGTH = 12;

// Período pedido por la URL (?periodo=mes&clave=2026-11). Lo inválido vuelve al mes en curso; lo futuro, al período en curso.
export function selectedPeriod(query = {}, today = colombiaDay()) {
  const type = SUITE_PERIODS[query.periodo] ?? "month";
  const current = periodKey(type, today);
  const key = isPeriodKey(type, query.clave) && periodRange(type, query.clave).start <= today ? query.clave : current;
  const tool = TOOLS.includes(query.herramienta) ? query.herramienta : null;
  const end = periodRange(type, key).end;
  const anchor = end < today ? end : today;
  const anchorKeys = Object.fromEntries(Object.values(SUITE_PERIODS).map((other) => [other, periodKey(other, anchor)]));
  const nextKey = nextPeriod(type, key);
  return { type, key, tool, today, isCurrent: key === current, previousKey: previousPeriod(type, key), nextKey, hasNext: periodRange(type, nextKey).start <= today, anchorKeys };
}

async function peopleFor(db, type, keys) {
  if (!keys.length) return new Map();
  const { results } = await db.prepare(`SELECT period_key, tool, level, people FROM usage_period_people WHERE period_type = ? AND period_key IN (${keys.map(() => "?").join(",")})`).bind(type, ...keys).all();
  return new Map(results.map((row) => [`${row.period_key}|${row.tool}|${row.level}`, row.people]));
}

export async function suiteData(db, period) {
  const { type, key } = period;
  const { start, end } = periodRange(type, key);
  const previous = previousPeriod(type, key);
  const seriesKeys = [];
  for (let current = key; seriesKeys.length < SERIES_LENGTH; current = previousPeriod(type, current)) seriesKeys.unshift(current);
  const [snapshots, people, counts] = await Promise.all([
    db.prepare("SELECT day, accounts, active_1d, active_7d, active_30d FROM usage_suite_snapshots WHERE day BETWEEN ? AND ? ORDER BY day").bind(start, end).all(),
    peopleFor(db, type, [...new Set([key, previous, ...seriesKeys])]),
    db.prepare("SELECT tool, action, SUM(count) AS total FROM usage_daily_counts WHERE day BETWEEN ? AND ? GROUP BY tool, action").bind(start, end).all(),
  ]);
  const value = (periodKeyValue, tool, level) => people.get(`${periodKeyValue}|${tool}|${level}`) ?? null;
  // La diferencia se calcula si el período anterior tiene alguna medición de la suite (una herramienta sin uso cuenta 0); si el anterior
  // es previo a la publicación, no hay con qué comparar.
  const previousMeasured = TOOLS.some((tool) => value(previous, tool, "entro") !== null);
  const tools = TOOLS.map((tool) => {
    const entro = value(key, tool, "entro") ?? 0;
    const hizo = value(key, tool, "hizo") ?? 0;
    return {
      tool, label: TOOL_LABELS[tool], entro, hizo,
      ratio: entro ? hizo / entro : null,
      diffEntro: previousMeasured ? entro - (value(previous, tool, "entro") ?? 0) : null,
      diffHizo: previousMeasured ? hizo - (value(previous, tool, "hizo") ?? 0) : null,
      hasPrevious: previousMeasured,
    };
  });
  const totals = new Map(counts.results.map((row) => [`${row.tool}|${row.action}`, row.total]));
  const actions = TOOLS.map((tool) => ({
    tool, label: TOOL_LABELS[tool],
    rows: Object.entries(ACTION_LABELS[tool]).map(([action, label]) => ({ action, label, total: totals.get(`${tool}|${action}`) ?? 0 })),
  }));
  const series = period.tool ? seriesKeys.map((periodKeyValue) => ({ key: periodKeyValue, entro: value(periodKeyValue, period.tool, "entro"), hizo: value(periodKeyValue, period.tool, "hizo") })) : null;
  const latest = snapshots.results.at(-1) ?? null;
  const hasData = snapshots.results.length > 0 || counts.results.length > 0 || tools.some((row) => row.entro || row.hizo);
  return { period, start, end, previous, days: periodDays(type, key), snapshots: snapshots.results, latest, tools, actions, series, hasData };
}

// Pestaña Tareas: totales y lista de cuentas con nombre y correo; el ranking por persona, sólo para dueños (design.md D10).
export async function tareasData(db, { includeRanking }) {
  const statements = [
    db.prepare("SELECT COUNT(*) AS count FROM tasking_identities"),
    db.prepare("SELECT COUNT(*) AS count FROM tasking_boards"),
    db.prepare("SELECT COUNT(*) AS count FROM tasking_cards WHERE archived = 0"),
    db.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(size), 0) AS totalSize FROM tasking_attachments"),
    db.prepare("SELECT i.identity_id AS identityId, COALESCE(NULLIF(p.name, ''), NULLIF(i.name, ''), u.display_name, '') AS name, COALESCE(u.email, i.legacy_email) AS email, i.user_id IS NOT NULL AS linked FROM tasking_identities i LEFT JOIN tasking_presentations p ON p.identity_id = i.identity_id LEFT JOIN users u ON u.id = i.user_id ORDER BY lower(COALESCE(u.email, i.legacy_email))"),
  ];
  if (includeRanking) statements.push(db.prepare("SELECT i.identity_id AS identityId, p.name, COUNT(DISTINCT b.id) AS boards, COUNT(DISTINCT c.id) AS cards, COUNT(DISTINCT cm.id) AS comments FROM tasking_identities i JOIN tasking_presentations p ON p.identity_id = i.identity_id LEFT JOIN tasking_boards b ON b.owner_identity_id = i.identity_id LEFT JOIN tasking_cards c ON c.board_id = b.id LEFT JOIN tasking_comments cm ON cm.author_identity_id = i.identity_id GROUP BY i.identity_id ORDER BY cards DESC LIMIT 10"));
  const rows = await db.batch(statements);
  const data = {
    totals: { accounts: rows[0].results[0].count, boards: rows[1].results[0].count, cards: rows[2].results[0].count, files: rows[3].results[0].count, filesSize: rows[3].results[0].totalSize },
    accounts: rows[4].results.map((row) => ({ ...row, linked: Boolean(row.linked) })),
  };
  if (includeRanking) data.ranking = rows[5].results.map((row) => ({ ...row, activity: row.boards + row.cards + row.comments }));
  return data;
}

// Pestaña Administradores: dueños (del secreto), roles vigentes, historial de roles y últimas entradas a la consola.
export async function adminData(db, env) {
  const owners = ownerIds(env);
  const [ownerRows, roles, history, entries] = await Promise.all([
    owners.length ? db.prepare(`SELECT id, display_name AS name, email FROM users WHERE id IN (${owners.map(() => "?").join(",")}) ORDER BY display_name`).bind(...owners).all() : { results: [] },
    db.prepare("SELECT r.user_id AS userId, r.scope, r.granted_at AS grantedAt, u.display_name AS name, u.email, g.display_name AS grantedBy FROM platform_roles r JOIN users u ON u.id = r.user_id LEFT JOIN users g ON g.id = r.granted_by ORDER BY r.scope, lower(u.email)").all(),
    db.prepare("SELECT e.action, e.created_at AS createdAt, e.metadata_json AS metadata, a.display_name AS actor, t.display_name AS target, t.email AS targetEmail FROM platform_audit_events e LEFT JOIN users a ON a.id = e.actor_user_id LEFT JOIN users t ON t.id = e.entity_id WHERE e.action IN ('platform_role_granted', 'platform_role_revoked') ORDER BY e.created_at DESC, e.rowid DESC LIMIT 50").all(),
    db.prepare("SELECT e.created_at AS createdAt, e.entity_id AS day, e.metadata_json AS metadata, a.display_name AS actor FROM platform_audit_events e LEFT JOIN users a ON a.id = e.actor_user_id WHERE e.action = 'console_opened' ORDER BY e.created_at DESC, e.rowid DESC LIMIT 20").all(),
  ]);
  const parse = (text) => { try { return JSON.parse(text); } catch { return {}; } };
  return {
    owners: ownerRows.results,
    roles: roles.results,
    history: history.results.map((row) => ({ ...row, scope: parse(row.metadata).scope ?? null })),
    entries: entries.results.map((row) => ({ ...row, tab: parse(row.metadata).tab ?? null })),
  };
}

// ---- Auditoría (D11): sólo identificadores, nunca correos ----

export async function auditConsoleOpened(db, { userId, tab, now = new Date() }) {
  const day = colombiaDay(now);
  await db.prepare("INSERT OR IGNORE INTO platform_audit_events (id, actor_user_id, action, entity_type, entity_id, metadata_json) VALUES (?, ?, 'console_opened', 'console', ?, ?)")
    .bind(`console_opened_${userId}_${day}`, userId, day, JSON.stringify({ tab })).run();
}

export async function auditAccountsViewed(db, { userId, tool }) {
  await db.prepare("INSERT INTO platform_audit_events (id, actor_user_id, action, entity_type, entity_id, metadata_json) VALUES (?, ?, 'console_accounts_viewed', 'console', ?, ?)")
    .bind(createPlatformId("audit"), userId, colombiaDay(), JSON.stringify({ tool })).run();
}

// Dar o quitar un rol, con su auditoría en el mismo batch. Devuelve false si no cambió nada (ya lo tenía, o no lo tenía).
export async function setRole(db, { actorUserId, userId, scope, grant }) {
  const existing = await db.prepare("SELECT 1 AS found FROM platform_roles WHERE user_id = ? AND scope = ?").bind(userId, scope).first();
  if (Boolean(existing) === grant) return false;
  const change = grant
    ? db.prepare("INSERT INTO platform_roles (user_id, scope, granted_by) VALUES (?, ?, ?)").bind(userId, scope, actorUserId)
    : db.prepare("DELETE FROM platform_roles WHERE user_id = ? AND scope = ?").bind(userId, scope);
  const audit = db.prepare("INSERT INTO platform_audit_events (id, actor_user_id, action, entity_type, entity_id, metadata_json) VALUES (?, ?, ?, 'user', ?, ?)")
    .bind(createPlatformId("audit"), actorUserId, grant ? "platform_role_granted" : "platform_role_revoked", userId, JSON.stringify({ scope }));
  await db.batch([change, audit]);
  return true;
}
