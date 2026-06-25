// ---------- Routes: Checklists ----------

import { cardWithAccess } from "../db/queries.js";

const uid = () => crypto.randomUUID();
const now = () => Date.now();

async function checklistAccess(c) {
  const id = c.req.param("id");
  const cl = await c.env.DB.prepare("SELECT * FROM checklists WHERE id = ?").bind(id).first();
  if (!cl) return { error: c.json({ error: "No existe el checklist." }, 404) };
  // Reusar la lógica de acceso a la tarjeta
  const orig = c.req.param;
  c.req.param = (k) => k === "id" ? cl.card_id : orig.call(c.req, k);
  const { card, error } = await cardWithAccess(c);
  c.req.param = orig;
  if (error) return { error };
  return { cl, card };
}

async function itemAccess(c) {
  const id = c.req.param("id");
  const item = await c.env.DB.prepare("SELECT * FROM checklist_items WHERE id = ?").bind(id).first();
  if (!item) return { error: c.json({ error: "No existe el ítem." }, 404) };
  const cl = await c.env.DB.prepare("SELECT * FROM checklists WHERE id = ?").bind(item.checklist_id).first();
  if (!cl) return { error: c.json({ error: "No existe el checklist." }, 404) };
  const orig = c.req.param;
  c.req.param = (k) => k === "id" ? cl.card_id : orig.call(c.req, k);
  const { card, error } = await cardWithAccess(c);
  c.req.param = orig;
  if (error) return { error };
  return { item, cl, card };
}

export function setupChecklistRoutes(app) {
  // POST /api/cards/:id/checklists — crear checklist en una tarjeta
  app.post("/api/cards/:id/checklists", async c => {
    const { card, error } = await cardWithAccess(c);
    if (error) return error;
    const { name } = await c.req.json().catch(() => ({}));
    const maxPos = await c.env.DB.prepare(
      "SELECT MAX(position) as m FROM checklists WHERE card_id = ?"
    ).bind(card.id).first();
    const id = uid();
    await c.env.DB.prepare(
      "INSERT INTO checklists (id, card_id, name, position, created_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, card.id, (name || "Lista de tareas").trim(), (maxPos?.m ?? -1) + 1, now()).run();
    return c.json({ id, cardId: card.id, name: name || "Lista de tareas", items: [] });
  });

  // PUT /api/checklists/:id — renombrar checklist
  app.put("/api/checklists/:id", async c => {
    const { cl, error } = await checklistAccess(c);
    if (error) return error;
    const { name } = await c.req.json().catch(() => ({}));
    if (!name || !name.trim()) return c.json({ error: "Falta el nombre." }, 400);
    await c.env.DB.prepare("UPDATE checklists SET name = ? WHERE id = ?")
      .bind(name.trim(), cl.id).run();
    return c.json({ ...cl, name: name.trim() });
  });

  // DELETE /api/checklists/:id — eliminar checklist (y sus ítems por CASCADE)
  app.delete("/api/checklists/:id", async c => {
    const { cl, error } = await checklistAccess(c);
    if (error) return error;
    await c.env.DB.prepare("DELETE FROM checklists WHERE id = ?").bind(cl.id).run();
    return c.json({ deleted: 1 });
  });

  // POST /api/checklists/:id/items — agregar ítem
  app.post("/api/checklists/:id/items", async c => {
    const { cl, error } = await checklistAccess(c);
    if (error) return error;
    const { text } = await c.req.json().catch(() => ({}));
    if (!text || !text.trim()) return c.json({ error: "El ítem está vacío." }, 400);
    const maxPos = await c.env.DB.prepare(
      "SELECT MAX(position) as m FROM checklist_items WHERE checklist_id = ?"
    ).bind(cl.id).first();
    const id = uid();
    await c.env.DB.prepare(
      "INSERT INTO checklist_items (id, checklist_id, text, checked, position, created_at) VALUES (?, ?, ?, 0, ?, ?)"
    ).bind(id, cl.id, text.trim(), (maxPos?.m ?? -1) + 1, now()).run();
    return c.json({ id, checklistId: cl.id, text: text.trim(), checked: false, position: (maxPos?.m ?? -1) + 1 });
  });

  // PUT /api/checklist-items/:id — editar texto, toggle checked, o cambiar posición
  app.put("/api/checklist-items/:id", async c => {
    const { item, error } = await itemAccess(c);
    if (error) return error;
    const b = await c.req.json().catch(() => ({}));
    const text = b.text !== undefined ? String(b.text).trim() : item.text;
    const checked = b.checked !== undefined ? (b.checked ? 1 : 0) : item.checked;
    const position = b.position !== undefined ? b.position : item.position;
    if (!text) return c.json({ error: "El texto no puede estar vacío." }, 400);
    await c.env.DB.prepare(
      "UPDATE checklist_items SET text = ?, checked = ?, position = ? WHERE id = ?"
    ).bind(text, checked, position, item.id).run();
    return c.json({ id: item.id, checklistId: item.checklist_id, text, checked: !!checked, position });
  });

  // DELETE /api/checklist-items/:id — eliminar ítem
  app.delete("/api/checklist-items/:id", async c => {
    const { item, error } = await itemAccess(c);
    if (error) return error;
    await c.env.DB.prepare("DELETE FROM checklist_items WHERE id = ?").bind(item.id).run();
    return c.json({ deleted: 1 });
  });

  // POST /api/checklists/:id/reorder — reordenar ítems
  app.post("/api/checklists/:id/reorder", async c => {
    const { cl, error } = await checklistAccess(c);
    if (error) return error;
    const items = await c.req.json().catch(() => []);
    if (!Array.isArray(items)) return c.json({ error: "Se esperaba array." }, 400);
    const upd = c.env.DB.prepare("UPDATE checklist_items SET position = ? WHERE id = ? AND checklist_id = ?");
    if (items.length) {
      await c.env.DB.batch(items.map((it, i) => upd.bind(it.position ?? i, it.id, cl.id)));
    }
    return c.json({ updated: items.length });
  });
}
