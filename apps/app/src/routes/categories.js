import { createCategory, mergeCategory, setCategoryArchived, updateCategory } from "../categories.js";
import { renderCategories } from "../categories-ui.js";
import { LedgerError } from "../errors.js";
import { getLedgerAccess, readLedger } from "../ledger.js";
import { csrfInput, ledgerFailure, page, signedInUser, signInRequired } from "../route-kit.js";
import { noticeFor } from "../ui-parts.js";

// Pantalla de categorías del libro y su gestión.

export function registerCategoryRoutes(app) {
  app.get("/spaces/:spaceId/ledger/categories", async (c) => {
    const user = await signedInUser(c);
    if (!user) return signInRequired(c);
    try {
      const data = await readLedger(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id });
      return c.html(page("Categorías", noticeFor(c.req.query("aviso")) + renderCategories(data, { spaceId: c.req.param("spaceId"), csrf: await csrfInput(c, user), owner: data.ledger.role === "owner" })));
    } catch (error) { return ledgerFailure(c, error); }
  });

  // Gestión de categorías: sólo la persona titular (la regla vive en categories.js, no en la ruta).
  const categoryActions = [
    ["", async (db, base, form) => createCategory(db, { ledgerId: base.ledger.id, userId: base.userId, name: form.get("name"), group: form.get("group"), icon: form.get("icon") }), "categoria-creada", false],
    ["/:categoryId", (db, base, form, id) => updateCategory(db, { ...base, categoryId: id, name: form.get("name"), group: form.get("group"), icon: form.get("icon") }), "categoria-guardada", true],
    ["/:categoryId/archive", (db, base, form, id) => setCategoryArchived(db, { ...base, categoryId: id, archived: true }), "categoria-archivada", true],
    ["/:categoryId/restore", (db, base, form, id) => setCategoryArchived(db, { ...base, categoryId: id, archived: false }), "categoria-restaurada", true],
    ["/:categoryId/merge", (db, base, form, id) => mergeCategory(db, { ...base, categoryId: id, intoId: form.get("into") }), "categoria-fusionada", true],
  ];
  for (const [suffix, action, notice, needsOwner] of categoryActions) {
    app.post(`/spaces/:spaceId/ledger/categories${suffix}`, async (c) => {
      const user = c.get("protectedUser");
      try {
        const ledger = await getLedgerAccess(c.env.DB, c.req.param("spaceId"), user.user_id);
        if (!needsOwner && ledger.role !== "owner") throw new LedgerError("Sólo el titular puede gestionar las categorías.", 403);
        if (ledger.archived_at) throw new LedgerError("El libro está archivado.", 409);
        await action(c.env.DB, { ledger, ledgerId: ledger.id, userId: user.user_id }, await c.req.formData(), c.req.param("categoryId"));
        return c.redirect(`/spaces/${encodeURIComponent(c.req.param("spaceId"))}/ledger/categories?aviso=${notice}`, 303);
      } catch (error) { return ledgerFailure(c, error); }
    });
  }
}
