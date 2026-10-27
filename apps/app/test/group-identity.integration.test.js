import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { createCsrfToken } from "../src/csrf.js";
import { createGroupForUser, ensureLocalUser, inviteToGroup, resolveInvitation, updateGroup } from "../src/groups.js";
import { createSession } from "../src/sessions.js";

const SECRET = "i".repeat(32);

async function identity(email) {
  const user = await ensureLocalUser(env.DB, email);
  const session = await createSession(env.DB, { userId: user.id, secret: SECRET });
  return { user, cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}`, csrf: await createCsrfToken({ sessionId: session.id, secret: SECRET }) };
}
function request(who, path, { cookie = "", ...init } = {}) {
  const post = init.method === "POST";
  const headers = { Cookie: [who?.cookie, cookie].filter(Boolean).join("; "), ...(post ? { Origin: "https://app.test", "X-CSRF-Token": who.csrf, "Content-Type": "application/x-www-form-urlencoded" } : {}), ...init.headers };
  return app.request(`https://app.test${path}`, { redirect: "manual", ...init, headers }, { DB: env.DB, SESSION_SECRET: SECRET });
}
const form = fields => new URLSearchParams(fields).toString();
const lastGroupCookie = response => /(?:^|,\s*)last_group=([^;]+)/u.exec(response.headers.get("Set-Cookie") ?? "")?.[1];
let counter = 0;
const unique = prefix => `${prefix}-${Date.now().toString(36)}-${counter++}`;

async function groupWithMember(name = unique("grp")) {
  const owner = await identity(`${name}-owner@example.test`);
  const member = await identity(`${name}-member@example.test`);
  const group = await createGroupForUser(env.DB, { userId: owner.user.id, name });
  const invitation = await inviteToGroup(env.DB, { groupId: group.id, inviterUserId: owner.user.id, email: member.user.email });
  await resolveInvitation(env.DB, { invitationId: invitation.id, userId: member.user.id, email: member.user.email, accepted: true });
  return { owner, member, group, base: `/groups/${group.slug}` };
}

describe("administrar la identidad del grupo", () => {
  it("la persona titular cambia nombre, descripción, emoji y color y queda auditado", async () => {
    const { owner, group } = await groupWithMember();
    const updated = await updateGroup(env.DB, { groupId: group.slug, userId: owner.user.id, name: "Viaje", description: "Cartagena, diciembre", emoji: "✈️", color: "violet" });
    expect(updated).toMatchObject({ name: "Viaje", description: "Cartagena, diciembre", emoji: "✈️", color: "violet" });
    const row = await env.DB.prepare("SELECT name, description, avatar_emoji, avatar_color FROM groups WHERE id = ?").bind(group.id).first();
    expect(row).toEqual({ name: "Viaje", description: "Cartagena, diciembre", avatar_emoji: "✈️", avatar_color: "violet" });
    const audit = await env.DB.prepare("SELECT action, actor_user_id FROM platform_audit_events WHERE group_id = ? ORDER BY rowid DESC LIMIT 1").bind(group.id).first();
    expect(audit).toEqual({ action: "group_updated", actor_user_id: owner.user.id });
  });

  it("lo que no se envía no cambia, y vacío quita descripción, emoji y color", async () => {
    const { owner, group } = await groupWithMember();
    await updateGroup(env.DB, { groupId: group.id, userId: owner.user.id, description: "Hola", emoji: "🏠", color: "rose" });
    await updateGroup(env.DB, { groupId: group.id, userId: owner.user.id, name: "Otro nombre" });
    expect(await env.DB.prepare("SELECT description, avatar_emoji, avatar_color FROM groups WHERE id = ?").bind(group.id).first()).toEqual({ description: "Hola", avatar_emoji: "🏠", avatar_color: "rose" });
    await updateGroup(env.DB, { groupId: group.id, userId: owner.user.id, description: "", emoji: "", color: "" });
    expect(await env.DB.prepare("SELECT description, avatar_emoji, avatar_color FROM groups WHERE id = ?").bind(group.id).first()).toEqual({ description: null, avatar_emoji: null, avatar_color: null });
  });

  it("un integrante recibe 403, quien no es del grupo 404, y no cambia nada", async () => {
    const { member, group } = await groupWithMember();
    const stranger = await identity(`${unique("extra")}@example.test`);
    await expect(updateGroup(env.DB, { groupId: group.id, userId: member.user.id, name: "Mío" })).rejects.toMatchObject({ status: 403 });
    await expect(updateGroup(env.DB, { groupId: group.id, userId: stranger.user.id, name: "Mío" })).rejects.toMatchObject({ status: 404 });
    expect((await env.DB.prepare("SELECT name FROM groups WHERE id = ?").bind(group.id).first()).name).toBe(group.name);
  });

  it("rechaza nombre vacío, emoji inválido y descripción de 501 caracteres sin cambiar el grupo; la base también rechaza 501", async () => {
    const { owner, group } = await groupWithMember();
    await expect(updateGroup(env.DB, { groupId: group.id, userId: owner.user.id, name: "  " })).rejects.toThrow(/entre 1 y 120/u);
    await expect(updateGroup(env.DB, { groupId: group.id, userId: owner.user.id, emoji: "hola" })).rejects.toThrow("Elegí un único emoji completo.");
    await expect(updateGroup(env.DB, { groupId: group.id, userId: owner.user.id, description: "a".repeat(501) })).rejects.toThrow(/hasta 500/u);
    await expect(updateGroup(env.DB, { groupId: group.id, userId: owner.user.id, name: "Bien", emoji: "x" })).rejects.toThrow();
    expect((await env.DB.prepare("SELECT name FROM groups WHERE id = ?").bind(group.id).first()).name).toBe(group.name);
    await expect(env.DB.prepare("UPDATE groups SET description = ? WHERE id = ?").bind("a".repeat(501), group.id).run()).rejects.toThrow(/CHECK/u);
    await env.DB.prepare("UPDATE groups SET description = ? WHERE id = ?").bind("a".repeat(500), group.id).run();
  });
});

describe("pantalla «Administrar grupo»", () => {
  it("la titular la ve con el nombre primero, luego descripción y emoji con color, luego el enlace a Personas, y al final archivar", async () => {
    const { owner, base } = await groupWithMember();
    const response = await request(owner, `${base}/settings`);
    expect(response.status).toBe(200);
    const html = await response.text();
    const order = ["Nombre del grupo", "Descripción", "Emoji", "Color de fondo", "Ir a Personas", "Archivar este grupo"].map(text => html.indexOf(text));
    expect(order.every(index => index > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const absent of ["Participante sin cuenta", "Invitar por email", `${base}/participants`, `${base}/invitations`]) expect(html).not.toContain(absent);
    expect(html).toContain(`href="${base}/people"`);
  });

  it("un integrante recibe 403, quien no es del grupo y quien no inició sesión no la ven", async () => {
    const { member, base } = await groupWithMember();
    const stranger = await identity(`${unique("extra")}@example.test`);
    expect((await request(member, `${base}/settings`)).status).toBe(403);
    expect((await request(stranger, `${base}/settings`)).status).toBe(404);
    const anonymous = await request(null, `${base}/settings`);
    expect(anonymous.status).toBe(303);
    expect(anonymous.headers.get("Location")).toContain("/auth/google");
    const posted = await request(member, `${base}/settings`, { method: "POST", body: form({ name: "Mío" }) });
    expect(posted.status).toBe(403);
  });

  it("guardar refleja nombre, descripción, emoji y color en el encabezado, la página del grupo y la lista", async () => {
    const { owner, member, base } = await groupWithMember();
    const saved = await request(owner, `${base}/settings`, { method: "POST", body: form({ name: "Viaje a Cartagena", description: "Gastos del viaje de diciembre", emoji: "✈️", color: "violet" }) });
    expect(saved.status).toBe(303);
    expect(saved.headers.get("Location")).toBe(`${base}/settings?aviso=grupo-guardado`);
    const page = await (await request(owner, base)).text();
    expect(page).toContain("Gastos del viaje de diciembre");
    expect(page).toContain("avatar-violet");
    expect(page).toContain("✈️");
    const asMember = await (await request(member, base)).text();
    expect(asMember).toContain("Gastos del viaje de diciembre");
    expect(asMember).toContain("Viaje a Cartagena");
    const list = await (await request(owner, "/groups")).text();
    expect(list).toContain("Viaje a Cartagena");
    expect(list).toContain("Gastos del viaje de diciembre");
    expect(list).toContain("avatar-violet");
  });

  it("explica un emoji inválido sin guardar nada, y una descripción con marcado se muestra como texto", async () => {
    const { owner, base } = await groupWithMember();
    const bad = await request(owner, `${base}/settings`, { method: "POST", body: form({ name: "Casa", emoji: "hola" }) });
    expect(bad.status).toBe(400);
    expect(await bad.text()).toContain("Elegí un único emoji completo.");
    const longText = await request(owner, `${base}/settings`, { method: "POST", body: form({ name: "Casa", description: "a".repeat(501) }) });
    expect(longText.status).toBe(400);
    expect(await longText.text()).toContain("hasta 500 caracteres");
    await request(owner, `${base}/settings`, { method: "POST", body: form({ name: "Casa", description: "<script>alert(1)</script> <b>hola</b>" }) });
    const page = await (await request(owner, base)).text();
    expect(page).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &lt;b&gt;hola&lt;/b&gt;");
    expect(page).not.toContain("<script>alert(1)");
  });

  it("la persona titular ve la ruedita y el ítem del menú; un integrante no", async () => {
    const { owner, member, base } = await groupWithMember();
    const asOwner = await (await request(owner, base)).text();
    expect(asOwner).toContain(`class="icon-button" href="${base}/settings" aria-label="Administrar grupo"`);
    expect(asOwner).toContain(`<a href="${base}/settings">Administrar grupo</a>`);
    const asMember = await (await request(member, base)).text();
    expect(asMember).not.toContain("Administrar grupo");
    expect(asMember).not.toContain(`${base}/settings`);
  });
});

describe("lista de grupos y cambio de grupo", () => {
  it("/groups lista todos los grupos con su identidad y un extracto de 150 caracteres, también con uno solo", async () => {
    const owner = await identity(`${unique("lista")}@example.test`);
    const only = await createGroupForUser(env.DB, { userId: owner.user.id, name: "Solo" });
    const single = await request(owner, "/groups");
    expect(single.status).toBe(200);
    expect(await single.text()).toContain("Solo");
    const second = await createGroupForUser(env.DB, { userId: owner.user.id, name: "Casa" });
    await updateGroup(env.DB, { groupId: second.id, userId: owner.user.id, description: "palabra ".repeat(60).trim(), emoji: "🏠", color: "forest" });
    await updateGroup(env.DB, { groupId: only.id, userId: owner.user.id, emoji: "🌻", color: "amber" });
    const html = await (await request(owner, "/groups")).text();
    for (const text of ["Solo", "Casa", "Titular", "avatar-forest", "avatar-amber", "🏠", "🌻", "Crear grupo", "Invitaciones"]) expect(html).toContain(text);
    const about = /<span class="group-about">([^<]*)<\/span>/u.exec(html)[1];
    expect(Array.from(about).length).toBeLessThanOrEqual(151);
    expect(about.endsWith("palabra…")).toBe(true);
    expect(html).not.toContain("<select");
  });

  it("en toda pantalla del grupo, el nombre con su avatar lleva a /groups y el menú ofrece «Mis grupos»", async () => {
    const { owner, base } = await groupWithMember(unique("nav"));
    for (const path of [base, `${base}/people`, `${base}/ledger/balance`, `${base}/ledger/categories`, `${base}/ledger/classify`, `${base}/ledger/import`, `${base}/ledger/new?type=expense`, `${base}/settings`]) {
      const html = await (await request(owner, path)).text();
      expect(html, path).toMatch(/<a class="group-switch" href="\/groups" aria-label="Cambiar de grupo\. Estás en [^"]+">/u);
      expect(html, path).toContain('<a href="/groups">Mis grupos</a>');
      expect(html, path).not.toContain("<select name=\"group");
    }
    expect(await (await request(owner, "/groups")).text()).not.toContain("group-switch");
  });

  it("las marcas del encabezado nunca llegan al navegador, dentro ni fuera de un grupo, con éxito o con error", async () => {
    const { owner, member, base } = await groupWithMember(unique("marcas"));
    const stranger = await identity(`${unique("extra")}@example.test`);
    const pages = [[owner, "/"], [owner, "/groups"], [owner, "/groups/new"], [owner, "/invitations"], [owner, "/perfil"], [owner, base], [owner, `${base}/people`], [member, `${base}/settings`], [stranger, base], [stranger, `${base}/settings`], [owner, "/groups/no-existe"]];
    for (const [who, path] of pages) {
      const html = await (await request(who, path)).text();
      expect(html, path).not.toContain("<!--group");
      expect(html, path).not.toContain("<!--account");
    }
    const outside = await (await request(owner, "/groups/new")).text();
    expect(outside).not.toContain("group-switch");
    expect(outside).not.toContain("Este grupo");
    const denied = await (await request(stranger, base)).text();
    expect(denied).not.toContain("group-switch");
  });
});

describe("entrar al último grupo", () => {
  it("visitar un grupo lo recuerda y /cuentas-claras vuelve a él; cambiar de grupo cambia el recuerdo", async () => {
    const owner = await identity(`${unique("ultimo")}@example.test`);
    const viaje = await createGroupForUser(env.DB, { userId: owner.user.id, name: unique("Viaje") });
    const casa = await createGroupForUser(env.DB, { userId: owner.user.id, name: unique("Casa") });
    const visitViaje = await request(owner, `/groups/${viaje.slug}`);
    expect(lastGroupCookie(visitViaje)).toBe(viaje.id);
    const cookie = `last_group=${lastGroupCookie(visitViaje)}`;
    const entry = await request(owner, "/cuentas-claras", { cookie });
    expect(entry.status).toBe(303);
    expect(entry.headers.get("Location")).toBe(`/groups/${viaje.slug}`);
    const visitCasa = await request(owner, `/groups/${casa.slug}`, { cookie });
    expect(lastGroupCookie(visitCasa)).toBe(casa.id);
    const next = await request(owner, "/cuentas-claras", { cookie: `last_group=${lastGroupCookie(visitCasa)}` });
    expect(next.headers.get("Location")).toBe(`/groups/${casa.slug}`);
  });

  it("la cookie solo guarda el identificador, sin datos personales, y es privada del navegador", async () => {
    const { owner, base } = await groupWithMember();
    const header = (await request(owner, base)).headers.get("Set-Cookie");
    const last = header.split(/,\s*(?=[A-Za-z_]+=)/u).find(part => part.startsWith("last_group="));
    expect(last).toMatch(/^last_group=group_[\w-]+; Path=\/; HttpOnly; SameSite=Lax/u);
    expect(last).toMatch(/Max-Age=31536000/u);
    expect(last).not.toContain(owner.user.email);
  });

  it("sin recuerdo: un grupo entra directo y varios muestran la lista; sin grupos, la lista vacía", async () => {
    const owner = await identity(`${unique("sin")}@example.test`);
    expect((await request(owner, "/cuentas-claras")).headers.get("Location")).toBe("/groups");
    const first = await createGroupForUser(env.DB, { userId: owner.user.id, name: unique("Unico") });
    expect((await request(owner, "/cuentas-claras")).headers.get("Location")).toBe(`/groups/${first.slug}`);
    await createGroupForUser(env.DB, { userId: owner.user.id, name: unique("Otro") });
    expect((await request(owner, "/cuentas-claras")).headers.get("Location")).toBe("/groups");
  });

  it("un recuerdo ajeno, borrado o malformado se ignora sin revelar si el grupo existe", async () => {
    const mine = await identity(`${unique("mio")}@example.test`);
    const theirs = await identity(`${unique("ajeno")}@example.test`);
    const own = await createGroupForUser(env.DB, { userId: mine.user.id, name: unique("Mio") });
    await createGroupForUser(env.DB, { userId: mine.user.id, name: unique("Mio2") });
    const foreign = await createGroupForUser(env.DB, { userId: theirs.user.id, name: unique("Ajeno") });
    const withForeign = await request(mine, "/cuentas-claras", { cookie: `last_group=${foreign.id}` });
    const withMissing = await request(mine, "/cuentas-claras", { cookie: "last_group=group_no-existe" });
    const withJunk = await request(mine, "/cuentas-claras", { cookie: "last_group=%E0%A4%A" });
    const withNone = await request(mine, "/cuentas-claras");
    for (const response of [withForeign, withMissing, withJunk]) {
      expect(response.status).toBe(withNone.status);
      expect(response.headers.get("Location")).toBe("/groups");
      expect(response.headers.get("Location")).not.toContain(foreign.slug);
    }
    expect(lastGroupCookie(withForeign)).toBeUndefined();
    const ok = await request(mine, "/cuentas-claras", { cookie: `last_group=${own.id}` });
    expect(ok.headers.get("Location")).toBe(`/groups/${own.slug}`);
  });

  it("deja de ser integrante: el recuerdo se ignora, y no se recuerda lo que no se pudo abrir", async () => {
    const { member, group, base } = await groupWithMember();
    await createGroupForUser(env.DB, { userId: member.user.id, name: unique("Propio") });
    await env.DB.prepare("DELETE FROM memberships WHERE group_id = ? AND user_id = ?").bind(group.id, member.user.id).run();
    const entry = await request(member, "/cuentas-claras", { cookie: `last_group=${group.id}` });
    expect(entry.headers.get("Location")).not.toBe(base);
    const denied = await request(member, base);
    expect(denied.status).toBe(404);
    expect(lastGroupCookie(denied)).toBeUndefined();
  });

  it("otra cuenta en el mismo navegador no abre el grupo recordado de la primera", async () => {
    const first = await identity(`${unique("uno")}@example.test`);
    const second = await identity(`${unique("dos")}@example.test`);
    const mine = await createGroupForUser(env.DB, { userId: first.user.id, name: unique("Privado") });
    const own = await createGroupForUser(env.DB, { userId: second.user.id, name: unique("Propio") });
    const cookie = `last_group=${mine.id}`;
    const entry = await request(second, "/cuentas-claras", { cookie });
    expect(entry.headers.get("Location")).toBe(`/groups/${own.slug}`);
  });

  it("no se recuerda en /groups/new, en la lista ni en errores", async () => {
    const owner = await identity(`${unique("nada")}@example.test`);
    expect(lastGroupCookie(await request(owner, "/groups/new"))).toBeUndefined();
    expect(lastGroupCookie(await request(owner, "/groups"))).toBeUndefined();
    expect(lastGroupCookie(await request(owner, "/groups/no-existe"))).toBeUndefined();
  });
});
