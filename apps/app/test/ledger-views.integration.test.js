import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { createCsrfToken } from "../src/csrf.js";
import { addParticipant, exportLedger, readLedger, saveEntry } from "../src/ledger.js";
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
const draft = (a, b, totalMinor = 20000) => ({
  type: "expense", currency: "COP", totalMinor, description: "Mercado", note: "", occurredAt: "2026-10-22",
  cashParties: [{ participantId: a, direction: "out", amountMinor: totalMinor }],
  allocations: [{ participantId: a, amountMinor: totalMinor / 2 }, { participantId: b, amountMinor: totalMinor / 2 }],
});

async function book(name) {
  const owner = await identity(`${name}-owner@example.test`);
  const space = await createSpaceForUser(env.DB, { userId: owner.user.id, name });
  const beto = await addParticipant(env.DB, { spaceId: space.id, userId: owner.user.id, name: "Beto" });
  const data = await readLedger(env.DB, { spaceId: space.id, userId: owner.user.id });
  const ownId = data.participants.find(person => person.linkedUserId === owner.user.id).id;
  await saveEntry(env.DB, { spaceId: space.id, userId: owner.user.id, input: draft(ownId, beto.id), idempotencyKey: crypto.randomUUID() });
  return { owner, space, ownId, betoId: beto.id };
}

describe("explicación del saldo y sugerencias", () => {
  it("explica el saldo con acumulado y comprobación, sólo a integrantes", async () => {
    const { owner, space, ownId } = await book("Explica");
    const member = await identity("explica-member@example.test");
    const invitation = await inviteToSpace(env.DB, { spaceId: space.id, inviterUserId: owner.user.id, email: member.user.email });
    await resolveInvitation(env.DB, { invitationId: invitation.id, userId: member.user.id, email: member.user.email, accepted: true });
    const page = await request(owner, `/spaces/${space.slug}/ledger/balance`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("Por qué te deben");
    expect(html).toContain("acumulado COP 100,00");
    expect(html).toContain("Coincide con el saldo del grupo");
    const other = await request(owner, `/spaces/${space.slug}/ledger/balance?moneda=COP&persona=${ownId}`);
    expect(other.status).toBe(200);
    expect((await request(member, `/spaces/${space.slug}/ledger/balance`)).status).toBe(200);
    const outsider = await identity("explica-outsider@example.test");
    expect((await request(outsider, `/spaces/${space.slug}/ledger/balance`)).status).toBe(404);
    expect((await app.request(`https://app.test/spaces/${space.slug}/ledger/balance`, undefined, { DB: env.DB, SESSION_SECRET: SECRET })).status).toBe(303);
  });

  it("ofrece «Registrar» con la transferencia prellenada y descarta datos ajenos o malformados", async () => {
    const { owner, space, ownId, betoId } = await book("Sugerencias");
    const overview = await (await request(owner, `/spaces/${space.slug}`)).text();
    expect(overview).toContain("Para quedar a mano");
    expect(overview).toContain("Beto le paga a");
    expect(overview).toContain(`from=${betoId}`);
    const prefilled = await (await request(owner, `/spaces/${space.slug}/ledger/new?type=transfer&from=${betoId}&to=${ownId}&amount=100.00&currency=COP`)).text();
    expect(prefilled).toMatch(new RegExp(`name="from" value="${betoId}" checked`, "u"));
    expect(prefilled).toContain('value="100.00"');
    const hostile = await (await request(owner, `/spaces/${space.slug}/ledger/new?type=transfer&from=participant_ajeno&amount=%22%3E%3Cscript%3E&currency=ZZZ`)).text();
    expect(hostile).not.toContain("<script>");
    expect(hostile).not.toContain("participant_ajeno");
  });
});

describe("archivar y restaurar el grupo", () => {
  it("sólo el titular archiva; un libro archivado rechaza escrituras pero se lee y exporta; restaurar lo reabre", async () => {
    const { owner, space, ownId, betoId } = await book("Archivo");
    const member = await identity("archivo-member@example.test");
    const invitation = await inviteToSpace(env.DB, { spaceId: space.id, inviterUserId: owner.user.id, email: member.user.email });
    await resolveInvitation(env.DB, { invitationId: invitation.id, userId: member.user.id, email: member.user.email, accepted: true });

    const denied = await request(member, `/spaces/${space.slug}/ledger/archive`, { method: "POST", body: "" });
    expect(denied.status).toBe(403);
    expect((await readLedger(env.DB, { spaceId: space.id, userId: owner.user.id })).ledger.archived_at).toBeNull();

    const archived = await request(owner, `/spaces/${space.slug}/ledger/archive`, { method: "POST", body: "" });
    expect(archived.status).toBe(303);
    expect(archived.headers.get("location")).toBe(`/spaces/${space.slug}/people?aviso=archivado`);
    await expect(setLedgerArchived(env.DB, { spaceId: space.id, userId: owner.user.id, archived: true })).rejects.toMatchObject({ status: 409 });

    const writes = [
      request(owner, `/spaces/${space.slug}/participants`, { method: "POST", body: "name=Nueva" }),
      request(owner, `/spaces/${space.slug}/invitations`, { method: "POST", body: "email=otra%40example.test" }),
      request(owner, `/spaces/${space.slug}/ledger/import`),
    ];
    for (const response of await Promise.all(writes)) expect(response.status).toBe(409);
    await expect(saveEntry(env.DB, { spaceId: space.id, userId: owner.user.id, input: draft(ownId, betoId), idempotencyKey: crypto.randomUUID() })).rejects.toMatchObject({ status: 409 });

    const view = await (await request(owner, `/spaces/${space.slug}`)).text();
    expect(view).toContain("Este grupo está archivado");
    expect(view).toContain(`href="/spaces/${space.slug}/people">Personas</a>`);
    expect(view).not.toContain("Para quedar a mano");
    const people = await (await request(owner, `/spaces/${space.slug}/people`)).text();
    expect(people).toContain("Restaurar grupo");
    expect(people).not.toContain("Archivar grupo");
    expect(people).not.toContain("Unir con otra persona");
    expect((await request(member, `/spaces/${space.slug}/ledger/export.json`)).status).toBe(200);
    const data = await exportLedger(env.DB, { spaceId: space.id, userId: owner.user.id });
    expect(data.events.map(event => event.action)).toContain("ledger_archived");

    const restored = await request(owner, `/spaces/${space.slug}/ledger/restore`, { method: "POST", body: "" });
    expect(restored.status).toBe(303);
    const reopened = await saveEntry(env.DB, { spaceId: space.id, userId: owner.user.id, input: draft(ownId, betoId), idempotencyKey: crypto.randomUUID() });
    expect(reopened.revision).toBe(1);
    const after = await exportLedger(env.DB, { spaceId: space.id, userId: owner.user.id });
    expect(after.events.map(event => event.action)).toEqual(expect.arrayContaining(["ledger_archived", "ledger_restored"]));
  });
});

describe("nombres de participantes", () => {
  it("rechaza un nombre repetido entre activos sin distinguir mayúsculas ni acentos", async () => {
    const owner = await identity("nombres-owner@example.test");
    const space = await createSpaceForUser(env.DB, { userId: owner.user.id, name: "Nombres" });
    await addParticipant(env.DB, { spaceId: space.id, userId: owner.user.id, name: "José Pérez" });
    for (const name of ["jose perez", "  JOSÉ   PÉREZ "]) {
      await expect(addParticipant(env.DB, { spaceId: space.id, userId: owner.user.id, name })).rejects.toMatchObject({ status: 409 });
    }
    const response = await request(owner, `/spaces/${space.slug}/participants`, { method: "POST", body: "name=Jose+Perez" });
    expect(response.status).toBe(409);
    expect(await response.text()).toContain("Ya hay una persona con ese nombre");
    await addParticipant(env.DB, { spaceId: space.id, userId: owner.user.id, name: "José Pérez 2" });
    expect((await readLedger(env.DB, { spaceId: space.id, userId: owner.user.id })).participants).toHaveLength(3);
  });
});
