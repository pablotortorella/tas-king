import { cancelImportBatch, cancelImportPreview, confirmImportPreview, createImportPreview, loadImportChunk, readImportBatch, readImportPlan, readImportPreview, readImportProgress, readPreviewSummary, reviewImportPreview } from "../splitwise-import.js";
import { renderImportBatch, renderImportPreview, renderImportProgress, renderImportReview, renderImportUpload } from "../splitwise-ui.js";
import { assertLedgerWritable } from "../ledger-admin.js";
import { LedgerError } from "../errors.js";
import { getLedgerAccess, readLedger } from "../ledger.js";
import { csrfInput, ledgerFailure, page, signedInUser, signInRequired } from "../route-kit.js";

// Importación de Splitwise: vista previa, revisión, confirmación, avance por tandas y cancelación.

export function registerImportRoutes(app) {
  app.get("/groups/:groupId/ledger/import", async (c) => {
    const user = await signedInUser(c);
    if (!user) return signInRequired(c);
    try {
      const ledger = await assertLedgerWritable(c.env.DB, c.req.param("groupId"), user.user_id);
      if (ledger.role !== "owner") throw new LedgerError("Sólo el titular puede importar.", 403);
      return c.html(page("Importar Splitwise", renderImportUpload({ groupId: c.req.param("groupId"), csrf: await csrfInput(c, user) })));
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.post("/groups/:groupId/ledger/import/preview", async (c) => {
    const user = c.get("protectedUser");
    try {
      await assertLedgerWritable(c.env.DB, c.req.param("groupId"), user.user_id);
      const form = await c.req.formData();
      const file = form.get("file");
      if (!(file instanceof File) || !file.size || file.size > 2 * 1024 * 1024) throw new LedgerError("Seleccioná un CSV de hasta 2 MiB.", 413);
      const result = await createImportPreview(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id, fileName: file.name, csvText: await file.text() });
      const base = `/groups/${encodeURIComponent(c.req.param("groupId"))}/ledger/import`;
      return c.redirect(result.batchId ? `${base}/batches/${encodeURIComponent(result.batchId)}` : `${base}/previews/${encodeURIComponent(result.previewId)}`, 303);
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.get("/groups/:groupId/ledger/import/previews/:previewId", async (c) => {
    const user = await signedInUser(c);
    if (!user) return signInRequired(c);
    try {
      const preview = await readImportPreview(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id, previewId: c.req.param("previewId") });
      if (preview.batchId) return c.redirect(`/groups/${encodeURIComponent(c.req.param("groupId"))}/ledger/import/batches/${encodeURIComponent(preview.batchId)}`, 303);
      const data = await readLedger(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id });
      const summary = await readPreviewSummary(c.env.DB, preview.id, preview.meta, { page: Number.parseInt(c.req.query("pagina") ?? "1", 10) || 1 });
      return c.html(page("Previsualizar Splitwise", renderImportPreview({ groupId: c.req.param("groupId"), csrf: await csrfInput(c, user), preview, summary, ledger: data.ledger, participants: data.participants.filter(person => person.active), ownId: data.participants.find(person => person.linkedUserId === user.user_id)?.id ?? null })));
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.post("/groups/:groupId/ledger/import/previews/:previewId/review", async (c) => {
    const user = c.get("protectedUser");
    try {
      const preview = await readImportPreview(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id, previewId: c.req.param("previewId") });
      const form = await c.req.formData();
      const mapping = preview.meta.participantNames.map((_, index) => form.get(`mapping_${index}`));
      const decisions = {};
      for (const [key, value] of form.entries()) if (key.startsWith("decision_")) decisions[key.slice("decision_".length)] = value;
      const base = { groupId: c.req.param("groupId"), userId: user.user_id, previewId: c.req.param("previewId") };
      // Siempre se guarda lo de esta página primero, así una página con faltantes no pierde lo ya decidido.
      await reviewImportPreview(c.env.DB, { ...base, mapping, decisions, partial: true });
      const action = String(form.get("accion") ?? "revisar");
      const root = `/groups/${encodeURIComponent(c.req.param("groupId"))}/ledger/import/previews/${encodeURIComponent(c.req.param("previewId"))}`;
      if (action.startsWith("pagina:")) return c.redirect(`${root}?pagina=${Number.parseInt(action.slice(7), 10) || 1}`, 303);
      await reviewImportPreview(c.env.DB, { ...base, mapping });
      return c.redirect(`${root}/review`, 303);
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.get("/groups/:groupId/ledger/import/previews/:previewId/review", async (c) => {
    const user = await signedInUser(c);
    if (!user) return signInRequired(c);
    try {
      const { preview, plan } = await readImportPlan(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id, previewId: c.req.param("previewId") });
      const data = await readLedger(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id });
      return c.html(page("Confirmar Splitwise", renderImportReview({ groupId: c.req.param("groupId"), csrf: await csrfInput(c, user), preview, plan, participants: data.participants, ownId: data.participants.find(person => person.linkedUserId === user.user_id)?.id ?? null })));
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.post("/groups/:groupId/ledger/import/previews/:previewId/cancel", async (c) => {
    const user = c.get("protectedUser");
    try {
      await cancelImportPreview(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id, previewId: c.req.param("previewId") });
      return c.redirect(`/groups/${encodeURIComponent(c.req.param("groupId"))}?aviso=importacion-cancelada`, 303);
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.post("/groups/:groupId/ledger/import/previews/:previewId/confirm", async (c) => {
    const user = c.get("protectedUser");
    try {
      await assertLedgerWritable(c.env.DB, c.req.param("groupId"), user.user_id);
      const form = await c.req.formData();
      const batchId = await confirmImportPreview(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id, previewId: c.req.param("previewId"), acknowledgeDifference: form.get("acknowledgeDifference") === "yes" });
      return c.redirect(`/groups/${encodeURIComponent(c.req.param("groupId"))}/ledger/import/batches/${encodeURIComponent(batchId)}`, 303);
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.get("/groups/:groupId/ledger/import/batches/:batchId", async (c) => {
    const user = await signedInUser(c);
    if (!user) return signInRequired(c);
    try {
      const args = { groupId: c.req.param("groupId"), userId: user.user_id, batchId: c.req.param("batchId") };
      const ledger = await getLedgerAccess(c.env.DB, args.groupId, args.userId);
      if (ledger.role === "owner") {
        const progress = await readImportProgress(c.env.DB, args);
        if (progress.status === "pending") return c.html(page("Importando Splitwise", renderImportProgress({ groupId: args.groupId, csrf: await csrfInput(c, user), progress })));
      }
      const batch = await readImportBatch(c.env.DB, args);
      return c.html(page("Importación Splitwise", renderImportBatch({ groupId: args.groupId, batch })));
    } catch (error) { return ledgerFailure(c, error); }
  });

  // Una tanda por petición: con JavaScript la pantalla las encadena; sin él, cada clic en «Continuar» carga una.
  app.post("/groups/:groupId/ledger/import/batches/:batchId/load", async (c) => {
    const user = c.get("protectedUser");
    try {
      const progress = await loadImportChunk(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id, batchId: c.req.param("batchId") });
      if (c.req.header("Accept")?.includes("application/json")) return c.json(progress);
      return c.redirect(`/groups/${encodeURIComponent(c.req.param("groupId"))}/ledger/import/batches/${encodeURIComponent(c.req.param("batchId"))}`, 303);
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.post("/groups/:groupId/ledger/import/batches/:batchId/cancel", async (c) => {
    const user = c.get("protectedUser");
    try {
      await cancelImportBatch(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id, batchId: c.req.param("batchId") });
      return c.redirect(`/groups/${encodeURIComponent(c.req.param("groupId"))}?aviso=importacion-cancelada`, 303);
    } catch (error) { return ledgerFailure(c, error); }
  });
}
