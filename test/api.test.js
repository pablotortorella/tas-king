import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src/index.js";

const owner = "owner@test.local";
const member = "member@test.local";
const outsider = "outsider@test.local";
const headers = email => ({ "X-Dev-User": email });
const jsonHeaders = email => ({ ...headers(email), "Content-Type": "application/json" });

async function request(path, { email, method = "GET", body } = {}) {
  return app.request(`http://test.local${path}`, {
    method,
    headers: body === undefined ? headers(email) : jsonHeaders(email),
    body: body === undefined ? undefined : JSON.stringify(body),
  }, env);
}

async function me(email) {
  const response = await request("/api/me", { email });
  expect(response.status).toBe(200);
  return response.json();
}

describe("API del Worker con D1 y R2 emulados", () => {
  let personalId;
  let sharedId;
  let cardId;

  beforeAll(async () => {
    personalId = (await me(owner)).boards[0].id;
    await me(member);
    await me(outsider);
  });

  it("exige identidad para la API", async () => {
    const response = await app.request("http://test.local/api/me", {}, env);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "No autenticado." });
  });

  it("crea automáticamente el tablero personal y protege su eliminación", async () => {
    const current = await me(owner);
    expect(current.email).toBe(owner);
    expect(current.boards).toContainEqual(expect.objectContaining({ id: personalId, isPersonal: true, role: "owner" }));
    const response = await request(`/api/boards/${personalId}`, { email: owner, method: "DELETE" });
    expect(response.status).toBe(400);
  });

  it("crea un tablero compartido e invita miembros", async () => {
    const created = await request("/api/boards", { email: owner, method: "POST", body: { name: "Equipo" } });
    expect(created.status).toBe(200);
    sharedId = (await created.json()).id;

    const invited = await request(`/api/boards/${sharedId}/members`, {
      email: owner, method: "POST", body: { email: member.toUpperCase() },
    });
    expect(invited.status).toBe(200);
    await expect(invited.json()).resolves.toMatchObject({ email: member, role: "member" });
    expect((await me(member)).boards).toContainEqual(expect.objectContaining({ id: sharedId, role: "member" }));
  });

  it("aplica roles e impide acceso a personas ajenas", async () => {
    const memberRename = await request(`/api/boards/${sharedId}`, {
      email: member, method: "PATCH", body: { name: "No permitido" },
    });
    expect(memberRename.status).toBe(403);

    const outsiderRead = await request(`/api/boards/${sharedId}/cards`, { email: outsider });
    expect(outsiderRead.status).toBe(403);
  });

  it("completa el ciclo de vida de tarjeta y comentarios", async () => {
    const created = await request(`/api/boards/${sharedId}/cards`, {
      email: member, method: "POST",
      body: { title: "Primera tarea", column: "pendiente", details: "Detalle" },
    });
    expect(created.status).toBe(200);
    cardId = (await created.json()).id;

    const updated = await request(`/api/cards/${cardId}`, {
      email: owner, method: "PUT", body: { title: "Tarea actualizada", column: "en_progreso" },
    });
    await expect(updated.json()).resolves.toMatchObject({ title: "Tarea actualizada", column: "en_progreso" });

    const comment = await request(`/api/cards/${cardId}/comments`, {
      email: member, method: "POST", body: { text: "  Avancé  " },
    });
    await expect(comment.json()).resolves.toMatchObject({ text: "Avancé", author: { email: member } });

    const reordered = await request(`/api/boards/${sharedId}/reorder`, {
      email: member, method: "POST", body: [{ id: cardId, column: "por_revisar", position: 1 }],
    });
    await expect(reordered.json()).resolves.toEqual({ updated: 1 });
    const board = await (await request(`/api/boards/${sharedId}/cards`, { email: owner })).json();
    expect(board.cards).toContainEqual(expect.objectContaining({ id: cardId, column: "por_revisar", position: 1 }));

    const archived = await request(`/api/cards/${cardId}/archive`, { email: owner, method: "POST" });
    await expect(archived.json()).resolves.toMatchObject({ archived: true });
    const restored = await request(`/api/cards/${cardId}/restore`, { email: owner, method: "POST" });
    await expect(restored.json()).resolves.toMatchObject({ archived: false });
  });

  it("importa agregando sin reemplazar tarjetas existentes", async () => {
    const before = await (await request(`/api/boards/${sharedId}/cards`, { email: owner })).json();
    const imported = await request(`/api/boards/${sharedId}/import`, {
      email: owner, method: "POST", body: { cards: [
        { title: "Importada", column: "por_revisar", comments: [{ text: "Desde CSV" }] },
      ] },
    });
    expect(imported.status).toBe(200);
    const after = await imported.json();
    expect(after.cards).toHaveLength(before.cards.length + 1);
    expect(after.cards).toContainEqual(expect.objectContaining({ id: cardId, title: "Tarea actualizada" }));
    expect(after.cards).toContainEqual(expect.objectContaining({ title: "Importada", column: "por_revisar" }));
  });

  it("guarda y elimina adjuntos en R2", async () => {
    const form = new FormData();
    form.append("files", new File(["contenido"], "nota.txt", { type: "text/plain" }));
    const uploaded = await app.request(`http://test.local/api/cards/${cardId}/attachments`, {
      method: "POST", headers: headers(member), body: form,
    }, env);
    expect(uploaded.status).toBe(200);
    const attachment = (await uploaded.json()).attachments[0];
    expect(attachment).toMatchObject({ originalName: "nota.txt", mime: "text/plain" });

    const download = await app.request(`http://test.local${attachment.url}`, {}, env);
    expect(download.status).toBe(200);
    await expect(download.text()).resolves.toBe("contenido");

    const removed = await request(`/api/attachments/${attachment.id}`, { email: owner, method: "DELETE" });
    expect(removed.status).toBe(200);
    expect((await app.request(`http://test.local${attachment.url}`, {}, env)).status).toBe(404);
  });

  it("restringe administración y protege el rol propio", async () => {
    await env.DB.prepare("UPDATE users SET is_admin = 1 WHERE email = ?").bind(owner).run();
    const denied = await request("/api/admin/users", { email: member });
    expect(denied.status).toBe(403);

    const added = await request("/api/admin/allowed", {
      email: owner, method: "POST", body: { email: " NEW@EXAMPLE.COM " },
    });
    expect(added.status).toBe(200);
    const list = await (await request("/api/admin/users", { email: owner })).json();
    expect(list.allowed).toContainEqual(expect.objectContaining({ email: "new@example.com" }));

    expect((await request("/api/admin/set-admin", {
      email: owner, method: "POST", body: { email: member, isAdmin: true },
    })).status).toBe(200);
    const promoted = await (await request("/api/admin/users", { email: owner })).json();
    expect(promoted.admins).toContainEqual(expect.objectContaining({ email: member }));
    expect((await request("/api/admin/set-admin", {
      email: owner, method: "POST", body: { email: member, isAdmin: false },
    })).status).toBe(200);

    expect((await request("/api/admin/allowed/new%40example.com", {
      email: owner, method: "DELETE",
    })).status).toBe(200);

    const selfChange = await request("/api/admin/set-admin", {
      email: owner, method: "POST", body: { email: owner, isAdmin: false },
    });
    expect(selfChange.status).toBe(400);
  });

  it("elimina una tarjeta y el tablero compartido", async () => {
    expect((await request(`/api/cards/${cardId}`, { email: owner, method: "DELETE" })).status).toBe(200);
    expect((await request(`/api/boards/${sharedId}`, { email: owner, method: "DELETE" })).status).toBe(200);
    expect((await request(`/api/boards/${sharedId}/cards`, { email: owner })).status).toBe(403);
  });
});
