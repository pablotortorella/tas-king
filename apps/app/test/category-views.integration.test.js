import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { createCsrfToken } from "../src/csrf.js";
import { createCategory, readCategories } from "../src/categories.js";
import { addParticipant, exportLedger, readLedger, saveEntry } from "../src/ledger.js";
import { confirmImportPreview, createImportPreview, loadImportChunk, reviewImportPreview } from "../src/splitwise-import.js";
import { createSession } from "../src/sessions.js";
import { createSpaceForUser, ensureLocalUser, inviteToSpace, resolveInvitation } from "../src/spaces.js";
import { TEXT_MODULE_SOURCE } from "../src/text.js";

const SECRET = "c".repeat(32);

async function identity(email) {
  const user = await ensureLocalUser(env.DB, email);
  const session = await createSession(env.DB, { userId: user.id, secret: SECRET });
  return { user, cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}`, csrf: await createCsrfToken({ sessionId: session.id, secret: SECRET }) };
}
function request(who, path, init = {}) {
  const post = init.method === "POST";
  const body = post && init.form ? new URLSearchParams(init.form).toString() : init.body;
  const headers = { Cookie: who.cookie, ...(post ? { Origin: "https://app.test", "X-CSRF-Token": who.csrf, "Content-Type": "application/x-www-form-urlencoded" } : {}), ...init.headers };
  return app.request(`https://app.test${path}`, { method: init.method, body, headers, redirect: "manual" }, { DB: env.DB, SESSION_SECRET: SECRET });
}
async function team(name) {
  const owner = await identity(`${name}-owner@example.test`);
  const member = await identity(`${name}-member@example.test`);
  const space = await createSpaceForUser(env.DB, { userId: owner.user.id, name });
  const invitation = await inviteToSpace(env.DB, { spaceId: space.id, inviterUserId: owner.user.id, email: member.user.email });
  await resolveInvitation(env.DB, { invitationId: invitation.id, userId: member.user.id, email: member.user.email, accepted: true });
  const data = await readLedger(env.DB, { spaceId: space.id, userId: owner.user.id });
  return { owner, member, space, ledger: data.ledger, people: data.participants, categories: data.categories };
}
const find = (categories, name) => categories.find(category => category.name === name);
const entryInput = (people, extra = {}) => ({
  type: "expense", currency: "COP", totalMinor: 10000, description: "Cena", note: "", occurredAt: "2026-10-24",
  cashParties: [{ participantId: people[0].id, direction: "out", amountMinor: 10000 }], allocations: [],
  split: { method: "equal", beneficiaries: people.map(person => person.id), inputs: {} }, ...extra,
});
const entryForm = (t, extra = {}) => ({
  type: "expense", currency: "COP", amount: "100,00", description: "Compra", occurredAt: "2026-10-24", payer: t.people[0].id, splitMethod: "equal", beneficiary: t.people[0].id, idempotencyKey: crypto.randomUUID(), ...extra,
});

describe("pantalla de gestión de categorías", () => {
  it("el titular y un integrante la ven; solo el titular ve los formularios", async () => {
    const t = await team("cv-pantalla");
    const owner = await (await request(t.owner, `/spaces/${t.space.slug}/ledger/categories`)).text();
    const member = await (await request(t.member, `/spaces/${t.space.slug}/ledger/categories`)).text();
    expect(owner).toContain("Nueva categoría");
    expect(owner).toContain("Restaurantes");
    expect(member).toContain("Restaurantes");
    expect(member).not.toContain(`action="/spaces/`);
  });

  it("alguien sin acceso al libro no la ve", async () => {
    const t = await team("cv-sin-acceso");
    const stranger = await identity("cv-extraño@example.test");
    expect((await request(stranger, `/spaces/${t.space.slug}/ledger/categories`)).status).toBe(404);
  });

  it("sin sesión pide iniciar sesión", async () => {
    const t = await team("cv-sin-sesion");
    const response = await app.request(`https://app.test/spaces/${t.space.slug}/ledger/categories`, { redirect: "manual" }, { DB: env.DB, SESSION_SECRET: SECRET });
    expect([302, 303, 401]).toContain(response.status);
  });

  it("el titular crea, renombra, archiva, restaura y fusiona por las rutas", async () => {
    const t = await team("cv-flujo");
    const base = `/spaces/${t.space.slug}/ledger/categories`;
    const created = await request(t.owner, base, { method: "POST", form: { name: "Peluquería", group: "Vida", icon: "heart" } });
    expect(created.status).toBe(303);
    expect(created.headers.get("Location")).toContain("aviso=categoria-creada");
    let categories = await readCategories(env.DB, t.ledger.id);
    const barber = find(categories, "Peluquería");
    expect(barber).toMatchObject({ group: "Vida", icon: "heart" });

    expect((await request(t.owner, `${base}/${barber.id}`, { method: "POST", form: { name: "Barbería", group: "Vida", icon: "tool" } })).headers.get("Location")).toContain("categoria-guardada");
    expect(find(await readCategories(env.DB, t.ledger.id), "Barbería")).toMatchObject({ id: barber.id, icon: "tool" });

    await request(t.owner, `${base}/${barber.id}/archive`, { method: "POST", form: {} });
    expect(find(await readCategories(env.DB, t.ledger.id), "Barbería").status).toBe("archived");
    await request(t.owner, `${base}/${barber.id}/restore`, { method: "POST", form: {} });
    expect(find(await readCategories(env.DB, t.ledger.id), "Barbería").status).toBe("active");

    const into = find(categories, "Ropa");
    const merged = await request(t.owner, `${base}/${barber.id}/merge`, { method: "POST", form: { into: into.id } });
    expect(merged.headers.get("Location")).toContain("categoria-fusionada");
    categories = await readCategories(env.DB, t.ledger.id);
    expect(find(categories, "Barbería")).toMatchObject({ status: "archived", mergedInto: into.id });
  });

  it("un integrante recibe 403 en cada acción y nada cambia", async () => {
    const t = await team("cv-403");
    const base = `/spaces/${t.space.slug}/ledger/categories`;
    const food = find(t.categories, "Alimentos");
    for (const [path, form] of [[base, { name: "Intrusa" }], [`${base}/${food.id}`, { name: "Hackeada", group: "Casa" }], [`${base}/${food.id}/archive`, {}], [`${base}/${food.id}/restore`, {}], [`${base}/${food.id}/merge`, { into: find(t.categories, "Licor").id }]]) {
      expect((await request(t.member, path, { method: "POST", form })).status).toBe(403);
    }
    const after = await readCategories(env.DB, t.ledger.id);
    expect(after).toHaveLength(t.categories.length);
    expect(find(after, "Alimentos")).toMatchObject({ status: "active", mergedInto: null });
  });

  it("renombrar a un nombre ya usado muestra el motivo con un 409", async () => {
    const t = await team("cv-choque");
    const response = await request(t.owner, `/spaces/${t.space.slug}/ledger/categories/${find(t.categories, "Alimentos").id}`, { method: "POST", form: { name: "RESTAURANTES", group: "Casa" } });
    expect(response.status).toBe(409);
    expect(await response.text()).toContain("Ya existe");
  });

  it("una categoría inexistente responde 404 y una acción sin token CSRF se rechaza", async () => {
    const t = await team("cv-404");
    expect((await request(t.owner, `/spaces/${t.space.slug}/ledger/categories/no-existe/archive`, { method: "POST", form: {} })).status).toBe(404);
    const noToken = await app.request(`https://app.test/spaces/${t.space.slug}/ledger/categories`, { method: "POST", body: new URLSearchParams({ name: "X" }), headers: { Cookie: t.owner.cookie, Origin: "https://app.test" } }, { DB: env.DB, SESSION_SECRET: SECRET });
    expect(noToken.status).toBe(403);
    expect(find(await readCategories(env.DB, t.ledger.id), "X")).toBeUndefined();
  });

  it("con el libro archivado ni el titular puede gestionar", async () => {
    const t = await team("cv-archivado");
    await request(t.owner, `/spaces/${t.space.slug}/ledger/archive`, { method: "POST", form: {} });
    expect((await request(t.owner, `/spaces/${t.space.slug}/ledger/categories`, { method: "POST", form: { name: "Nueva" } })).status).toBe(409);
  });
});

describe("categoría desde el formulario de movimientos", () => {
  it("elige una categoría y el detalle y la lista la muestran", async () => {
    const t = await team("cv-form-elegir");
    const rest = find(t.categories, "Restaurantes");
    const saved = await request(t.owner, `/spaces/${t.space.slug}/ledger/entries`, { method: "POST", form: entryForm(t, { categoryId: rest.id, categoryNew: "" }), headers: { Accept: "application/json" } });
    expect(saved.status).toBe(201);
    const { location } = await saved.json();
    expect(await (await request(t.owner, location)).text()).toContain("Restaurantes");
    const home = await (await request(t.owner, `/spaces/${t.space.slug}`)).text();
    expect(home).toContain("Restaurantes");
  });

  it("escribir una variante usa la existente y escribir un nombre nuevo lo crea", async () => {
    const t = await team("cv-form-escribir");
    const post = form => request(t.owner, `/spaces/${t.space.slug}/ledger/entries`, { method: "POST", form: entryForm(t, form), headers: { Accept: "application/json" } });
    expect((await post({ categoryId: "", categoryNew: "  álimentos " })).status).toBe(201);
    expect((await post({ categoryId: "", categoryNew: "Peluquería canina" })).status).toBe(201);
    const categories = await readCategories(env.DB, t.ledger.id);
    expect(categories).toHaveLength(t.categories.length + 1);
    const data = await readLedger(env.DB, { spaceId: t.space.id, userId: t.owner.user.id });
    expect(data.entries.map(row => row.categoryInfo.name).sort()).toEqual(["Alimentos", "Peluquería canina"]);
  });

  it("una categoría de otro libro se rechaza con 400", async () => {
    const mine = await team("cv-form-ajena-a");
    const other = await team("cv-form-ajena-b");
    const response = await request(mine.owner, `/spaces/${mine.space.slug}/ledger/entries`, { method: "POST", form: entryForm(mine, { categoryId: find(other.categories, "Taxi").id }), headers: { Accept: "application/json" } });
    expect(response.status).toBe(400);
    expect((await readLedger(env.DB, { spaceId: mine.space.id, userId: mine.owner.user.id })).entries).toHaveLength(0);
  });

  it("la pantalla de corrección reabre el movimiento con su categoría", async () => {
    const t = await team("cv-form-reabrir");
    const taxi = find(t.categories, "Taxi");
    const saved = await saveEntry(env.DB, { spaceId: t.space.id, userId: t.owner.user.id, input: entryInput(t.people, { categoryId: taxi.id }), idempotencyKey: crypto.randomUUID() });
    const html = await (await request(t.owner, `/spaces/${t.space.slug}/ledger/entries/${saved.id}/edit`)).text();
    expect(html).toMatch(new RegExp(`<option value="${taxi.id}"[^>]*selected`, "u"));
  });

  it("la lista inicial se siembra al abrir por primera vez un libro anterior", async () => {
    const t = await team("cv-form-anterior");
    await env.DB.prepare("DELETE FROM ledger_categories WHERE ledger_id = ?").bind(t.ledger.id).run();
    const html = await (await request(t.owner, `/spaces/${t.space.slug}/ledger/new`)).text();
    expect(html).toContain("Restaurantes");
    expect((await readCategories(env.DB, t.ledger.id)).length).toBeGreaterThan(40);
  });

  it("sirve /text.js como JavaScript con el texto de la función", async () => {
    const response = await app.request("https://app.test/text.js", {}, { DB: env.DB, SESSION_SECRET: SECRET });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/javascript");
    expect(await response.text()).toBe(TEXT_MODULE_SOURCE);
  });
});

describe("filtro y búsqueda en la lista", () => {
  async function seeded(name) {
    const t = await team(name);
    const make = (description, categoryId) => saveEntry(env.DB, { spaceId: t.space.id, userId: t.owner.user.id, input: entryInput(t.people, { description, categoryId }), idempotencyKey: crypto.randomUUID() });
    await make("Cena afuera", find(t.categories, "Restaurantes").id);
    await make("Pago de luz", find(t.categories, "Electricidad").id);
    await make("Mercado", find(t.categories, "Alimentos").id);
    await make("Sin etiqueta", "");
    return t;
  }
  const rowsOf = html => [...html.matchAll(/<strong class="entry-title">([^<]*)<\/strong>/gu)].map(match => match[1]);

  it("buscar el nombre de una categoría encuentra el movimiento y dice «Categoría»", async () => {
    const t = await seeded("cv-buscar");
    const html = await (await request(t.owner, `/spaces/${t.space.slug}?q=restaurantes`)).text();
    expect(rowsOf(html)).toEqual(["Cena afuera"]);
    expect(html).toContain("Coincide: Categoría");
  });

  it("filtrar por una categoría, por un grupo y por «sin categoría»", async () => {
    const t = await seeded("cv-filtrar");
    const list = async value => rowsOf(await (await request(t.owner, `/spaces/${t.space.slug}?categoria=${encodeURIComponent(value)}`)).text()).sort();
    expect(await list(find(t.categories, "Electricidad").id)).toEqual(["Pago de luz"]);
    expect(await list("g:comidas y bebidas")).toEqual(["Cena afuera", "Mercado"]);
    expect(await list("none")).toEqual(["Sin etiqueta"]);
    expect(await list("g:no-existe")).toEqual([]);
  });

  it("combina búsqueda y filtro y ofrece quitarlos", async () => {
    const t = await seeded("cv-combinar");
    const html = await (await request(t.owner, `/spaces/${t.space.slug}?q=cena&categoria=g:${encodeURIComponent("comidas y bebidas")}`)).text();
    expect(rowsOf(html)).toEqual(["Cena afuera"]);
    expect(html).toContain("Quitar búsqueda y filtro");
  });

  it("los movimientos de una categoría fusionada aparecen al filtrar por la destino", async () => {
    const t = await seeded("cv-filtrar-fusion");
    const food = find(t.categories, "Alimentos");
    const rest = find(t.categories, "Restaurantes");
    await request(t.owner, `/spaces/${t.space.slug}/ledger/categories/${food.id}/merge`, { method: "POST", form: { into: rest.id } });
    const html = await (await request(t.owner, `/spaces/${t.space.slug}?categoria=${rest.id}`)).text();
    expect(rowsOf(html).sort()).toEqual(["Cena afuera", "Mercado"]);
  });
});

describe("exportación con categorías", () => {
  it("el JSON incluye las categorías y los movimientos las referencian", async () => {
    const t = await team("cv-export-json");
    const rest = find(t.categories, "Restaurantes");
    const saved = await saveEntry(env.DB, { spaceId: t.space.id, userId: t.owner.user.id, input: entryInput(t.people, { categoryId: rest.id }), idempotencyKey: crypto.randomUUID() });
    const exported = await exportLedger(env.DB, { spaceId: t.space.id, userId: t.owner.user.id });
    expect(exported.categories).toHaveLength(t.categories.length);
    expect(exported.categories.find(category => category.id === rest.id)).toMatchObject({ name: "Restaurantes", group: "Comidas y bebidas" });
    expect(exported.entries.find(row => row.id === saved.id)).toMatchObject({ categoryId: rest.id });
    expect(exported.revisions.map(row => JSON.parse(row.snapshot_json).categoryName)).toContain("Restaurantes");
    const http = await request(t.owner, `/spaces/${t.space.slug}/ledger/export.json`);
    expect((await http.json()).categories).toHaveLength(t.categories.length);
  });

  it("el CSV muestra el nombre de la categoría de cada fila y escapa fórmulas", async () => {
    const t = await team("cv-export-csv");
    const risky = (await createCategory(env.DB, { ledgerId: t.ledger.id, userId: t.owner.user.id, name: "=SUMA(A1)" })).category;
    await saveEntry(env.DB, { spaceId: t.space.id, userId: t.owner.user.id, input: entryInput(t.people, { categoryId: risky.id }), idempotencyKey: crypto.randomUUID() });
    await saveEntry(env.DB, { spaceId: t.space.id, userId: t.owner.user.id, input: entryInput(t.people, { description: "Otro", categoryId: find(t.categories, "Taxi").id }), idempotencyKey: crypto.randomUUID() });
    const csv = await (await request(t.owner, `/spaces/${t.space.slug}/ledger/export.csv`)).text();
    expect(csv).toContain('"categoria"');
    expect(csv).toContain("\"'=SUMA(A1)\"");
    expect(csv).toContain('"Taxi"');
  });
});

describe("movimientos importados reconocen y crean categorías del libro", () => {
  const csv = "Fecha,Descripción,Categoría,Coste,Moneda,Don Quijote,Sancho Panza\n"
    + "2026-01-03,Posada,restaurantes,80000.00,COP,40000.00,-40000.00\n"
    + "2026-01-05,Forraje,Categoría Que No Existe,30000.00,COP,-15000.00,15000.00\n";

  it("por nombre normalizado adopta la categoría, grupo e ícono; la que no existe se crea al publicar", async () => {
    const owner = await ensureLocalUser(env.DB, "cv-import-owner@example.test");
    const member = await ensureLocalUser(env.DB, "cv-import-member@example.test");
    const space = await createSpaceForUser(env.DB, { userId: owner.id, name: "cv-import" });
    const invitation = await inviteToSpace(env.DB, { spaceId: space.id, inviterUserId: owner.id, email: member.email });
    await resolveInvitation(env.DB, { invitationId: invitation.id, userId: member.id, email: member.email, accepted: true });
    const people = (await readLedger(env.DB, { spaceId: space.id, userId: owner.id })).participants;
    const preview = await createImportPreview(env.DB, { spaceId: space.id, userId: owner.id, fileName: "s.csv", csvText: csv });
    await reviewImportPreview(env.DB, { spaceId: space.id, userId: owner.id, previewId: preview.previewId, mapping: [people.find(p => p.linkedUserId === owner.id).id, people.find(p => p.linkedUserId === member.id).id] });
    const batchId = await confirmImportPreview(env.DB, { spaceId: space.id, userId: owner.id, previewId: preview.previewId, acknowledgeDifference: true });
    await loadImportChunk(env.DB, { spaceId: space.id, userId: owner.id, batchId });
    const data = await readLedger(env.DB, { spaceId: space.id, userId: owner.id });
    const posada = data.entries.find(row => row.description === "Posada");
    const forraje = data.entries.find(row => row.description === "Forraje");
    expect(posada.categoryInfo).toMatchObject({ name: "Restaurantes", group: "Comidas y bebidas", icon: "food" });
    expect(forraje.categoryInfo).toMatchObject({ name: "Categoría Que No Existe", group: "Importadas de Splitwise" });
    expect(data.categories.filter(category => category.name === "Categoría Que No Existe")).toHaveLength(1);
  });
});
