import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/index.js";
import { createCsrfToken } from "../src/csrf.js";
import { readLedger, saveEntry } from "../src/ledger.js";
import { createSession } from "../src/sessions.js";
import { createGroupForUser, ensureLocalUser, inviteToGroup, resolveInvitation } from "../src/groups.js";
import { seedEntries } from "./fixtures/seed-entries.js";

const SECRET = "l".repeat(32);

async function identity(email) {
  const user = await ensureLocalUser(env.DB, email);
  const session = await createSession(env.DB, { userId: user.id, secret: SECRET });
  return { user, cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}`, csrf: await createCsrfToken({ sessionId: session.id, secret: SECRET }) };
}
function request(who, path, init = {}, extraEnv = {}) {
  const post = init.method === "POST";
  const headers = { Cookie: who.cookie, ...(post ? { Origin: "https://app.test", "X-CSRF-Token": who.csrf, "Content-Type": "application/x-www-form-urlencoded" } : {}), ...init.headers };
  const body = post ? new URLSearchParams(init.form ?? []).toString() : undefined;
  return app.request(`https://app.test${path}`, { method: init.method, body, headers, redirect: "manual" }, { DB: env.DB, SESSION_SECRET: SECRET, ...extraEnv });
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
  return { owner, member, group, ledger: data.ledger, ownerId, memberId, base: `/groups/${group.slug}` };
}
const entryForm = (t, extra = {}) => [["type", "expense"], ["currency", "COP"], ["amount", "100,00"], ["description", "Compra"], ["occurredAt", "2026-06-01"], ["payer", t.ownerId], ["splitMethod", "equal"], ["beneficiary", t.ownerId], ["beneficiary", t.memberId], ["idempotencyKey", crypto.randomUUID()], ...Object.entries(extra)];
const add = (t, description, extra = {}) => saveEntry(env.DB, { groupId: t.group.id, userId: t.owner.user.id, idempotencyKey: crypto.randomUUID(), input: {
  type: "expense", currency: "COP", totalMinor: 10000, description, note: "", occurredAt: "2026-06-01",
  cashParties: [{ participantId: t.ownerId, direction: "out", amountMinor: 10000 }], allocations: [{ participantId: t.ownerId, amountMinor: 5000 }, { participantId: t.memberId, amountMinor: 5000 }], ...extra } });
const titles = html => [...html.matchAll(/<strong class="entry-title">([^<]*)<\/strong>/gu)].map(match => match[1]);

describe("orden de la lista", () => {
  it("dos movimientos del mismo día: el último cargado aparece primero, y los saldos no cambian", async () => {
    const t = await team("ls-orden");
    await add(t, "Primero cargado");
    await add(t, "Segundo cargado");
    await add(t, "Tercero cargado");
    const data = await readLedger(env.DB, { groupId: t.group.id, userId: t.owner.user.id });
    expect(data.entries.map(entry => entry.description)).toEqual(["Tercero cargado", "Segundo cargado", "Primero cargado"]);
    expect(data.balances.find(row => row.participantId === t.ownerId).amountMinor).toBe(15000);
    const html = await (await request(t.owner, t.base)).text();
    expect(titles(html)).toEqual(["Tercero cargado", "Segundo cargado", "Primero cargado"]);
  });

  it("la fecha manda sobre el orden de carga", async () => {
    const t = await team("ls-fecha");
    await add(t, "Cargado primero, fecha nueva", { occurredAt: "2026-07-01" });
    await add(t, "Cargado después, fecha vieja", { occurredAt: "2026-01-01" });
    const html = await (await request(t.owner, t.base)).text();
    expect(titles(html)).toEqual(["Cargado primero, fecha nueva", "Cargado después, fecha vieja"]);
  });

  it("muchos movimientos cargados en el mismo segundo conservan el orden de carga", async () => {
    const t = await team("ls-lote");
    await seedEntries(env.DB, { ledgerId: t.ledger.id, userId: t.owner.user.id, payerId: t.ownerId, otherId: t.memberId, count: 30, prefix: "Fila" });
    const data = await readLedger(env.DB, { groupId: t.group.id, userId: t.owner.user.id });
    expect(data.entries.map(entry => entry.description)).toEqual(Array.from({ length: 30 }, (_, index) => `Fila ${29 - index}`));
  });
});

describe("regreso a la lista", () => {
  it("guardar redirige a la lista con el aviso y el identificador, y el JSON devuelve esa ubicación", async () => {
    const t = await team("ls-guardar");
    const plain = await request(t.owner, `${t.base}/ledger/entries`, { method: "POST", form: entryForm(t) });
    expect(plain.status).toBe(303);
    expect(plain.headers.get("Location")).toMatch(new RegExp(`^${t.base}\\?aviso=guardado&nuevo=entry_[^&#]+#movimientos$`, "u"));
    const json = await request(t.owner, `${t.base}/ledger/entries`, { method: "POST", form: entryForm(t), headers: { Accept: "application/json" } });
    expect(json.status).toBe(201);
    const body = await json.json();
    expect(body.location).toBe(`${t.base}?aviso=guardado&nuevo=${body.id}#movimientos`);
  });

  it("corregir y anular también vuelven a la lista", async () => {
    const t = await team("ls-corregir");
    const saved = await add(t, "Para corregir");
    const edit = await request(t.owner, `${t.base}/ledger/entries/${saved.id}/edit`, { method: "POST", form: [...entryForm(t, { description: "Corregido", expectedRevision: "1" })] });
    expect(edit.status).toBe(303);
    expect(edit.headers.get("Location")).toBe(`${t.base}?aviso=corregido&nuevo=${saved.id}#movimientos`);
    const editJson = await request(t.owner, `${t.base}/ledger/entries/${saved.id}/edit`, { method: "POST", form: entryForm(t, { description: "Corregido otra vez", expectedRevision: "2" }), headers: { Accept: "application/json" } });
    expect((await editJson.json()).location).toBe(`${t.base}?aviso=corregido&nuevo=${saved.id}#movimientos`);
    const voided = await request(t.owner, `${t.base}/ledger/entries/${saved.id}/void`, { method: "POST", form: [["expectedRevision", "3"], ["idempotencyKey", crypto.randomUUID()], ["reason", "Duplicado"]] });
    expect(voided.status).toBe(303);
    expect(voided.headers.get("Location")).toBe(`${t.base}?aviso=anulado&nuevo=${saved.id}#movimientos`);
  });

  it("la lista muestra la franja con el movimiento afectado, su enlace al detalle y el mensaje", async () => {
    const t = await team("ls-franja");
    const saved = await add(t, "Movimiento nuevo", { occurredAt: "2020-01-01" });
    for (let index = 0; index < 45; index += 1) await add(t, `Más nuevo ${index}`, { occurredAt: "2026-08-01" });
    const plain = await (await request(t.owner, t.base)).text();
    expect(plain).not.toContain("recent-strip");
    expect(titles(plain)).not.toContain("Movimiento nuevo");
    const html = await (await request(t.owner, `${t.base}?aviso=guardado&nuevo=${saved.id}`)).text();
    expect(html).toContain("Movimiento guardado.");
    expect(html).toMatch(/<section class="recent-strip"[^>]*><h3>Recién agregado<\/h3>/u);
    expect(html).toContain(`href="${t.base}/ledger/entries/${saved.id}"`);
    expect(titles(html)[0]).toBe("Movimiento nuevo");
    expect(html.match(/Movimiento nuevo/gu).length).toBeGreaterThanOrEqual(1);
  });

  it("los títulos de la franja cambian con la acción", async () => {
    const t = await team("ls-franja-titulos");
    const saved = await add(t, "Uno");
    for (const [aviso, title] of [["guardado", "Recién agregado"], ["corregido", "Recién corregido"], ["anulado", "Recién anulado"], ["raro", "Recién agregado"]]) {
      const html = await (await request(t.owner, `${t.base}?aviso=${aviso}&nuevo=${saved.id}`)).text();
      expect(html).toContain(`<h3>${title}</h3>`);
    }
  });

  it("un identificador ajeno, inexistente o malformado se ignora sin error ni franja", async () => {
    const t = await team("ls-franja-ajena");
    const other = await team("ls-franja-otro");
    const foreign = await add(other, "De otro libro");
    for (const nuevo of [foreign.id, "no-existe", "%3Cscript%3Ealert(1)%3C%2Fscript%3E"]) {
      const response = await request(t.owner, `${t.base}?aviso=guardado&nuevo=${nuevo}`);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).not.toContain("recent-strip");
      expect(html).not.toContain("<script>alert");
    }
  });

  it("un movimiento anulado se muestra tachado en la franja", async () => {
    const t = await team("ls-franja-anulado");
    const saved = await add(t, "Para anular");
    await request(t.owner, `${t.base}/ledger/entries/${saved.id}/void`, { method: "POST", form: [["expectedRevision", "1"], ["idempotencyKey", crypto.randomUUID()]] });
    const html = await (await request(t.owner, `${t.base}?aviso=anulado&nuevo=${saved.id}`)).text();
    expect(html).toMatch(/recent-strip[\s\S]*entry-voided/u);
    expect(html).toContain("Anulado");
  });

  it("el detalle sigue disponible desde la lista", async () => {
    const t = await team("ls-detalle");
    const saved = await add(t, "Con detalle");
    const response = await request(t.owner, `${t.base}/ledger/entries/${saved.id}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Con detalle");
  });
});

describe("buscar por persona desde la lista", () => {
  it("con dos personas ofrece «Pagó X (N)» y «Participa X (M)» y el filtro reduce los resultados", async () => {
    const t = await team("ls-persona");
    await add(t, "Pagó el titular uno");
    await add(t, "Pagó el titular dos");
    await add(t, "Pagó el integrante", { cashParties: [{ participantId: t.memberId, direction: "out", amountMinor: 10000 }] });
    const memberName = (await readLedger(env.DB, { groupId: t.group.id, userId: t.owner.user.id })).participants.find(person => person.id === t.memberId).displayName;
    const html = await (await request(t.owner, `${t.base}?q=${encodeURIComponent(memberName)}`)).text();
    expect(titles(html)).toHaveLength(3);
    expect(html).toContain(`Pagó ${memberName} (1)`);
    expect(html).toContain(`Participa ${memberName} (3)`);
    const paid = await (await request(t.owner, `${t.base}?q=${encodeURIComponent(memberName)}&quien=pago:${t.memberId}`)).text();
    expect(titles(paid)).toEqual(["Pagó el integrante"]);
    expect(paid).toContain('aria-current="true"');
    expect(paid).toContain("Quitar búsqueda y filtros");
  });

  it("«Ver más» conserva el filtro de persona", async () => {
    const t = await team("ls-persona-mas");
    await seedEntries(env.DB, { ledgerId: t.ledger.id, userId: t.owner.user.id, payerId: t.ownerId, otherId: t.memberId, count: 95, prefix: "Fila" });
    const ownerName = (await readLedger(env.DB, { groupId: t.group.id, userId: t.owner.user.id })).participants.find(person => person.id === t.ownerId).displayName;
    const html = await (await request(t.owner, `${t.base}?q=${encodeURIComponent(ownerName)}&quien=pago:${t.ownerId}`)).text();
    expect(titles(html)).toHaveLength(40);
    expect(html).toContain("Ver 40 movimientos más");
    expect(html).toMatch(/quien=pago%3A/u);
  });
});

describe("aviso de apertura lenta del libro", () => {
  afterEach(() => vi.restoreAllMocks());

  it("se emite con un libro que supera el umbral y no con uno que lo respeta", async () => {
    const t = await team("ls-lento");
    await seedEntries(env.DB, { ledgerId: t.ledger.id, userId: t.owner.user.id, payerId: t.ownerId, otherId: t.memberId, count: 300 });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await request(t.owner, t.base, {}, { SLOW_BOOK_MS: "0" });
    const events = warn.mock.calls.map(call => String(call[0])).filter(line => line.includes("slow_book_open")).map(line => JSON.parse(line));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ event: "slow_book_open", entries: 300, participants: 2, thresholdMs: 0, overSqlTrigger: false });
    warn.mockClear();
    await request(t.owner, t.base, {}, { SLOW_BOOK_MS: "600000" });
    expect(warn.mock.calls.filter(call => String(call[0]).includes("slow_book_open"))).toHaveLength(0);
  });

  it("el evento no lleva nombres, descripciones ni importes", async () => {
    const t = await team("ls-lento-privado");
    await add(t, "Descripción secreta 123456");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await request(t.owner, t.base, {}, { SLOW_BOOK_MS: "0" });
    const line = warn.mock.calls.map(call => String(call[0])).find(text => text.includes("slow_book_open"));
    expect(line).toBeDefined();
    expect(line).not.toContain("secreta");
    expect(line).not.toContain("owner@example");
    expect(Object.keys(JSON.parse(line)).sort()).toEqual(["categories", "elapsedMs", "entries", "event", "overSqlTrigger", "participants", "requestId", "thresholdMs"]);
  });
});
