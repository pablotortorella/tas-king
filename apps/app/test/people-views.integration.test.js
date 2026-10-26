import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { createCsrfToken } from "../src/csrf.js";
import { addParticipant, readLedger, saveEntry } from "../src/ledger.js";
import { setLedgerArchived } from "../src/ledger-admin.js";
import { createSession } from "../src/sessions.js";
import { createSpaceForUser, ensureLocalUser, inviteToSpace, resolveInvitation } from "../src/spaces.js";

const SECRET = "v".repeat(32);

async function identity(email) {
  const user = await ensureLocalUser(env.DB, email);
  const session = await createSession(env.DB, { userId: user.id, secret: SECRET });
  return { user, cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}`, csrf: await createCsrfToken({ sessionId: session.id, secret: SECRET }) };
}
function request(who, path, init = {}) {
  const post = init.method === "POST";
  const headers = { Cookie: who.cookie, ...(post ? { Origin: "https://app.test", "X-CSRF-Token": who.csrf, "Content-Type": "application/x-www-form-urlencoded" } : {}), ...init.headers };
  return app.request(`https://app.test${path}`, { ...init, headers }, { DB: env.DB, SESSION_SECRET: SECRET });
}
const form = fields => new URLSearchParams(fields).toString();

async function book(name) {
  const owner = await identity(`${name}-owner@example.test`);
  const member = await identity(`${name}-member@example.test`);
  const space = await createSpaceForUser(env.DB, { userId: owner.user.id, name });
  const invitation = await inviteToSpace(env.DB, { spaceId: space.id, inviterUserId: owner.user.id, email: member.user.email });
  await resolveInvitation(env.DB, { invitationId: invitation.id, userId: member.user.id, email: member.user.email, accepted: true });
  const ana = await addParticipant(env.DB, { spaceId: space.id, userId: owner.user.id, name: "Ana" });
  const beto = await addParticipant(env.DB, { spaceId: space.id, userId: owner.user.id, name: "Beto" });
  const data = await readLedger(env.DB, { spaceId: space.id, userId: owner.user.id });
  const ownId = data.participants.find(person => person.linkedUserId === owner.user.id).id;
  await saveEntry(env.DB, { spaceId: space.id, userId: owner.user.id, idempotencyKey: crypto.randomUUID(), input: { type: "expense", currency: "COP", totalMinor: 20000, description: "Mercado", note: "", occurredAt: "2026-10-22", cashParties: [{ participantId: ana.id, direction: "out", amountMinor: 20000 }], allocations: [{ participantId: ana.id, amountMinor: 10000 }, { participantId: beto.id, amountMinor: 10000 }] } });
  return { owner, member, space, ownId, anaId: ana.id, betoId: beto.id, base: `/spaces/${space.slug}` };
}

describe("pantalla de personas", () => {
  it("la titular ve la lista con saldos y las herramientas; un integrante la ve en solo lectura", async () => {
    const t = await book("pv-lista");
    const owner = await (await request(t.owner, `${t.base}/people`)).text();
    expect(owner).toContain("<h1>Personas</h1>");
    for (const text of ["Ana", "Beto", "Sin cuenta", "Administrar grupo", "Agregar participante", "Unir con otra persona", "Renombrar", "+COP 100,00", "−COP 100,00"]) expect(owner).toContain(text);
    expect(owner).toContain(`href="${t.base}/people/${t.anaId}/merge"`);
    const member = await (await request(t.member, `${t.base}/people`)).text();
    expect(member).toContain("Ana");
    for (const text of ["Administrar grupo", "Agregar participante", "Unir con otra persona", "Guardar nombre"]) expect(member).not.toContain(text);
  });

  it("el libro ya no repite las herramientas de administración, pero enlaza a las personas", async () => {
    const t = await book("pv-libro");
    const html = await (await request(t.owner, t.base)).text();
    expect(html).not.toContain("Administrar grupo");
    expect(html).not.toContain("Agregar participante");
    expect(html).toContain(`href="${t.base}/people"`);
  });

  it("sin sesión pide iniciar sesión y quien no es del grupo no la ve", async () => {
    const t = await book("pv-acceso");
    const anonymous = await app.request(`https://app.test${t.base}/people`, {}, { DB: env.DB, SESSION_SECRET: SECRET });
    expect(anonymous.status).toBe(303);
    const stranger = await identity("pv-acceso-extrano@example.test");
    expect((await request(stranger, `${t.base}/people`)).status).toBe(404);
  });

  it("renombrar por la web guarda el nombre y avisa; un integrante recibe 403; un nombre repetido, 409", async () => {
    const t = await book("pv-renombrar");
    const saved = await request(t.owner, `${t.base}/people/${t.anaId}/rename`, { method: "POST", body: form({ name: "Ana María" }) });
    expect(saved.status).toBe(303);
    expect(saved.headers.get("location")).toBe(`${t.base}/people?aviso=persona-renombrada`);
    const page = await (await request(t.owner, saved.headers.get("location"))).text();
    expect(page).toContain("Nombre guardado.");
    expect(page).toContain("Ana María");
    expect((await request(t.member, `${t.base}/people/${t.anaId}/rename`, { method: "POST", body: form({ name: "Otra" }) })).status).toBe(403);
    const duplicate = await request(t.owner, `${t.base}/people/${t.anaId}/rename`, { method: "POST", body: form({ name: "beto" }) });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.text()).toContain("Ya hay una persona con ese nombre");
  });

  it("agregar una persona vuelve a la pantalla de personas con su aviso", async () => {
    const t = await book("pv-agregar");
    const added = await request(t.owner, `${t.base}/participants`, { method: "POST", body: form({ name: "Caro" }) });
    expect(added.headers.get("location")).toBe(`${t.base}/people?aviso=participante`);
    expect(await (await request(t.owner, added.headers.get("location"))).text()).toContain("Participante agregado.");
  });
});

describe("unir por la web", () => {
  it("elegir, ver qué cambia, confirmar y ver a la persona unida en el historial de personas", async () => {
    const t = await book("pv-unir");
    const choose = await (await request(t.owner, `${t.base}/people/${t.anaId}/merge`)).text();
    expect(choose).toContain("Unir a Ana");
    expect(choose).toContain(`value="${t.betoId}"`);
    expect(choose).not.toContain(`value="${t.anaId}"`);
    const preview = await request(t.owner, `${t.base}/people/${t.anaId}/merge/preview?into=${t.betoId}`);
    expect(preview.status).toBe(200);
    const html = await preview.text();
    expect(html).toContain("Unir a Ana con Beto");
    expect(html).toContain("1 movimiento pasa de Ana a Beto");
    expect(html).toContain("Mercado");
    expect(html).toContain("no se puede deshacer");
    const key = /name="key" value="([^"]+)"/u.exec(html)[1];
    const revision = /name="expectedRevision" value="([^"]+)"/u.exec(html)[1];
    expect((await readLedger(env.DB, { spaceId: t.space.id, userId: t.owner.user.id })).participants.map(p => p.id)).toContain(t.anaId);
    const confirm = () => request(t.owner, `${t.base}/people/${t.anaId}/merge`, { method: "POST", body: form({ into: t.betoId, key, expectedRevision: revision }) });
    const done = await confirm();
    expect(done.status).toBe(303);
    expect(done.headers.get("location")).toBe(`${t.base}/people?aviso=personas-unidas`);
    expect((await confirm()).status).toBe(303);
    const people = await (await request(t.owner, done.headers.get("location"))).text();
    expect(people).toContain("Personas unidas.");
    expect(people).toContain("Personas unidas</h2>");
    expect(people).toContain("unida a Beto");
    const entry = (await readLedger(env.DB, { spaceId: t.space.id, userId: t.owner.user.id })).entries[0];
    const detail = await (await request(t.owner, `${t.base}/ledger/entries/${encodeURIComponent(entry.id)}`)).text();
    expect(detail).toContain("Cambió: unión de personas");
    const edit = await (await request(t.owner, `${t.base}/ledger/entries/${encodeURIComponent(entry.id)}/edit`)).text();
    expect(edit).toContain("Corregir movimiento");
  });

  it("rechaza elegir a la misma persona, a una inexistente o sin permiso", async () => {
    const t = await book("pv-unir-rechazos");
    expect((await request(t.owner, `${t.base}/people/${t.anaId}/merge/preview?into=${t.anaId}`)).status).toBe(400);
    expect((await request(t.owner, `${t.base}/people/${t.anaId}/merge/preview?into=participant_nope`)).status).toBe(404);
    expect((await request(t.owner, `${t.base}/people/${t.anaId}/merge/preview`)).status).toBe(400);
    expect((await request(t.member, `${t.base}/people/${t.anaId}/merge`)).status).toBe(403);
    expect((await request(t.member, `${t.base}/people/${t.anaId}/merge/preview?into=${t.betoId}`)).status).toBe(403);
    expect((await request(t.member, `${t.base}/people/${t.anaId}/merge`, { method: "POST", body: form({ into: t.betoId, key: crypto.randomUUID() }) })).status).toBe(403);
    expect((await request(t.owner, `${t.base}/people/${t.anaId}/merge`, { method: "POST", body: form({ into: t.betoId, key: "corta" }) })).status).toBe(400);
  });

  it("no ofrece unir en un grupo archivado y rechaza la operación", async () => {
    const t = await book("pv-unir-archivado");
    await setLedgerArchived(env.DB, { spaceId: t.space.id, userId: t.owner.user.id, archived: true });
    expect((await request(t.owner, `${t.base}/people/${t.anaId}/merge`)).status).toBe(409);
    expect((await request(t.owner, `${t.base}/people/${t.anaId}/merge`, { method: "POST", body: form({ into: t.betoId, key: crypto.randomUUID() }) })).status).toBe(409);
  });

  it("si el libro cambió después de la vista previa, la confirmación se rechaza y no escribe", async () => {
    const t = await book("pv-unir-cambio");
    const html = await (await request(t.owner, `${t.base}/people/${t.anaId}/merge/preview?into=${t.betoId}`)).text();
    const key = /name="key" value="([^"]+)"/u.exec(html)[1];
    const revision = /name="expectedRevision" value="([^"]+)"/u.exec(html)[1];
    await addParticipant(env.DB, { spaceId: t.space.id, userId: t.owner.user.id, name: "Caro" });
    const stale = await request(t.owner, `${t.base}/people/${t.anaId}/merge`, { method: "POST", body: form({ into: t.betoId, key, expectedRevision: revision }) });
    expect(stale.status).toBe(409);
    expect(await stale.text()).toContain("El libro cambió");
    expect((await readLedger(env.DB, { spaceId: t.space.id, userId: t.owner.user.id })).participants.map(p => p.id)).toContain(t.anaId);
  });
});
