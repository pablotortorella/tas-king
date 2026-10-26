import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { addParticipant, readLedger, saveEntry } from "../src/ledger.js";
import { createSession } from "../src/sessions.js";
import { createSpaceForUser, ensureLocalUser, inviteToSpace } from "../src/spaces.js";

// El glosario (docs/homesuite/GLOSARIO.md) deja una sola palabra para «grupo»: ni «espacio» ni «libro» se ven en pantalla.
const SECRET = "l".repeat(32);

async function identity(email) {
  const user = await ensureLocalUser(env.DB, email);
  const session = await createSession(env.DB, { userId: user.id, secret: SECRET });
  return { user, cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}` };
}
const get = (who, path) => app.request(`https://app.test${path}`, { headers: who ? { Cookie: who.cookie } : {}, redirect: "manual" }, { DB: env.DB, SESSION_SECRET: SECRET, ...(path.startsWith("/demo/") ? { DEV_LOCAL_MODE: "true" } : {}) });

// Lo que la persona lee: texto y atributos accesibles, sin scripts, estilos, direcciones ni nombres técnicos.
export function visibleText(html) {
  const cleaned = html.replace(/<script[\s\S]*?<\/script>/giu, " ").replace(/<style[\s\S]*?<\/style>/giu, " ").replace(/<!--[\s\S]*?-->/gu, " ");
  const attributes = [...cleaned.matchAll(/\s(?:aria-label|title|placeholder|alt|aria-description)="([^"]*)"/gu)].map(match => match[1]);
  return [cleaned.replace(/<[^>]*>/gu, " "), ...attributes].join("\n");
}
const WORDS = /\b(espacios?|libros?)\b/iu;

describe("el vocabulario de las pantallas", () => {
  it("ninguna pantalla de Cuentas Claras dice «espacio» ni «libro»", async () => {
    const owner = await identity("lang-owner@example.test");
    const guest = await identity("lang-guest@example.test");
    const space = await createSpaceForUser(env.DB, { userId: owner.user.id, name: "Casa" });
    const invitation = await inviteToSpace(env.DB, { spaceId: space.id, inviterUserId: owner.user.id, email: guest.user.email });
    await addParticipant(env.DB, { spaceId: space.id, userId: owner.user.id, name: "Ana" });
    const data = await readLedger(env.DB, { spaceId: space.id, userId: owner.user.id });
    const ana = data.participants.find(person => person.displayName === "Ana");
    const ownId = data.participants.find(person => person.linkedUserId === owner.user.id).id;
    const saved = await saveEntry(env.DB, { spaceId: space.id, userId: owner.user.id, idempotencyKey: crypto.randomUUID(), input: { type: "expense", currency: "COP", totalMinor: 20000, description: "Mercado", note: "", occurredAt: "2026-10-22", cashParties: [{ participantId: ana.id, direction: "out", amountMinor: 20000 }], allocations: [{ participantId: ana.id, amountMinor: 10000 }, { participantId: ownId, amountMinor: 10000 }] } });
    const base = `/spaces/${space.slug}`;
    const entryId = saved.entryId ?? saved.entry?.id ?? saved.id;

    const pages = [
      "/", "/cuentas-claras?todos=1", "/spaces/new", "/invitations", "/perfil",
      "/demo/crear-espacio", "/demo/espacio", "/demo/invitacion",
      base, `${base}?q=mercado`, `${base}/people`, `${base}/people/${ana.id}/merge`,
      `${base}/ledger/balance`, `${base}/ledger/new?type=expense`, `${base}/ledger/new?type=transfer`,
      `${base}/ledger/categories`, `${base}/ledger/classify`, `${base}/ledger/import`,
      `${base}/ledger/entries/${entryId}`, `${base}/ledger/entries/${entryId}/edit`, `${base}/ledger/entries/${entryId}/void`,
    ];
    const offenders = [];
    for (const path of pages) {
      const response = await get(owner, path);
      expect(response.status, path).toBeLessThan(400);
      const match = visibleText(await response.text()).match(WORDS);
      if (match) offenders.push(`${path}: «${match[0]}»`);
    }
    const guestInvitations = visibleText(await (await get(guest, "/invitations")).text()).match(WORDS);
    if (guestInvitations) offenders.push(`/invitations (invitado): «${guestInvitations[0]}»`);
    expect(invitation.id).toBeTruthy();
    expect(offenders).toEqual([]);
  });

  it("el detector de texto visible ignora URLs y marcas técnicas", () => {
    expect(visibleText('<a href="/spaces/x" class="libro">Hola</a><script>var libro=1</script>').match(WORDS)).toBeNull();
    expect(visibleText('<a aria-label="Volver al libro">←</a>').match(WORDS)?.[0]).toBe("libro");
    expect(visibleText("<p>Crear espacio</p>").match(WORDS)?.[0]).toBe("espacio");
  });
});
