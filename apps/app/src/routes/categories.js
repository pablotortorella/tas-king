import { createCategory, mergeCategory, setCategoryArchived, updateCategory } from "../categories.js";
import { renderCategories } from "../categories-ui.js";
import { LedgerError } from "../errors.js";
import { getLedgerAccess, readLedger } from "../ledger.js";
import { csrfInput, ledgerFailure, page, signedInUser, signInRequired } from "../route-kit.js";
import { noticeFor } from "../ui-parts.js";

// Pantalla de categorías del libro y su gestión.

export function registerCategoryRoutes(app) {
  app.get("/groups/:groupId/ledger/categories", async (c) => {
    const user = await signedInUser(c);
    if (!user) return signInRequired(c);
    try {
      const data = await readLedger(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id });
      return c.html(page("Categorías", noticeFor(c.req.query("aviso")) + renderCategories(data, { groupId: c.req.param("groupId"), csrf: await csrfInput(c, user), owner: data.ledger.role === "owner" })));
    } catch (error) { return ledgerFailure(c, error); }
  });

  // Gestión de categorías: solo la persona titular. La ruta lo comprueba para todas las acciones y el dominio lo vuelve a
  // exigir (categories.js), así ninguna acción nueva queda abierta por olvido.
  const actions = [
    { path: "", notice: result => (result.created ? "categoria-creada" : "categoria-existente"), run: (db, { ledger, userId }, form) => createCategory(db, { ledgerId: ledger.id, userId, name: form.get("name"), group: form.get("group"), icon: form.get("icon") }) },
    { path: "/:categoryId", notice: () => "categoria-guardada", run: (db, ctx, form, id) => updateCategory(db, { ...ctx, categoryId: id, name: form.get("name"), group: form.get("group"), icon: form.get("icon") }) },
    { path: "/:categoryId/archive", notice: () => "categoria-archivada", run: (db, ctx, form, id) => setCategoryArchived(db, { ...ctx, categoryId: id, archived: true }) },
    { path: "/:categoryId/restore", notice: () => "categoria-restaurada", run: (db, ctx, form, id) => setCategoryArchived(db, { ...ctx, categoryId: id, archived: false }) },
    { path: "/:categoryId/merge", notice: () => "categoria-fusionada", run: (db, ctx, form, id) => mergeCategory(db, { ...ctx, categoryId: id, intoId: form.get("into") }) },
  ];
  for (const action of actions) {
    app.post(`/groups/:groupId/ledger/categories${action.path}`, async (c) => {
      const user = c.get("protectedUser");
      try {
        const ledger = await getLedgerAccess(c.env.DB, c.req.param("groupId"), user.user_id);
        if (ledger.role !== "owner") throw new LedgerError("Sólo el titular puede gestionar las categorías.", 403);
        if (ledger.archived_at) throw new LedgerError("El grupo está archivado.", 409);
        const result = await action.run(c.env.DB, { ledger, userId: user.user_id }, await c.req.formData(), c.req.param("categoryId"));
        return c.redirect(`/groups/${encodeURIComponent(c.req.param("groupId"))}/ledger/categories?aviso=${action.notice(result)}`, 303);
      } catch (error) { return ledgerFailure(c, error); }
    });
  }
}
