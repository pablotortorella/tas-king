import { CATEGORY_ICON_KEYS, FALLBACK_CATEGORY_GROUP, defaultCategoriesJson } from "./category-data.js";
import { LedgerError } from "./errors.js";
import { createPlatformId } from "./platform.js";
import { searchable } from "./text.js";

export class CategoryError extends LedgerError {}

// Sentencia única que copia la lista inicial a un libro. INSERT OR IGNORE sobre (ledger_id, name_key) la vuelve
// idempotente: dos accesos simultáneos al mismo libro anterior no duplican nada.
export function seedCategoriesStatement(db, ledgerId) {
  return db.prepare(`INSERT OR IGNORE INTO ledger_categories (ledger_id, id, name, name_key, group_name, group_key, icon, position)
    SELECT ?, 'category_' || lower(hex(randomblob(12))), json_extract(value, '$.name'), json_extract(value, '$.name_key'), json_extract(value, '$.group_name'), json_extract(value, '$.group_key'), json_extract(value, '$.icon'), json_extract(value, '$.position')
    FROM json_each(?)`).bind(ledgerId, defaultCategoriesJson());
}

function mapRow(row) {
  return { id: row.id, name: row.name, nameKey: row.name_key, group: row.group_name, groupKey: row.group_key, icon: row.icon, position: row.position, status: row.status, mergedInto: row.merged_into };
}

export async function readCategories(db, ledgerId) {
  const query = () => db.prepare("SELECT id, name, name_key, group_name, group_key, icon, position, status, merged_into FROM ledger_categories WHERE ledger_id = ? AND pending_import_batch_id IS NULL ORDER BY position, name_key").bind(ledgerId).all();
  let rows = (await query()).results;
  if (!rows.length && !(await db.prepare("SELECT 1 AS present FROM ledger_categories WHERE ledger_id = ? LIMIT 1").bind(ledgerId).first())) {
    await seedCategoriesStatement(db, ledgerId).run();
    rows = (await query()).results;
  }
  return rows.map(mapRow);
}

// Sigue la cadena de fusiones hasta una categoría vigente. Una cadena con ciclo (que la base impide) se corta sin colgar.
export function resolveCategory(categories, id) {
  const byId = new Map(categories.map(category => [category.id, category]));
  const seen = new Set();
  let current = byId.get(id) ?? null;
  while (current?.mergedInto && !seen.has(current.id)) {
    seen.add(current.id);
    const next = byId.get(current.mergedInto);
    if (!next) break;
    current = next;
  }
  return current;
}

export function findCategoryByName(categories, text) {
  const key = searchable(text);
  return key ? categories.find(category => category.nameKey === key) ?? null : null;
}

export function categoryGroups(categories) {
  const groups = new Map();
  for (const category of categories.filter(row => row.status === "active")) {
    if (!groups.has(category.groupKey)) groups.set(category.groupKey, { key: category.groupKey, name: category.group, categories: [] });
    groups.get(category.groupKey).categories.push(category);
  }
  return [...groups.values()];
}

function cleanName(value) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 60 || !searchable(name)) throw new CategoryError("Ingresá un nombre de hasta 60 caracteres con letras o números.");
  return name;
}

function cleanGroup(value) {
  const group = typeof value === "string" ? value.trim() : "";
  if (!group) return FALLBACK_CATEGORY_GROUP;
  if (group.length > 60 || !searchable(group)) throw new CategoryError("El nombre del grupo es inválido (hasta 60 caracteres).");
  return group;
}

function cleanIcon(value) {
  if (value === undefined || value === null || value === "") return "tag";
  if (!CATEGORY_ICON_KEYS.includes(value)) throw new CategoryError("Ícono inválido.");
  return value;
}

// Si el grupo ya existe (aunque se escriba con otras mayúsculas) se reutiliza su nombre tal como está.
function groupNameFor(categories, group) {
  const key = searchable(group);
  return categories.find(category => category.groupKey === key)?.group ?? group;
}

async function bump(db, ledgerId, userId, action, categoryId) {
  return [
    db.prepare("INSERT INTO ledger_events (id, ledger_id, actor_user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, 'category', ?)").bind(createPlatformId("event"), ledgerId, userId, action, categoryId),
    db.prepare("UPDATE expense_ledgers SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(ledgerId),
  ];
}

// Alta de una categoría. Si el nombre normalizado ya existe devuelve la existente sin crear nada (created: false).
export async function createCategory(db, { ledgerId, userId, name, group, icon }) {
  const displayName = cleanName(name);
  const categories = await readCategories(db, ledgerId);
  const existing = findCategoryByName(categories, displayName);
  if (existing) return { category: resolveCategory(categories, existing.id) ?? existing, created: false, existing };
  const groupName = groupNameFor(categories, cleanGroup(group));
  const id = createPlatformId("category");
  const position = categories.reduce((max, category) => Math.max(max, category.position), 0) + 1;
  try {
    await db.batch([
      db.prepare("INSERT INTO ledger_categories (ledger_id, id, name, name_key, group_name, group_key, icon, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(ledgerId, id, displayName, searchable(displayName), groupName, searchable(groupName), cleanIcon(icon), position),
      ...await bump(db, ledgerId, userId, "category_created", id),
    ]);
  } catch (error) {
    // Otra persona creó el mismo nombre al mismo tiempo: la restricción única decide y se devuelve la ganadora.
    const winner = findCategoryByName(await readCategories(db, ledgerId), displayName);
    if (winner) return { category: winner, created: false, existing: winner };
    if (/UNIQUE/iu.test(String(error?.message))) throw new CategoryError("Hay una importación en curso que usa ese nombre de categoría. Probá de nuevo cuando termine.", 409);
    throw error;
  }
  return { category: { id, name: displayName, nameKey: searchable(displayName), group: groupName, groupKey: searchable(groupName), icon: cleanIcon(icon), position, status: "active", mergedInto: null }, created: true };
}

// Si el movimiento ya tenía una categoría que hoy se lee como la elegida (la misma o una fusionada en ella), se conserva
// el identificador original: corregir otra cosa no debe figurar como un cambio de categoría.
function keepCurrent(categories, currentId, targetId) {
  if (!currentId) return null;
  const current = categories.find(category => category.id === currentId);
  return current && resolveCategory(categories, current.id)?.id === targetId ? current : null;
}

// Elige la categoría de un movimiento a partir del identificador o de un nombre escrito. El nombre se compara por su
// forma normalizada: si existe se usa esa, si no se crea. Una categoría archivada solo se conserva si el movimiento ya la tenía.
export async function categoryForEntry(db, { ledgerId, userId, categoryId, categoryName, currentCategoryId = null }) {
  const categories = await readCategories(db, ledgerId);
  const typed = typeof categoryName === "string" ? categoryName.trim() : "";
  if (typed) {
    const found = findCategoryByName(categories, typed);
    if (!found) return (await createCategory(db, { ledgerId, userId, name: typed })).category;
    const target = resolveCategory(categories, found.id);
    const same = keepCurrent(categories, currentCategoryId, target.id);
    if (same) return same;
    if (target.status !== "active" && target.id !== currentCategoryId) throw new CategoryError("Esa categoría está archivada: elegí otra o pedile al titular que la restaure.", 409);
    return target;
  }
  if (!categoryId) return null;
  const chosen = categories.find(category => category.id === categoryId);
  if (!chosen) throw new CategoryError("La categoría no existe en este libro.");
  if (chosen.id === currentCategoryId) return chosen;
  const same = keepCurrent(categories, currentCategoryId, chosen.id);
  if (same) return same;
  if (chosen.status !== "active") throw new CategoryError("Esa categoría está archivada: elegí otra.", 409);
  return chosen;
}

function assertOwner(ledger) {
  if (ledger.role !== "owner") throw new CategoryError("Sólo el titular puede gestionar las categorías.", 403);
  if (ledger.archived_at) throw new CategoryError("El libro está archivado.", 409);
}

async function loadTarget(db, ledgerId, categoryId) {
  const categories = await readCategories(db, ledgerId);
  const category = categories.find(row => row.id === categoryId);
  if (!category) throw new CategoryError("Categoría no encontrada.", 404);
  return { categories, category };
}

export async function updateCategory(db, { ledger, userId, categoryId, name, group, icon }) {
  assertOwner(ledger);
  const { categories, category } = await loadTarget(db, ledger.id, categoryId);
  const displayName = cleanName(name ?? category.name);
  const clash = findCategoryByName(categories, displayName);
  if (clash && clash.id !== category.id) throw new CategoryError(`Ya existe una categoría llamada «${clash.name}».`, 409);
  const groupName = groupNameFor(categories.filter(row => row.id !== category.id), cleanGroup(group ?? category.group));
  await db.batch([
    db.prepare("UPDATE ledger_categories SET name = ?, name_key = ?, group_name = ?, group_key = ?, icon = ?, updated_at = CURRENT_TIMESTAMP WHERE ledger_id = ? AND id = ?").bind(displayName, searchable(displayName), groupName, searchable(groupName), cleanIcon(icon ?? category.icon), ledger.id, category.id),
    ...await bump(db, ledger.id, userId, "category_updated", category.id),
  ]);
}

export async function setCategoryArchived(db, { ledger, userId, categoryId, archived }) {
  assertOwner(ledger);
  const { category } = await loadTarget(db, ledger.id, categoryId);
  if (category.mergedInto) throw new CategoryError("Esta categoría fue fusionada en otra.", 409);
  await db.batch([
    db.prepare("UPDATE ledger_categories SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE ledger_id = ? AND id = ?").bind(archived ? "archived" : "active", ledger.id, category.id),
    ...await bump(db, ledger.id, userId, archived ? "category_archived" : "category_restored", category.id),
  ]);
}

// Fusiona A en B sin tocar los movimientos: A queda archivada con un alias a B y se lee como B.
export async function mergeCategory(db, { ledger, userId, categoryId, intoId }) {
  assertOwner(ledger);
  const { categories, category } = await loadTarget(db, ledger.id, categoryId);
  if (categoryId === intoId) throw new CategoryError("No se puede fusionar una categoría consigo misma.");
  const target = categories.find(row => row.id === intoId);
  if (!target) throw new CategoryError("La categoría de destino no existe.", 404);
  const final = resolveCategory(categories, target.id);
  if (final.id === category.id) throw new CategoryError("Esa fusión crearía un ciclo.", 409);
  if (final.status !== "active") throw new CategoryError("La categoría de destino está archivada.", 409);
  if (category.mergedInto) throw new CategoryError("Esta categoría ya fue fusionada.", 409);
  await db.batch([
    db.prepare("UPDATE ledger_categories SET status = 'archived', merged_into = ?, updated_at = CURRENT_TIMESTAMP WHERE ledger_id = ? AND id = ?").bind(final.id, ledger.id, category.id),
    ...await bump(db, ledger.id, userId, "category_merged", category.id),
  ]);
}
