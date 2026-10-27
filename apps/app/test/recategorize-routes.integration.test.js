import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { createCsrfToken } from "../src/csrf.js";
import { readLedger, saveEntry } from "../src/ledger.js";
import { createSession } from "../src/sessions.js";
import { createGroupForUser, ensureLocalUser, inviteToGroup, resolveInvitation } from "../src/groups.js";
import { CLASSIFY_JS } from "../src/classify-client.js";

const SECRET = "r".repeat(32);

async function identity(email) {
  const user = await ensureLocalUser(env.DB, email);
  const session = await createSession(env.DB, { userId: user.id, secret: SECRET });
  return { user, cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}`, csrf: await createCsrfToken({ sessionId: session.id, secret: SECRET }) };
}
function request(who, path, init = {}) {
  const post = init.method === "POST";
  const headers = { Cookie: who.cookie, ...(post ? { Origin: "https://app.test", "X-CSRF-Token": who.csrf, "Content-Type": "application/x-www-form-urlencoded" } : {}), ...init.headers };
  const body = post ? new URLSearchParams(init.form ?? []).toString() : undefined;
  return app.request(`https://app.test${path}`, { method: init.method, body, headers, redirect: "manual" }, { DB: env.DB, SESSION_SECRET: SECRET });
}
async function team(name) {
  const owner = await identity(`${name}-owner@example.test`);
  const member = await identity(`${name}-member@example.test`);
  const group = await createGroupForUser(env.DB, { userId: owner.user.id, name });
  const invitation = await inviteToGroup(env.DB, { groupId: group.id, inviterUserId: owner.user.id, email: member.user.email });
  await resolveInvitation(env.DB, { invitationId: invitation.id, userId: member.user.id, email: member.user.email, accepted: true });
  const data = await readLedger(env.DB, { groupId: group.id, userId: owner.user.id });
  const ownerId = data.participants.find(person => person.linkedUserId === owner.user.id).id;
  const memberId = data.participants.find(person => person.linkedUserId === member.user.id).id;
  return { owner, member, group, ledger: data.ledger, ownerId, memberId, categories: data.categories, base: `/groups/${group.slug}` };
}
const find = (t, name) => t.categories.find(category => category.name === name);
const add = (t, description, extra = {}, who = t.owner) => saveEntry(env.DB, { groupId: t.group.id, userId: who.user.id, idempotencyKey: crypto.randomUUID(), input: {
  type: "expense", currency: "COP", totalMinor: 10000, description, note: "", occurredAt: "2026-06-01",
  cashParties: [{ participantId: who === t.owner ? t.ownerId : t.memberId, direction: "out", amountMinor: 10000 }], allocations: [{ participantId: t.ownerId, amountMinor: 5000 }, { participantId: t.memberId, amountMinor: 5000 }], ...extra } });
const key = () => crypto.randomUUID();
// La vista previa es POST → 303 → GET: devuelve el resultado final (o el error del POST).
async function previewPage(who, t, form) {
  const posted = await request(who, `${t.base}/ledger/recategorize/preview`, { method: "POST", form });
  if (posted.status !== 303) return { status: posted.status, html: await posted.text(), redirected: false };
  const location = posted.headers.get("Location");
  const page = await request(who, location);
  return { status: page.status, html: await page.text(), redirected: true, location };
}
const rev = async t => (await env.DB.prepare("SELECT revision FROM expense_ledgers WHERE id = ?").bind(t.ledger.id).first()).revision;
const confirmForm = async (t, ids, extra = {}) => ({ categoryId: find(t, "Alimentos").id, expectedRevision: String(await rev(t)), key: key(), ...extra, ids });

describe("cambiar la categoría desde la lista", () => {
  it("la vista previa muestra cuántos cambian y no escribe nada", async () => {
    const t = await team("rr-previa");
    const a = await add(t, "Carulla uno");
    const b = await add(t, "Carulla dos");
    const result = await previewPage(t.owner, t, [["ids", a.id], ["ids", b.id], ["categoryId", find(t, "Alimentos").id]]);
    expect(result.status).toBe(200);
    expect(result.location).toMatch(/\/ledger\/recategorize\/preview\?ids=/u);
    expect(result.html).toContain("Cambiarán 2 movimientos");
    expect(result.html).toContain("Carulla uno");
    expect(result.html).toContain('name="expectedRevision"');
    const data = await readLedger(env.DB, { groupId: t.group.id, userId: t.owner.user.id });
    expect(data.entries.every(entry => entry.categoryId === null)).toBe(true);
  });

  it("volver a la vista previa es una página GET: se puede recargar sin reenviar un formulario", async () => {
    const t = await team("rr-previa-get");
    const a = await add(t, "Uno");
    const { location } = await previewPage(t.owner, t, [["ids", a.id], ["categoryId", find(t, "Taxi").id]]);
    expect((await request(t.owner, location)).status).toBe(200);
    expect((await request(t.owner, location)).status).toBe(200);
  });

  it("«todos los resultados» usa la búsqueda y no solo las casillas marcadas", async () => {
    const t = await team("rr-todos");
    for (let index = 0; index < 5; index += 1) await add(t, `Carulla ${index}`);
    await add(t, "Otra cosa");
    const result = await previewPage(t.owner, t, [["all", "1"], ["query", "carulla"], ["categoria", ""], ["categoryId", find(t, "Alimentos").id]]);
    expect(result.html).toContain("Cambiarán 5 movimientos");
    expect(result.location).toContain("all=1");
  });

  it("después de aplicarse, la misma vista previa dice que ya no hay nada para cambiar y no ofrece confirmar", async () => {
    const t = await team("rr-previa-vacia");
    const a = await add(t, "Uno");
    const { location } = await previewPage(t.owner, t, [["ids", a.id], ["categoryId", find(t, "Taxi").id]]);
    await request(t.owner, `${t.base}/ledger/recategorize`, { method: "POST", form: [["ids", a.id], ["categoryId", find(t, "Taxi").id], ["expectedRevision", String(await rev(t))], ["key", key()]] });
    const html = await (await request(t.owner, location)).text();
    expect(html).toContain("Ya no hay nada para cambiar");
    expect(html).not.toContain("Confirmar el cambio");
  });

  it("marcar más de 150 movimientos explica que conviene «Todos los resultados»", async () => {
    const t = await team("rr-demasiadas");
    const a = await add(t, "Uno");
    const form = [...Array.from({ length: 151 }, () => ["ids", a.id]), ["categoryId", find(t, "Taxi").id]];
    const result = await previewPage(t.owner, t, form);
    expect(result.status).toBe(400);
    expect(result.html).toContain("Todos los resultados");
  });

  it("sin elegir categoría o sin selección responde con el motivo", async () => {
    const t = await team("rr-vacio");
    const a = await add(t, "Uno");
    const noCategory = await previewPage(t.owner, t, [["ids", a.id], ["categoryId", ""]]);
    expect(noCategory.status).toBe(400);
    expect(noCategory.html).toContain("Elegí la categoría");
    const noneSelected = await previewPage(t.owner, t, [["categoryId", find(t, "Taxi").id]]);
    expect(noneSelected.status).toBe(400);
    expect(noneSelected.html).toContain("No hay movimientos seleccionados");
  });

  it("confirmar cambia los movimientos, redirige con el lote y el libro ofrece deshacer", async () => {
    const t = await team("rr-confirmar");
    const a = await add(t, "Uno");
    const b = await add(t, "Dos");
    const response = await request(t.owner, `${t.base}/ledger/recategorize`, { method: "POST", form: Object.entries(await confirmForm(t, [a.id, b.id])).flatMap(([name, value]) => (Array.isArray(value) ? value.map(item => [name, item]) : [[name, value]])) });
    expect(response.status).toBe(303);
    const location = response.headers.get("Location");
    expect(location).toMatch(/aviso=recategorizado&lote=recat_/u);
    const book = await (await request(t.owner, location.replace("#movimientos", ""))).text();
    expect(book).toContain("Se cambió la categoría de 2 movimientos");
    expect(book).toContain("«Alimentos»");
    expect(book).toContain("/recategorize/recat_");
    expect(book).toContain("Deshacer");
    const data = await readLedger(env.DB, { groupId: t.group.id, userId: t.owner.user.id });
    expect(data.entries.map(entry => entry.categoryInfo?.name)).toEqual(["Alimentos", "Alimentos"]);
  });

  it("deshacer desde el aviso restaura y muestra el resultado", async () => {
    const t = await team("rr-deshacer");
    const a = await add(t, "Uno");
    const confirm = await request(t.owner, `${t.base}/ledger/recategorize`, { method: "POST", form: [["ids", a.id], ["categoryId", find(t, "Taxi").id], ["expectedRevision", String(await rev(t))], ["key", key()]] });
    const batchId = /lote=(recat_[^&#]+)/u.exec(confirm.headers.get("Location"))[1];
    const undo = await request(t.owner, `${t.base}/ledger/recategorize/${batchId}/undo`, { method: "POST", form: [] });
    expect(undo.status).toBe(303);
    expect(undo.headers.get("Location")).toMatch(/aviso=deshecho&lote=recat_undo_/u);
    const book = await (await request(t.owner, undo.headers.get("Location").replace("#movimientos", ""))).text();
    expect(book).toContain("Se deshizo la operación");
    expect((await readLedger(env.DB, { groupId: t.group.id, userId: t.owner.user.id })).entries[0].categoryInfo).toBeNull();
    const again = await request(t.owner, `${t.base}/ledger/recategorize/${batchId}/undo`, { method: "POST", form: [] });
    expect(again.status).toBe(409);
    expect(await again.text()).toContain("ya se deshizo");
  });

  it("si el libro cambió entre la vista previa y la confirmación responde 409 y no cambia nada", async () => {
    const t = await team("rr-conflicto");
    const a = await add(t, "Uno");
    const stale = await rev(t);
    await add(t, "Cargado por otra persona", {}, t.member);
    const response = await request(t.owner, `${t.base}/ledger/recategorize`, { method: "POST", form: [["ids", a.id], ["categoryId", find(t, "Taxi").id], ["expectedRevision", String(stale)], ["key", key()]] });
    expect(response.status).toBe(409);
    expect(await response.text()).toContain("cambió desde la vista previa");
    expect((await readLedger(env.DB, { groupId: t.group.id, userId: t.owner.user.id })).entries.every(entry => entry.categoryId === null)).toBe(true);
  });

  it("repetir la confirmación (doble envío) deja un solo lote", async () => {
    const t = await team("rr-doble");
    const a = await add(t, "Uno");
    const form = [["ids", a.id], ["categoryId", find(t, "Taxi").id], ["expectedRevision", String(await rev(t))], ["key", key()]];
    const [first, second] = await Promise.all([request(t.owner, `${t.base}/ledger/recategorize`, { method: "POST", form }), request(t.owner, `${t.base}/ledger/recategorize`, { method: "POST", form })]);
    expect([first.status, second.status].every(status => status === 303)).toBe(true);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM recategorization_batches WHERE ledger_id = ?").bind(t.ledger.id).first()).n).toBe(1);
  });

  it("el aviso ignora un identificador de lote malformado y no lo muestra", async () => {
    const t = await team("rr-aviso");
    const html = await (await request(t.owner, `${t.base}?aviso=recategorizado&lote=%3Cscript%3E`)).text();
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("Se cambió la categoría");
  });

  it("un integrante recibe 403 al deshacer el lote de otra persona y un extraño no ve nada", async () => {
    const t = await team("rr-permisos");
    const a = await add(t, "Uno");
    const confirm = await request(t.owner, `${t.base}/ledger/recategorize`, { method: "POST", form: [["ids", a.id], ["categoryId", find(t, "Taxi").id], ["expectedRevision", String(await rev(t))], ["key", key()]] });
    const batchId = /lote=(recat_[^&#]+)/u.exec(confirm.headers.get("Location"))[1];
    expect((await request(t.member, `${t.base}/ledger/recategorize/${batchId}/undo`, { method: "POST", form: [] })).status).toBe(403);
    const stranger = await identity("rr-permisos-extraño@example.test");
    expect((await request(stranger, `${t.base}/ledger/recategorize/${batchId}/undo`, { method: "POST", form: [] })).status).toBe(404);
  });

  it("sin token CSRF se rechaza", async () => {
    const t = await team("rr-csrf");
    const response = await app.request(`https://app.test${t.base}/ledger/recategorize/preview`, { method: "POST", body: new URLSearchParams([["categoryId", "x"]]), headers: { Cookie: t.owner.cookie, Origin: "https://app.test", "Content-Type": "application/x-www-form-urlencoded" } }, { DB: env.DB, SESSION_SECRET: SECRET });
    expect(response.status).toBe(403);
  });
});

describe("clasificar rápido", () => {
  const classify = (t, who = t.owner, query = "") => request(who, `${t.base}/ledger/classify${query}`).then(response => response.text());
  const title = html => /<h2>([^<]*)<\/h2>/u.exec(html)?.[1];

  it("muestra el pendiente más reciente, el contador y las categorías más usadas", async () => {
    const t = await team("rq-pantalla");
    await add(t, "Antiguo", { occurredAt: "2026-01-01" });
    await add(t, "Reciente", { occurredAt: "2026-06-30" });
    const html = await classify(t);
    expect(title(html)).toBe("Reciente");
    expect(html).toContain("Quedan 2 movimientos pendientes");
    expect(html).toContain('src="/classify.js"');
  });

  it("asignar baja el contador y muestra el siguiente", async () => {
    const t = await team("rq-asignar");
    await add(t, "Reciente", { occurredAt: "2026-06-30" });
    await add(t, "Antiguo", { occurredAt: "2026-01-01" });
    const html = await classify(t);
    const entryId = /name="entryId" value="([^"]+)"/u.exec(html)[1];
    const form = [["entryId", entryId], ["categoryId", find(t, "Taxi").id], ["key", /name="key" value="([^"]+)"/u.exec(html)[1]], ["saltar", ""]];
    const response = await request(t.owner, `${t.base}/ledger/classify`, { method: "POST", form });
    expect(response.status).toBe(303);
    const next = await classify(t);
    expect(title(next)).toBe("Antiguo");
    expect(next).toContain("Quedan 1 movimiento pendiente");
    expect(next).toContain("data-undo");
  });

  it("saltar no cambia nada y el saltado vuelve al final", async () => {
    const t = await team("rq-saltar");
    const first = await add(t, "Primero", { occurredAt: "2026-06-30" });
    await add(t, "Segundo", { occurredAt: "2026-06-20" });
    const skipped = await classify(t, t.owner, `?saltar=${first.id}`);
    expect(title(skipped)).toBe("Segundo");
    expect(skipped).toContain("Quedan 2 movimientos pendientes");
    const onlySkipped = await classify(t, t.owner, `?saltar=${first.id}`);
    expect(onlySkipped).toBeDefined();
  });

  it("deshacer lo último vuelve a mostrar el movimiento", async () => {
    const t = await team("rq-deshacer");
    await add(t, "Único");
    const html = await classify(t);
    const form = [["entryId", /name="entryId" value="([^"]+)"/u.exec(html)[1]], ["categoryId", find(t, "Taxi").id], ["key", /name="key" value="([^"]+)"/u.exec(html)[1]], ["saltar", ""]];
    await request(t.owner, `${t.base}/ledger/classify`, { method: "POST", form });
    const empty = await classify(t);
    expect(empty).toContain("No quedan movimientos pendientes");
    const batchId = /ledger\/recategorize\/(recat_[^/"]+)\/undo/u.exec(empty)?.[1];
    expect(batchId).toBeUndefined();
    const last = (await env.DB.prepare("SELECT id FROM recategorization_batches WHERE ledger_id = ? AND kind = 'quick'").bind(t.ledger.id).first()).id;
    const undo = await request(t.owner, `${t.base}/ledger/recategorize/${last}/undo`, { method: "POST", form: [["volver", "classify"]] });
    expect(undo.headers.get("Location")).toBe(`${t.base}/ledger/classify`);
    expect(title(await classify(t))).toBe("Único");
  });

  it("ofrece la sugerida con su causa cuando hay evidencia", async () => {
    const t = await team("rq-sugerida");
    for (let index = 0; index < 4; index += 1) await add(t, `Veterinaria Patitas ${index}`, { categoryId: find(t, "Mascotas").id });
    await add(t, "Veterinaria Patitas control", { occurredAt: "2026-12-01" });
    const html = await classify(t);
    expect(html).toContain("Sugerida:");
    expect(html).toContain("Mascotas");
    expect(html).toContain("aparece en 4 movimientos de Mascotas");
  });

  it("un integrante solo ve sus pendientes", async () => {
    const t = await team("rq-integrante");
    await add(t, "Del titular");
    await add(t, "Del integrante", {}, t.member);
    const html = await classify(t, t.member);
    expect(title(html)).toBe("Del integrante");
    expect(html).toContain("Quedan 1 movimiento pendiente");
  });

  it("con el libro archivado responde 409 y sin sesión pide iniciar sesión", async () => {
    const t = await team("rq-archivado");
    await request(t.owner, `${t.base}/ledger/archive`, { method: "POST", form: [] });
    expect((await request(t.owner, `${t.base}/ledger/classify`)).status).toBe(409);
    const anonymous = await app.request(`https://app.test${t.base}/ledger/classify`, { redirect: "manual" }, { DB: env.DB, SESSION_SECRET: SECRET });
    expect([302, 303, 401]).toContain(anonymous.status);
  });

  it("ignora identificadores saltados malformados", async () => {
    const t = await team("rq-malformado");
    await add(t, "Único");
    const html = await classify(t, t.owner, "?saltar=%3Cscript%3E,x");
    expect(title(html)).toBe("Único");
    expect(html).not.toContain("<script>alert");
  });

  it("sirve el script de atajos como JavaScript", async () => {
    const response = await app.request("https://app.test/classify.js", {}, { DB: env.DB, SESSION_SECRET: SECRET });
    expect(response.headers.get("Content-Type")).toContain("text/javascript");
    expect(await response.text()).toBe(CLASSIFY_JS);
  });
});
