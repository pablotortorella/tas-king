import { CATEGORY_ICON_KEYS, CATEGORY_ICON_LABELS, categoryIcon } from "./category-data.js";
import { resolveCategory } from "./categories.js";
import { escapeHtml } from "./ui-parts.js";

function path(spaceId) { return `/spaces/${encodeURIComponent(spaceId)}`; }
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

function iconSelect(selected) {
  return `<label>Ícono<select name="icon">${CATEGORY_ICON_KEYS.map(key => `<option value="${key}"${key === selected ? " selected" : ""}>${escapeHtml(CATEGORY_ICON_LABELS[key])}</option>`).join("")}</select></label>`;
}

// Gestión de las categorías del libro. Cualquier integrante la ve; solo la persona titular puede cambiarlas.
export function renderCategories(data, { spaceId, csrf, owner }) {
  const categories = data.categories ?? [];
  const counts = new Map();
  for (const entry of data.entries) if (entry.categoryId) counts.set(entry.categoryId, (counts.get(entry.categoryId) ?? 0) + 1);
  const base = `${path(spaceId)}/ledger/categories`;
  const writable = owner && !data.ledger.archived_at;
  const active = categories.filter(category => category.status === "active");
  const groupNames = [...new Set(active.map(category => category.group))];
  const targets = category => active.filter(other => other.id !== category.id && resolveCategory(categories, other.id)?.id !== category.id)
    .map(other => `<option value="${escapeHtml(other.id)}">${escapeHtml(other.group)} · ${escapeHtml(other.name)}</option>`).join("");
  const forms = category => {
    if (!writable) return "";
    const id = encodeURIComponent(category.id);
    if (category.mergedInto) return `<p class="muted">Fusionada en «${escapeHtml(resolveCategory(categories, category.id)?.name ?? "otra categoría")}».</p>`;
    const edit = `<form method="post" action="${base}/${id}">${csrf}<label>Nombre<input name="name" required maxlength="60" value="${escapeHtml(category.name)}" autocomplete="off"></label><label>Grupo<input name="group" required maxlength="60" value="${escapeHtml(category.group)}" list="category-groups" autocomplete="off"></label>${iconSelect(category.icon)}<button class="button" type="submit">Guardar</button></form>`;
    const archive = `<form method="post" action="${base}/${id}/${category.status === "active" ? "archive" : "restore"}">${csrf}<button class="button secondary" type="submit">${category.status === "active" ? "Archivar" : "Restaurar"}</button></form>`;
    const merge = category.status === "active" ? `<form method="post" action="${base}/${id}/merge">${csrf}<label>Fusionar en<select name="into" required><option value="">Elegí la categoría de destino</option>${targets(category)}</select></label><button class="button secondary" type="submit">Fusionar</button></form>` : "";
    return `<details><summary>Editar</summary>${edit}${archive}${merge}</details>`;
  };
  const row = category => `<li class="cat-row"><div class="cat-head"><span class="chip cat">${categoryIcon(category.icon)}${escapeHtml(category.name)}</span>${category.status === "archived" ? '<span class="chip">Archivada</span>' : ""}<span class="count">${plural(counts.get(category.id) ?? 0, "movimiento", "movimientos")}</span></div>${forms(category)}</li>`;
  const groups = groupNames.map(name => `<section class="cat-group"><h3>${escapeHtml(name)}</h3><ul class="plain-list">${active.filter(category => category.group === name).map(row).join("")}</ul></section>`).join("");
  const archived = categories.filter(category => category.status === "archived");
  const create = writable ? `<form class="ledger-form" method="post" action="${base}">${csrf}<h2>Nueva categoría</h2><label>Nombre<input name="name" required maxlength="60" autocomplete="off"></label><label>Grupo<input name="group" maxlength="60" list="category-groups" placeholder="Mis categorías" autocomplete="off"></label>${iconSelect("tag")}<div class="form-actions"><button class="button" type="submit">Crear categoría</button></div></form>` : "";
  const datalist = `<datalist id="category-groups">${groupNames.map(name => `<option value="${escapeHtml(name)}"></option>`).join("")}</datalist>`;
  const intro = owner ? "Cada libro tiene su propia lista. Renombrar, reagrupar o fusionar cambia una sola fila: los movimientos no se reescriben."
    : "Estas son las categorías del libro. Solo la persona titular puede renombrarlas, reagruparlas, archivarlas o fusionarlas.";
  return `<a class="back-link" href="${path(spaceId)}">← Volver al libro</a><p class="eyebrow">Cuentas Claras</p><h1>Categorías</h1><p class="hint">${intro}</p>${create}${datalist}<div class="panel">${groups}${archived.length ? `<section class="cat-group"><h3>Archivadas y fusionadas</h3><ul class="plain-list">${archived.map(row).join("")}</ul></section>` : ""}</div>`;
}
