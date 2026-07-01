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

export async function getDoneColumnId(db, boardId) {
  const col = await db.prepare(
    "SELECT id FROM columns WHERE board_id = ? AND is_done = 1 LIMIT 1"
  ).bind(boardId).first();
  return col ? col.id : "terminado";
}

export async function getColumnName(db, boardId, columnId) {
  const col = await db.prepare(
    "SELECT name FROM columns WHERE board_id = ? AND id = ?"
  ).bind(boardId, columnId).first();
  return col ? col.name : columnId;
}
