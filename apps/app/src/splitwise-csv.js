import Papa from "papaparse";
import { CURRENCY_MINOR_UNITS, normalizeCurrency } from "./finance.js";

export class SplitwiseCsvError extends Error {}

function normalized(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/gu, "").trim().toLowerCase();
}

export function parseSignedMinor(raw, currency) {
  const units = CURRENCY_MINOR_UNITS[normalizeCurrency(currency)];
  const text = String(raw ?? "").trim();
  if (units === undefined || (text && !/^[+-]?\d+(?:[.,]\d+)?$/u.test(text))) throw new SplitwiseCsvError("Importe inválido para la moneda.");
  if (!text) return 0;
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace(/^[+-]/u, "").replace(",", ".").split(".");
  if (fraction.length > units) throw new SplitwiseCsvError("Demasiados decimales para la moneda.");
  const value = BigInt(whole) * 10n ** BigInt(units) + BigInt(fraction.padEnd(units, "0") || "0");
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new SplitwiseCsvError("Importe fuera de rango.");
  return Number(negative ? -value : value);
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseMovement(cells, participantNames, line, fallbackCurrency = null) {
  const [dateRaw, descriptionRaw, categoryRaw, costRaw, currencyRaw, ...effectRaw] = cells;
  const occurredAt = String(dateRaw ?? "").trim();
  if (!validDate(occurredAt)) throw new SplitwiseCsvError("Fecha inválida.");
  const description = String(descriptionRaw ?? "").trim();
  if (!description || description.length > 240) throw new SplitwiseCsvError("Descripción vacía o demasiado larga.");
  const category = String(categoryRaw ?? "").trim();
  if (category.length > 120) throw new SplitwiseCsvError("Categoría demasiado larga.");
  const currency = normalizeCurrency(String(currencyRaw ?? "").trim() || fallbackCurrency);
  if (!currency) throw new SplitwiseCsvError(currencyRaw ? "Moneda no soportada." : "Falta la moneda.");
  if (effectRaw.length !== participantNames.length) throw new SplitwiseCsvError("La cantidad de columnas no coincide con el encabezado.");
  const totalMinor = parseSignedMinor(costRaw, currency);
  if (totalMinor < 0) throw new SplitwiseCsvError("El coste no puede ser negativo.");
  const effects = effectRaw.map((raw, index) => ({ sourceName: participantNames[index], amountMinor: parseSignedMinor(raw, currency) }));
  const sum = effects.reduce((total, effect) => total + BigInt(effect.amountMinor), 0n);
  if (sum !== 0n) throw new SplitwiseCsvError("Los efectos de la fila no suman cero.");
  if (totalMinor === 0 && effects.every(effect => effect.amountMinor === 0)) throw new SplitwiseCsvError("Fila sin importe ni efecto.");
  return { line, occurredAt, description, category, currency, totalMinor, effects };
}

const SUMMARY_LABEL = /^(total balance|balance total|saldo total|balance|saldo|balances|saldos)$/u;
const SUMMARY_LABEL_AFTER_DATE = /^(total balance|balance total|saldo total|balance|saldo)$/u;

// El resumen viene de tres formas: la etiqueta en la primera celda (fixture), la etiqueta en la segunda con la
// primera vacía, y la del export real, con la fecha de exportación en la primera celda, la etiqueta en la
// segunda y sin coste. Un movimiento llamado «Saldo» pero con coste no es un resumen.
function isSummary(cells) {
  const first = normalized(cells[0]);
  const second = normalized(cells[1]);
  if (SUMMARY_LABEL.test(first)) return true;
  if (!first && SUMMARY_LABEL_AFTER_DATE.test(second)) return true;
  return validDate(String(cells[0] ?? "").trim()) && SUMMARY_LABEL_AFTER_DATE.test(second) && !normalized(cells[3]);
}

export function parseSplitwiseCsv(text) {
  if (typeof text !== "string" || !text.trim()) throw new SplitwiseCsvError("Seleccioná un CSV no vacío.");
  const source = text.replace(/^\uFEFF/u, "");
  const records = [];
  let previousCursor = 0;
  let nextLine = 1;
  Papa.parse(source, {
    skipEmptyLines: "greedy",
    step(result) {
      const line = nextLine;
      const consumed = source.slice(previousCursor, result.meta.cursor);
      nextLine += (consumed.match(/\n/gu) ?? []).length;
      previousCursor = result.meta.cursor;
      records.push({ line, cells: result.data, errors: result.errors });
    },
  });
  if (!records.length) throw new SplitwiseCsvError("El CSV no contiene filas.");
  const header = records.shift().cells.map((cell, index) => index === 0 ? String(cell).replace(/^\uFEFF/u, "").trim() : String(cell).trim());
  const expected = [
    ["fecha", "date"], ["descripcion", "description"], ["categoria", "category"],
    ["coste", "costo", "cost"], ["moneda", "currency"],
  ];
  if (header.length < 7 || expected.some((choices, index) => !choices.includes(normalized(header[index])))) {
    throw new SplitwiseCsvError("El encabezado no corresponde a una exportación CSV de Splitwise.");
  }
  const participantNames = header.slice(5);
  if (participantNames.some(name => !name || name.length > 120) || new Set(participantNames.map(normalized)).size !== participantNames.length) {
    throw new SplitwiseCsvError("Las columnas de participantes deben tener nombres únicos.");
  }
  const movements = [];
  const incidents = [];
  const summaries = [];
  for (const record of records) {
    if (isSummary(record.cells)) {
      summaries.push({ line: record.line, currency: normalizeCurrency(record.cells[4]), rawEffects: participantNames.map((name, index) => ({ sourceName: name, raw: record.cells[index + 5] ?? "" })) });
      continue;
    }
    if (record.errors.length) {
      incidents.push({ line: record.line, reason: "CSV mal formado.", code: "malformed", cells: record.cells });
      continue;
    }
    try { movements.push(parseMovement(record.cells, participantNames, record.line)); }
    catch (error) {
      if (!(error instanceof SplitwiseCsvError)) throw error;
      const missingCurrency = error.message === "Falta la moneda.";
      incidents.push({ line: record.line, reason: error.message, code: missingCurrency ? "missing_currency" : "invalid_row", cells: record.cells });
    }
  }
  if (!movements.length && !incidents.length) throw new SplitwiseCsvError("No se encontraron movimientos.");
  return { participantNames, movements, incidents, summaries, totalRows: records.length };
}
