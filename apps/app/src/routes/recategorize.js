import { applyRecategorization, classifyOne, previewRecategorization, readClassifyContext, readRecategorizationBatch, undoRecategorization } from "../recategorize.js";
import { recategorizationNotice, renderClassify, renderRecategorizePreview } from "../recategorize-ui.js";
import { LedgerError } from "../errors.js";
import { readLedger } from "../ledger.js";
import { csrfInput, ledgerFailure, page, signedInUser, signInRequired } from "../route-kit.js";


  // Aviso con el botón «Deshacer» después de una recategorización o de deshacerla; el parámetro nunca se muestra tal cual.
export async function recategorizationNoticeFor(c, user, space, csrf) {
  const aviso = c.req.query("aviso");
  const lote = c.req.query("lote");
  if (!["recategorizado", "deshecho"].includes(aviso) || typeof lote !== "string" || !/^recat_[A-Za-z0-9_-]{8,200}$/u.test(lote)) return "";
  try {
    const batch = await readRecategorizationBatch(c.env.DB, { spaceId: space.id, userId: user.user_id, batchId: lote });
    return recategorizationNotice({ spaceId: space.slug, csrf, batch });
  } catch { return ""; }
}

export function registerRecategorizeRoutes(app) {
  // Recategorización: vista previa (nada se escribe), confirmación, deshacer y «clasificar rápido».
  function criteriaFrom(form) {
    return form.get("all") === "1"
      ? { all: true, query: String(form.get("query") ?? ""), category: String(form.get("categoria") ?? ""), person: String(form.get("quien") ?? "") }
      : { ids: form.getAll("ids").map(String).slice(0, 2000) };
  }

  const PREVIEW_IDS_LIMIT = 150;

  // La vista previa es una página GET (POST → redirección → GET): así volver atrás no pide reenviar el formulario.
  app.post("/spaces/:spaceId/ledger/recategorize/preview", async (c) => {
    const user = c.get("protectedUser");
    try {
      const form = await c.req.formData();
      const criteria = criteriaFrom(form);
      const categoryId = String(form.get("categoryId") ?? "");
      if (!criteria.all && criteria.ids.length > PREVIEW_IDS_LIMIT) throw new LedgerError(`Marcaste ${criteria.ids.length} movimientos: para más de ${PREVIEW_IDS_LIMIT} usá «Todos los resultados» de la búsqueda o el filtro.`);
      await previewRecategorization(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, criteria, categoryId });
      const query = new URLSearchParams(criteria.all ? [["all", "1"], ["query", criteria.query], ["categoria", criteria.category], ["quien", criteria.person]] : criteria.ids.map(id => ["ids", id]));
      query.set("categoryId", categoryId);
      return c.redirect(`/spaces/${encodeURIComponent(c.req.param("spaceId"))}/ledger/recategorize/preview?${query.toString()}`, 303);
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.get("/spaces/:spaceId/ledger/recategorize/preview", async (c) => {
    const user = await signedInUser(c);
    if (!user) return signInRequired(c);
    try {
      const params = new URL(c.req.url).searchParams;
      const criteria = criteriaFrom(params);
      const preview = await previewRecategorization(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, criteria, categoryId: params.get("categoryId") ?? "" });
      return c.html(page("Cambiar categoría", renderRecategorizePreview({ spaceId: c.req.param("spaceId"), csrf: await csrfInput(c, user), preview, criteria, key: crypto.randomUUID() })));
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.post("/spaces/:spaceId/ledger/recategorize", async (c) => {
    const user = c.get("protectedUser");
    try {
      const form = await c.req.formData();
      const batch = await applyRecategorization(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, criteria: criteriaFrom(form), categoryId: String(form.get("categoryId") ?? ""), expectedRevision: form.get("expectedRevision"), key: String(form.get("key") ?? "") });
      return c.redirect(`/spaces/${encodeURIComponent(c.req.param("spaceId"))}?aviso=recategorizado&lote=${encodeURIComponent(batch.id)}#movimientos`, 303);
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.post("/spaces/:spaceId/ledger/recategorize/:batchId/undo", async (c) => {
    const user = c.get("protectedUser");
    try {
      const form = await c.req.formData();
      const undone = await undoRecategorization(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, batchId: c.req.param("batchId") });
      const root = `/spaces/${encodeURIComponent(c.req.param("spaceId"))}`;
      if (form.get("volver") === "classify") {
        const skipped = String(form.get("saltar") ?? "");
        return c.redirect(`${root}/ledger/classify${skipped ? `?saltar=${encodeURIComponent(skipped)}` : ""}`, 303);
      }
      return c.redirect(`${root}?aviso=deshecho&lote=${encodeURIComponent(undone.id)}#movimientos`, 303);
    } catch (error) { return ledgerFailure(c, error); }
  });

  function skippedIds(value) {
    return String(value ?? "").split(",").map(item => item.trim()).filter(item => /^[A-Za-z0-9_-]{8,120}$/u.test(item)).slice(0, 200);
  }

  app.get("/spaces/:spaceId/ledger/classify", async (c) => {
    const user = await signedInUser(c);
    if (!user) return signInRequired(c);
    try {
      const skipped = skippedIds(c.req.query("saltar"));
      const context = await readClassifyContext(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, skipped });
      const { data } = context;
      return c.html(page("Clasificar rápido", renderClassify({ spaceId: c.req.param("spaceId"), csrf: await csrfInput(c, user), current: context.current, names: new Map(data.participants.map(person => [person.id, person.displayName])), remaining: context.remaining, suggestion: context.suggestion, recents: context.recents, categories: data.categories, skipped, last: context.last, key: crypto.randomUUID() })));
    } catch (error) { return ledgerFailure(c, error); }
  });

  app.post("/spaces/:spaceId/ledger/classify", async (c) => {
    const user = c.get("protectedUser");
    try {
      const form = await c.req.formData();
      await classifyOne(c.env.DB, { spaceId: c.req.param("spaceId"), userId: user.user_id, entryId: String(form.get("entryId") ?? ""), categoryId: String(form.get("categoryId") ?? ""), key: String(form.get("key") ?? "") });
      const skipped = skippedIds(form.get("saltar")).join(",");
      return c.redirect(`/spaces/${encodeURIComponent(c.req.param("spaceId"))}/ledger/classify${skipped ? `?saltar=${encodeURIComponent(skipped)}` : ""}`, 303);
    } catch (error) { return ledgerFailure(c, error); }
  });
}
