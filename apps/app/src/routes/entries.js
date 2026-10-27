import { renderBalanceExplanation } from "../balance-ui.js";
import { normalizeCurrency } from "../finance.js";
import { LedgerError } from "../errors.js";
import { readLedger, saveEntry, voidEntry } from "../ledger.js";
import { parseEntryForm, renderEntryDetail, renderEntryForm } from "../ledger-ui.js";
import { escapeHtml, noticeFor } from "../ui-parts.js";
import { csrfInput, ledgerFailure, page, signedInUser, signInRequired } from "../route-kit.js";

const html = escapeHtml;


  export const RECENT_TITLES = Object.freeze({ guardado: "Recién agregado", corregido: "Recién corregido", anulado: "Recién anulado" });

// La franja «Recién agregado» existe solo con ?nuevo=<id> de un movimiento de este libro; un identificador ajeno o
// inexistente se ignora, y abrir la lista sin el parámetro no la muestra.
export function recentFor(data, id, kind) {
  if (typeof id !== "string" || !id) return null;
  const entry = data.entries.find(row => row.id === id);
  return entry ? { entry, title: Object.hasOwn(RECENT_TITLES, kind ?? "") ? RECENT_TITLES[kind] : RECENT_TITLES.guardado } : null;
}

// Tras guardar, corregir o anular se vuelve a la lista del libro con un aviso y el movimiento afectado.
export function listAfter(groupId, entryId, notice) {
  return `/groups/${encodeURIComponent(groupId)}?aviso=${notice}&nuevo=${encodeURIComponent(entryId)}#movimientos`;
}

export function registerEntryRoutes(app) {
  app.get("/groups/:groupId/ledger/balance", async (c) => {
    const user = await signedInUser(c);
    if (!user) return signInRequired(c);
    try {
      const data = await readLedger(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id });
      return c.html(page("Por qué", renderBalanceExplanation(data, { groupId: c.req.param("groupId"), userId: user.user_id, currency: c.req.query("moneda") ?? "", personId: c.req.query("persona") ?? "" })));
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.get("/groups/:groupId/ledger/new", async (c) => {
    const user = await signedInUser(c);
    if (!user) return signInRequired(c);
    try {
      const data = await readLedger(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id });
      if (data.ledger.archived_at) throw new LedgerError("El grupo está archivado.", 409);
      const type = ["expense", "income", "transfer"].includes(c.req.query("type")) ? c.req.query("type") : "expense";
      const ids = new Set(data.participants.filter(person => person.active).map(person => person.id));
      const prefill = {
        from: ids.has(c.req.query("from")) ? c.req.query("from") : undefined,
        to: ids.has(c.req.query("to")) ? c.req.query("to") : undefined,
        amount: /^\d{1,15}(?:[.,]\d{1,3})?$/u.test(c.req.query("amount") ?? "") ? c.req.query("amount") : undefined,
        currency: normalizeCurrency(c.req.query("currency")) ?? undefined,
      };
      return c.html(page("Agregar movimiento", renderEntryForm(data, { groupId: c.req.param("groupId"), csrf: await csrfInput(c, user), userId: user.user_id, type, prefill })));
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.post("/groups/:groupId/ledger/entries", async (c) => {
    const user = c.get("protectedUser");
    try {
      const form = await c.req.formData();
      const saved = await saveEntry(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id, input: parseEntryForm(form), idempotencyKey: form.get("idempotencyKey") });
      const location = listAfter(c.req.param("groupId"), saved.id, "guardado");
      return c.req.header("Accept")?.includes("application/json") ? c.json({ ...saved, location }, 201) : c.redirect(location, 303);
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.get("/groups/:groupId/ledger/entries/:entryId", async (c) => {
    const user = await signedInUser(c);
    if (!user) return signInRequired(c);
    try {
      const data = await readLedger(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id });
      const entry = data.entries.find(row => row.id === c.req.param("entryId"));
      if (!entry) throw new LedgerError("Movimiento no encontrado.", 404);
      const revisions = await c.env.DB.prepare("SELECT r.revision, r.action, r.created_at, r.snapshot_json, u.display_name AS actor_name FROM entry_revisions r JOIN users u ON u.id = r.actor_user_id WHERE r.ledger_id = ? AND r.entry_id = ? ORDER BY r.revision").bind(data.ledger.id, entry.id).all();
      return c.html(page(entry.description, noticeFor(c.req.query("aviso")) + renderEntryDetail(entry, data, { groupId: c.req.param("groupId"), userId: user.user_id, revisions: revisions.results })));
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.get("/groups/:groupId/ledger/entries/:entryId/edit", async (c) => {
    const user = await signedInUser(c);
    if (!user) return signInRequired(c);
    try {
      const data = await readLedger(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id });
      const entry = data.entries.find(row => row.id === c.req.param("entryId"));
      if (!entry) throw new LedgerError("Movimiento no encontrado.", 404);
      if (entry.status !== "active" || (data.ledger.role !== "owner" && entry.createdByUserId !== user.user_id)) throw new LedgerError("No podés corregir este movimiento.", 403);
      // El método de reparto y sus datos viven en la instantánea de la revisión vigente (no hay columna propia).
      const revision = await c.env.DB.prepare("SELECT snapshot_json FROM entry_revisions WHERE ledger_id = ? AND entry_id = ? AND revision = ?").bind(data.ledger.id, entry.id, entry.revision).first();
      const split = revision ? JSON.parse(revision.snapshot_json).split ?? null : null;
      return c.html(page("Corregir movimiento", renderEntryForm(data, { groupId: c.req.param("groupId"), csrf: await csrfInput(c, user), userId: user.user_id, entry, split })));
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.post("/groups/:groupId/ledger/entries/:entryId/edit", async (c) => {
    const user = c.get("protectedUser");
    try {
      const form = await c.req.formData();
      const saved = await saveEntry(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id, entryId: c.req.param("entryId"), expectedRevision: Number(form.get("expectedRevision")), input: parseEntryForm(form), idempotencyKey: form.get("idempotencyKey") });
      const location = listAfter(c.req.param("groupId"), saved.id, "corregido");
      return c.req.header("Accept")?.includes("application/json") ? c.json({ ...saved, location }) : c.redirect(location, 303);
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.get("/groups/:groupId/ledger/entries/:entryId/void", async (c) => {
    const user = await signedInUser(c);
    if (!user) return signInRequired(c);
    try {
      const data = await readLedger(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id });
      const entry = data.entries.find(row => row.id === c.req.param("entryId"));
      if (!entry) throw new LedgerError("Movimiento no encontrado.", 404);
      if (entry.status !== "active" || (data.ledger.role !== "owner" && entry.createdByUserId !== user.user_id)) throw new LedgerError("No podés anular este movimiento.", 403);
      const groupPath = `/groups/${encodeURIComponent(c.req.param("groupId"))}`;
      return c.html(page("Anular movimiento", `<p class="eyebrow">Cuentas Claras</p><h1>Anular ${escapeHtml(entry.description)}</h1><p>El movimiento dejará de afectar los saldos y seguirá visible en el historial.</p><form class="ledger-form" method="post" action="${groupPath}/ledger/entries/${encodeURIComponent(entry.id)}/void">${await csrfInput(c, user)}<input type="hidden" name="expectedRevision" value="${entry.revision}"><input type="hidden" name="idempotencyKey" value="${crypto.randomUUID()}"><label>Motivo (opcional)<textarea name="reason" maxlength="1000" rows="2"></textarea></label><div class="form-actions"><button class="button" type="submit">Confirmar anulación</button><a class="button secondary" href="${groupPath}/ledger/entries/${encodeURIComponent(entry.id)}">Cancelar</a></div></form>`));
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.post("/groups/:groupId/ledger/entries/:entryId/void", async (c) => {
    const user = c.get("protectedUser");
    try {
      const form = await c.req.formData();
      await voidEntry(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id, entryId: c.req.param("entryId"), expectedRevision: Number(form.get("expectedRevision")), idempotencyKey: form.get("idempotencyKey"), reason: form.get("reason") });
      return c.redirect(listAfter(c.req.param("groupId"), c.req.param("entryId"), "anulado"), 303);
    } catch (error) { return ledgerFailure(c, error); }
  });
}
