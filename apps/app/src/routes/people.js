import { LedgerError } from "../errors.js";
import { readLedger } from "../ledger.js";
import { applyMerge, previewMerge, renamePerson } from "../people.js";
import { renderMergeChoose, renderMergePreview, renderPeople } from "../people-ui.js";
import { csrfInput, formError, ledgerFailure, page, signedInUser, signInRequired } from "../route-kit.js";
import { noticeFor } from "../ui-parts.js";

// Pantalla de personas del grupo: ver, renombrar y unir. Unir es una vista previa en una página GET (sin escribir) y una
// confirmación POST con una clave que identifica esa confirmación, así volver atrás o hacer doble clic no duplica nada.
export function registerPeopleRoutes(app) {
  const groupHref = c => `/groups/${encodeURIComponent(c.req.param("groupId"))}`;

  app.get("/groups/:groupId/people", async (c) => {
    const user = await signedInUser(c);
    if (!user) return signInRequired(c);
    const group = await c.env.DB.prepare("SELECT s.id, s.name, s.slug, m.role FROM groups s JOIN memberships m ON m.group_id = s.id WHERE (s.id = ? OR s.slug = ?) AND m.user_id = ?").bind(c.req.param("groupId"), c.req.param("groupId"), user.user_id).first();
    if (!group) return c.html(formError("Grupo no encontrado", "No tenés acceso a este grupo.", 404), 404);
    const owner = group.role === "owner";
    const [members, invitations, csrf, data] = await Promise.all([
      c.env.DB.prepare("SELECT m.user_id, u.display_name, m.role FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY m.role DESC, u.display_name").bind(group.id).all(),
      owner ? c.env.DB.prepare("SELECT id, invitee_email, target_participant_id FROM invitations WHERE group_id = ? AND status = 'pending' ORDER BY created_at").bind(group.id).all() : { results: [] },
      csrfInput(c, user),
      readLedger(c.env.DB, { groupId: group.id, userId: user.user_id }),
    ]);
    const body = renderPeople({ data, group, members: members.results, invitations: invitations.results, csrf, owner, userId: user.user_id });
    const content = `${noticeFor(c.req.query("aviso"))}<a class="back-link" href="/groups/${encodeURIComponent(group.slug)}">← Volver al grupo</a><p class="eyebrow">${owner ? "Titular" : "Integrante"} · Cuentas Claras</p><h1>Personas</h1>${body}`;
    return c.html(page("Personas", content, { groupHref: `/groups/${encodeURIComponent(group.slug)}` }));
  });

  app.post("/groups/:groupId/people/:personId/rename", async (c) => {
    const user = c.get("protectedUser");
    try {
      await renamePerson(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id, personId: c.req.param("personId"), name: (await c.req.parseBody()).name });
      return c.redirect(`${groupHref(c)}/people?aviso=persona-renombrada`, 303);
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.get("/groups/:groupId/people/:personId/merge", async (c) => {
    const user = await signedInUser(c);
    if (!user) return signInRequired(c);
    try {
      const data = await readLedger(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id });
      if (data.ledger.role !== "owner") throw new LedgerError("Sólo el titular puede unir personas.", 403);
      if (data.ledger.archived_at) throw new LedgerError("El grupo está archivado.", 409);
      const source = data.participants.find(person => person.id === c.req.param("personId"));
      if (!source) throw new LedgerError("Persona no encontrada.", 404);
      const candidates = data.participants.filter(person => person.id !== source.id && person.active);
      if (!candidates.length) throw new LedgerError("No hay otra persona con quien unirla.", 409);
      return c.html(page("Unir personas", renderMergeChoose({ groupId: c.req.param("groupId"), source, candidates }), { groupHref: groupHref(c) }));
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.get("/groups/:groupId/people/:personId/merge/preview", async (c) => {
    const user = await signedInUser(c);
    if (!user) return signInRequired(c);
    try {
      const preview = await previewMerge(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id, sourceId: c.req.param("personId"), targetId: c.req.query("into") ?? "" });
      const content = renderMergePreview({ groupId: c.req.param("groupId"), csrf: await csrfInput(c, user), preview, key: crypto.randomUUID() });
      return c.html(page("Unir personas", content, { groupHref: groupHref(c) }));
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.post("/groups/:groupId/people/:personId/merge", async (c) => {
    const user = c.get("protectedUser");
    try {
      const form = await c.req.formData();
      await applyMerge(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id, sourceId: c.req.param("personId"), targetId: String(form.get("into") ?? ""), expectedRevision: form.get("expectedRevision"), key: String(form.get("key") ?? "") });
      return c.redirect(`${groupHref(c)}/people?aviso=personas-unidas`, 303);
    } catch (error) { return ledgerFailure(c, error); }
  });
}
