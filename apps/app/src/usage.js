import { colombiaDay, PERIOD_TYPES, periodKeys } from "./usage-periods.js";

// Estadística de uso de HomeSuite (change consola-administracion-homesuite, design.md D2, D4 y D5).
// - Última actividad: una fecha por cuenta, escrita como mucho una vez por día.
// - Conteos diarios de acciones: sin persona, grupo ni tablero.
// - Personas distintas por período: un contador por período y nivel, y marcas HMAC que impiden contar dos veces a la misma persona sin
//   guardar su identificador. Las marcas se borran al cerrar el período (maintenance.js).

export const TOOLS = Object.freeze(["expenses", "tasks", "calm"]);
export const LEVELS = Object.freeze(["entro", "hizo"]);

export function usageSecret(env = {}) {
  return typeof env.USAGE_MARKER_SECRET === "string" && env.USAGE_MARKER_SECRET.length >= 32 ? env.USAGE_MARKER_SECRET : null;
}

const keyCache = new Map();
async function hmacKey(secret) {
  if (!keyCache.has(secret)) keyCache.set(secret, crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]));
  return keyCache.get(secret);
}

const base64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");

// La clave del período entra en el mensaje: las marcas de dos períodos distintos de la misma cuenta no se pueden relacionar (D4).
export async function usageMarker(secret, { userId, periodType, periodKey, tool, level }) {
  if (!secret) throw new Error("UsageMarkerSecretMissing");
  const message = [userId, periodType, periodKey, tool, level].join("|");
  return base64url(await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(message)));
}

// Suma una acción y cuenta a la persona en «entró» (y en «hizo algo» si corresponde) en los cinco períodos. «Hizo algo» cuenta también
// como «entró». La primera vez del día en cada nivel escribe como mucho 5 marcas y 5 contadores en un solo batch (transaccional en D1);
// después sólo la acción. Devuelve false si falta el secreto: sin secreto no se mide.
export async function recordUsage(db, { userId, tool, level, action = null, secret, now = new Date() }) {
  if (!TOOLS.includes(tool) || !LEVELS.includes(level)) throw new Error("UsageCatalogMismatch");
  if (!secret) return false;
  const day = colombiaDay(now);
  const keys = periodKeys(day);
  const statements = [];
  if (action) {
    statements.push(db.prepare("INSERT INTO usage_daily_counts (day, tool, action, count) VALUES (?, ?, ?, 1) ON CONFLICT (day, tool, action) DO UPDATE SET count = count + 1").bind(day, tool, action));
  }
  for (const current of level === "hizo" ? ["entro", "hizo"] : ["entro"]) {
    const dayMarker = await usageMarker(secret, { userId, periodType: "day", periodKey: day, tool, level: current });
    const seen = await db.prepare("SELECT 1 AS seen FROM usage_period_markers WHERE period_type = 'day' AND period_key = ? AND tool = ? AND level = ? AND marker = ?").bind(day, tool, current, dayMarker).first();
    if (seen) continue;
    for (const periodType of PERIOD_TYPES) {
      const periodKey = keys[periodType];
      const marker = periodType === "day" ? dayMarker : await usageMarker(secret, { userId, periodType, periodKey, tool, level: current });
      // El contador sube sólo si la marca todavía no estaba; la marca se escribe después, en el mismo batch. Dos peticiones simultáneas
      // se serializan en D1: la segunda ya encuentra la marca y no suma.
      statements.push(db.prepare("INSERT INTO usage_period_people (period_type, period_key, tool, level, people) SELECT ?, ?, ?, ?, 1 WHERE NOT EXISTS (SELECT 1 FROM usage_period_markers WHERE period_type = ? AND period_key = ? AND tool = ? AND level = ? AND marker = ?) ON CONFLICT (period_type, period_key, tool, level) DO UPDATE SET people = people + 1")
        .bind(periodType, periodKey, tool, current, periodType, periodKey, tool, current, marker));
      statements.push(db.prepare("INSERT OR IGNORE INTO usage_period_markers (period_type, period_key, tool, level, marker) VALUES (?, ?, ?, ?, ?)").bind(periodType, periodKey, tool, current, marker));
    }
  }
  if (statements.length) await db.batch(statements);
  return true;
}

// Última actividad (D2). `lastActiveOn` es la fecha que ya leyó la sesión: si es la de hoy no se escribe nada. La condición del UPDATE
// evita que dos peticiones del mismo día escriban dos veces.
export async function touchLastActive(db, { userId, lastActiveOn, now = new Date() }) {
  const today = colombiaDay(now);
  if (lastActiveOn === today) return false;
  const result = await db.prepare("UPDATE users SET last_active_on = ? WHERE id = ? AND (last_active_on IS NULL OR last_active_on < ?)").bind(today, userId, today).run();
  return (result.meta?.changes ?? 0) > 0;
}
