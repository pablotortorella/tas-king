#!/usr/bin/env node
// Calculadora de plazos de las solicitudes de datos personales recibidas por correo (Ley 1581 de 2012, arts. 14 y 15).
// Procedimiento: docs/HOMESUITE_SOLICITUDES_DATOS.md. Specs: openspec/changes/politica-y-aceptacion/specs/atencion-de-solicitudes-de-datos.
//
// Uso:  node scripts/solicitudes-plazos.mjs <planilla.csv> [--hoy AAAA-MM-DD] [--festivos <archivo.json>]
// La planilla es PRIVADA y vive fuera del repositorio (este es público): el script sólo la lee. Columnas (encabezados en minúscula, sin tildes):
//   id, tipo (consulta|reclamo), recibido (AAAA-MM-DD), leyenda (fecha de «reclamo en trámite»), prorroga (si|no), respondido (fecha), resultado
// Sólo `id`, `tipo`, `recibido`, `leyenda`, `prorroga` y `respondido` se usan para calcular; `resultado` es para quien lee la planilla.
//
// Cómo se cuenta (todo en días hábiles de Colombia: lunes a viernes sin festivos; ver scripts/festivos-colombia.json):
//   - Consulta: 10 días hábiles. Criterio conservador: el día del recibo cuenta como el primero si es hábil (la ley dice «a partir de la fecha de
//     recibo»). Prórroga: hasta 5 días hábiles más.
//   - Reclamo: 15 días hábiles contados desde el día siguiente al recibo (la ley lo dice así). Prórroga: hasta 8 días hábiles más.
//   - Leyenda «reclamo en trámite»: dentro de 2 días hábiles desde el día siguiente al recibo.
//   - Subsanación: se pide dentro de los 5 días siguientes al recibo; se cuentan como días corridos (criterio conservador: vence antes que 5 hábiles).
//   - Desistimiento: 2 meses sin respuesta de quien reclama a la solicitud de subsanación (se anota; no lo calcula este script).
// Las fechas son de calendario en hora de Colombia (sin hora): se manejan como texto AAAA-MM-DD y se operan en UTC para evitar corrimientos.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

export const PLAZOS = Object.freeze({
  consulta: Object.freeze({ dias: 10, prorroga: 5, desdeElRecibo: true }),
  reclamo: Object.freeze({ dias: 15, prorroga: 8, desdeElRecibo: false }),
});
export const DIAS_LEYENDA = 2;
export const DIAS_SUBSANACION = 5; // corridos
export const UMBRAL_POR_VENCER = 5; // días hábiles que quedan

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO = /^\d{4}-\d{2}-\d{2}$/u;

export function parseIsoDate(text) {
  if (typeof text !== "string" || !ISO.test(text.trim())) return null;
  const date = new Date(`${text.trim()}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text.trim() ? null : date;
}
export const formatIsoDate = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

// ---- Festivos ----

export function loadHolidays(path = fileURLToPath(new URL("./festivos-colombia.json", import.meta.url))) {
  const file = JSON.parse(readFileSync(path, "utf8"));
  const byYear = file["festivos"] ?? {};
  return { years: new Map(Object.entries(byYear).map(([year, days]) => [Number(year), new Set(days)])), verificado: file.verificado === true, fuente: file.fuente ?? "" };
}

// Festivos de Colombia de un año según la Ley 51 de 1983 (Ley Emiliani) y la fecha de Pascua. Sirve para generar y para comprobar el archivo
// configurable; NO está verificado contra el calendario oficial (ver scripts/festivos-colombia.json).
export function festivosColombia(year) {
  const utc = (month, day) => new Date(Date.UTC(year, month - 1, day));
  const toMonday = (date) => addDays(date, (8 - date.getUTCDay()) % 7); // un lunes se queda; cualquier otro día pasa al lunes siguiente
  // Pascua (algoritmo gregoriano anónimo)
  const a = year % 19; const b = Math.floor(year / 100); const c = year % 100;
  const d = Math.floor(b / 4); const e = b % 4; const f = Math.floor((b + 8) / 25); const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30; const i = Math.floor(c / 4); const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7; const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = utc(month, day);
  const days = [
    utc(1, 1), toMonday(utc(1, 6)), toMonday(utc(3, 19)), addDays(easter, -3), addDays(easter, -2), utc(5, 1),
    toMonday(addDays(easter, 39)), toMonday(addDays(easter, 60)), toMonday(addDays(easter, 68)),
    toMonday(utc(6, 29)), utc(7, 20), utc(8, 7), toMonday(utc(8, 15)), toMonday(utc(10, 12)), toMonday(utc(11, 1)), toMonday(utc(11, 11)),
    utc(12, 8), utc(12, 25),
  ];
  return days.map(formatIsoDate).sort();
}

export function isBusinessDay(date, holidays) {
  const weekday = date.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  const known = holidays.years.get(date.getUTCFullYear());
  if (!known) throw new Error(`No hay festivos cargados para ${date.getUTCFullYear()}: agregalos a scripts/festivos-colombia.json antes de calcular.`);
  return !known.has(formatIsoDate(date));
}

// El día `n` hábil contado desde `start`: con countStart el propio `start` es el día 1 si es hábil; si no, el día 1 es el primer hábil posterior.
export function addBusinessDays(start, n, holidays, { countStart = false } = {}) {
  let current = start;
  let counted = 0;
  if (countStart && isBusinessDay(current, holidays)) counted = 1;
  while (counted < n) {
    current = addDays(current, 1);
    if (isBusinessDay(current, holidays)) counted += 1;
  }
  return current;
}

// Días hábiles que le quedan hasta `deadline` (0 si vence hoy; negativo si ya venció, con la cantidad de días hábiles de atraso).
export function businessDaysLeft(today, deadline, holidays) {
  if (formatIsoDate(today) === formatIsoDate(deadline)) return 0;
  const [from, to, sign] = deadline > today ? [today, deadline, 1] : [deadline, today, -1];
  let count = 0;
  for (let cursor = addDays(from, 1); cursor <= to; cursor = addDays(cursor, 1)) if (isBusinessDay(cursor, holidays)) count += 1;
  return sign * count;
}

// ---- Fechas límite de una solicitud ----

export function deadlines({ tipo, recibido }, holidays) {
  const rule = PLAZOS[tipo];
  if (!rule) throw new Error(`Tipo de solicitud desconocido: «${tipo}» (consulta o reclamo).`);
  const received = parseIsoDate(recibido);
  if (!received) throw new Error(`Fecha de recibo inválida: «${recibido}» (AAAA-MM-DD).`);
  const limite = addBusinessDays(received, rule.dias, holidays, { countStart: rule.desdeElRecibo });
  return {
    limite,
    conProrroga: addBusinessDays(limite, rule.prorroga, holidays),
    leyenda: tipo === "reclamo" ? addBusinessDays(received, DIAS_LEYENDA, holidays) : null,
    subsanacion: tipo === "reclamo" ? addDays(received, DIAS_SUBSANACION) : null,
  };
}

const normalizeHeader = (name) => name.normalize("NFD").replace(/[̀-ͯ]/gu, "").trim().toLowerCase();
const yes = (value) => ["si", "s", "sí", "true", "1", "x"].includes(String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/gu, "").trim().toLowerCase());

export function parseRequests(csvText) {
  const parsed = Papa.parse(csvText.trim(), { header: true, skipEmptyLines: true, transformHeader: normalizeHeader });
  return parsed.data.map((row) => ({
    id: (row.id ?? "").trim(), tipo: (row.tipo ?? "").trim().toLowerCase(), recibido: (row.recibido ?? "").trim(),
    leyenda: (row.leyenda ?? "").trim(), prorroga: yes(row.prorroga), respondido: (row.respondido ?? "").trim(),
  }));
}

// Estado de cada solicitud abierta (sin fecha de respuesta) al día `today`: fecha límite vigente (con prórroga si se avisó), días hábiles que
// quedan, si está vencida o por vencer, y si falta la leyenda «reclamo en trámite» pasados 2 días hábiles.
export function evaluate(requests, today, holidays) {
  return requests.filter((request) => !request.respondido).map((request) => {
    const dates = deadlines(request, holidays);
    const vigente = request.prorroga ? dates.conProrroga : dates.limite;
    const left = businessDaysLeft(today, vigente, holidays);
    return {
      id: request.id, tipo: request.tipo, recibido: request.recibido, limite: formatIsoDate(vigente), prorroga: request.prorroga, restantes: left,
      estado: left < 0 ? "vencida" : left <= UMBRAL_POR_VENCER ? "por vencer" : "en plazo",
      leyendaPendiente: request.tipo === "reclamo" && !request.leyenda && today > dates.leyenda,
      leyendaHasta: dates.leyenda ? formatIsoDate(dates.leyenda) : null,
    };
  }).sort((x, y) => x.restantes - y.restantes);
}

export function formatReport(rows, today) {
  if (!rows.length) return `Sin solicitudes abiertas al ${formatIsoDate(today)}.`;
  const lines = rows.map((row) => `${row.id || "(sin id)"}\t${row.tipo}\trecibida ${row.recibido}\tlímite ${row.limite}${row.prorroga ? " (con prórroga)" : ""}\t${row.restantes < 0 ? `vencida hace ${-row.restantes} días hábiles` : `${row.restantes} días hábiles`}\t${row.estado.toUpperCase()}${row.leyendaPendiente ? `\tFALTA la leyenda «reclamo en trámite» (era hasta el ${row.leyendaHasta})` : ""}`);
  const overdue = rows.filter((row) => row.estado === "vencida").length;
  const soon = rows.filter((row) => row.estado === "por vencer").length;
  return [`Solicitudes abiertas al ${formatIsoDate(today)}: ${rows.length} (${overdue} vencidas, ${soon} por vencer con ${UMBRAL_POR_VENCER} días hábiles o menos).`, ...lines].join("\n");
}

// ---- Línea de comandos ----

function cli(argv) {
  const args = argv.slice(2);
  const option = (name) => { const index = args.indexOf(name); return index === -1 ? null : args[index + 1]; };
  const file = args.find((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--hoy" && args[index - 1] !== "--festivos");
  if (!file) { console.error("Uso: node scripts/solicitudes-plazos.mjs <planilla.csv> [--hoy AAAA-MM-DD] [--festivos archivo.json]"); return 2; }
  const today = option("--hoy") ? parseIsoDate(option("--hoy")) : parseIsoDate(new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10));
  if (!today) { console.error("--hoy debe ser una fecha AAAA-MM-DD."); return 2; }
  const holidays = option("--festivos") ? loadHolidays(option("--festivos")) : loadHolidays();
  if (!holidays.verificado) console.error("Aviso: los festivos de scripts/festivos-colombia.json NO están verificados contra el calendario oficial; revisá las fechas antes de confiar en un plazo.");
  console.log(formatReport(evaluate(parseRequests(readFileSync(file, "utf8")), today, holidays), today));
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { process.exitCode = cli(process.argv); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
