// ---------- DB Helpers: Columnas ----------

const uid = () => crypto.randomUUID();
const now = () => Date.now();

// IDs fijos para las columnas por defecto — coinciden con los valores históricos
// de column_id en las tarjetas existentes y en las migraciones previas.
export const DEFAULT_COLUMNS = [
  { id: "por_conversar", name: "Por conversar", position: 1, is_done: 0 },
  { id: "pendiente",     name: "Pendiente",     position: 2, is_done: 0 },
  { id: "en_progreso",   name: "En progreso",   position: 3, is_done: 0 },
  { id: "por_revisar",   name: "Por revisar",   position: 4, is_done: 0 },
  { id: "terminado",     name: "Terminado",     position: 5, is_done: 1 },
];

export function columnToJSON(c) {
  return { id: c.id, name: c.name, position: c.position, isDone: !!c.is_done };
}

export async function createDefaultColumns(db, boardId) {
  const stmts = DEFAULT_COLUMNS.map(col =>
    db.prepare("INSERT OR IGNORE INTO columns (id, board_id, name, position, is_done, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(col.id, boardId, col.name, col.position, col.is_done, now())
  );
  await db.batch(stmts);
}

export async function getDoneColumnIds(db, boardId) {
  const rows = await db.prepare(
    "SELECT id FROM columns WHERE board_id = ? AND is_done = 1"
  ).bind(boardId).all();
  if (rows.results.length > 0) return rows.results.map(r => r.id);
  const last = await db.prepare(
    "SELECT id FROM columns WHERE board_id = ? ORDER BY position DESC LIMIT 1"
  ).bind(boardId).first();
  return last ? [last.id] : ["terminado"];
}

export async function getColumnName(db, boardId, columnId) {
  const col = await db.prepare(
    "SELECT name FROM columns WHERE board_id = ? AND id = ?"
  ).bind(boardId, columnId).first();
  return col ? col.name : columnId;
}

// Nombre de la columna si existe en ese tablero; null si no existe o el id no es
// un texto. A diferencia de getColumnName (que cae al id para mostrar en la
// auditoría), sirve para validar y devuelve el nombre en la misma consulta.
export async function findColumnName(db, boardId, columnId) {
  if (typeof columnId !== "string" || !columnId) return null;
  const col = await db.prepare(
    "SELECT name FROM columns WHERE board_id = ? AND id = ?"
  ).bind(boardId, columnId).first();
  return col ? col.name : null;
}

// Ids de las columnas del tablero, de izquierda a derecha.
export async function getColumnIds(db, boardId) {
  const rows = await db.prepare(
    "SELECT id FROM columns WHERE board_id = ? ORDER BY position ASC"
  ).bind(boardId).all();
  return rows.results.map(r => r.id);
}
