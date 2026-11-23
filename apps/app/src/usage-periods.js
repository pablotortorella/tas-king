// Períodos de calendario de la estadística de uso (change consola-administracion-homesuite, design.md D6). Módulo puro, sin base ni red.
// El día es el de Colombia: UTC−5 todo el año, sin horario de verano (igual que las fechas de los textos legales).
//
// | Período    | Clave       | Ejemplo                       |
// | día        | AAAA-MM-DD  | 2026-11-22                    |
// | semana ISO | AAAA-Www    | el 2026-12-31 da 2026-W53     |
// | mes        | AAAA-MM     | 2026-11                       |
// | trimestre  | AAAA-Qn     | 2026-Q4                       |
// | año        | AAAA        | 2026                          |

export const PERIOD_TYPES = Object.freeze(["day", "week", "month", "quarter", "year"]);
const COLOMBIA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (value, size = 2) => String(value).padStart(size, "0");
const isoDay = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
// Un día AAAA-MM-DD como medianoche UTC: sirve sólo para aritmética de calendario.
const asDate = (day) => new Date(`${day}T00:00:00Z`);
const addDays = (day, days) => isoDay(new Date(asDate(day).getTime() + days * DAY_MS));

export function colombiaDay(now = new Date()) {
  const ms = now instanceof Date ? now.getTime() : now;
  return isoDay(new Date(ms - COLOMBIA_OFFSET_MS));
}

// Semana ISO 8601: empieza el lunes y pertenece al año de su jueves.
function isoWeek(day) {
  const date = asDate(day);
  const weekday = date.getUTCDay() || 7;
  const thursday = new Date(date.getTime() + (4 - weekday) * DAY_MS);
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1;
  return { year, week };
}

export function periodKey(type, day) {
  const [year, month] = day.split("-").map(Number);
  if (type === "day") return day;
  if (type === "week") { const iso = isoWeek(day); return `${iso.year}-W${pad(iso.week)}`; }
  if (type === "month") return day.slice(0, 7);
  if (type === "quarter") return `${year}-Q${Math.ceil(month / 3)}`;
  if (type === "year") return String(year);
  throw new Error(`Tipo de período desconocido: ${type}`);
}

export function periodKeys(day) {
  return Object.fromEntries(PERIOD_TYPES.map((type) => [type, periodKey(type, day)]));
}

const KEY_PATTERNS = Object.freeze({
  day: /^(\d{4})-(\d{2})-(\d{2})$/u,
  week: /^(\d{4})-W(\d{2})$/u,
  month: /^(\d{4})-(\d{2})$/u,
  quarter: /^(\d{4})-Q([1-4])$/u,
  year: /^(\d{4})$/u,
});

// Primer y último día (inclusive) de un período.
export function periodRange(type, key) {
  const match = KEY_PATTERNS[type]?.exec(key);
  if (!match) throw new Error(`Clave de período inválida: ${type} ${key}`);
  const year = Number(match[1]);
  if (type === "day") {
    if (isoDay(asDate(key)) !== key) throw new Error(`Día inválido: ${key}`);
    return { start: key, end: key };
  }
  if (type === "week") {
    const week = Number(match[2]);
    // El 4 de enero siempre cae en la semana 1 del año ISO.
    const jan4 = `${year}-01-04`;
    const monday = addDays(jan4, 1 - (asDate(jan4).getUTCDay() || 7));
    const start = addDays(monday, (week - 1) * 7);
    if (week < 1 || isoWeek(start).year !== year) throw new Error(`Semana inválida: ${key}`);
    return { start, end: addDays(start, 6) };
  }
  if (type === "month") {
    const month = Number(match[2]);
    if (month < 1 || month > 12) throw new Error(`Mes inválido: ${key}`);
    return { start: `${key}-01`, end: isoDay(new Date(Date.UTC(year, month, 0))) };
  }
  if (type === "quarter") {
    const first = (Number(match[2]) - 1) * 3 + 1;
    return { start: `${year}-${pad(first)}-01`, end: isoDay(new Date(Date.UTC(year, first + 2, 0))) };
  }
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export const periodEnd = (type, key) => periodRange(type, key).end;

export function previousPeriod(type, key) {
  return periodKey(type, addDays(periodRange(type, key).start, -1));
}

export function nextPeriod(type, key) {
  return periodKey(type, addDays(periodRange(type, key).end, 1));
}

// Un período está cerrado cuando su último día es anterior a `today`.
export const isClosed = (type, key, today) => periodEnd(type, key) < today;

// Días de un período, en orden.
export function periodDays(type, key) {
  const { start, end } = periodRange(type, key);
  const days = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

export function isPeriodKey(type, key) {
  try { periodRange(type, key); return true; } catch { return false; }
}

export { addDays };
