import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index.js";

const owner    = "import-owner@test.local";
const member   = "import-member@test.local";
const outsider = "import-outsider@test.local";
const headers  = email => ({ "X-Dev-User": email });
const jsonHeaders = email => ({ ...headers(email), "Content-Type": "application/json" });

async function request(path, { email, method = "GET", body } = {}) {
  return app.request(`http://localhost${path}`, {
    method,
    headers: body === undefined ? headers(email) : jsonHeaders(email),
    body: body === undefined ? undefined : JSON.stringify(body),
  }, env);
}

async function me(email) {
  const res = await request("/api/me", { email });
  expect(res.status).toBe(200);
  return res.json();
}

describe("Import de tarjetas (JSON)", () => {
  let boardId;
  let columns;

  beforeAll(async () => {
    boardId = (await me(owner)).boards[0].id;
    await me(outsider);
    // agregar member al tablero
    await request(`/api/boards/${boardId}/members`, {
      email: owner, method: "POST", body: { email: member },
    });
    const colsRes = await request(`/api/boards/${boardId}/columns`, { email: owner });
    columns = await colsRes.json();
  });

  it("rechaza requests sin acceso al tablero", async () => {
    const res = await request(`/api/boards/${boardId}/import`, {
      email: outsider, method: "POST", body: { cards: [] },
    });
    expect(res.status).toBe(403);
  });

  it("rechaza payload sin cards[]", async () => {
    const res = await request(`/api/boards/${boardId}/import`, {
      email: owner, method: "POST", body: { titulo: "mal" },
    });
    expect(res.status).toBe(400);
  });

  it("importa tarjetas básicas y las devuelve en el estado del tablero", async () => {
    const col = columns[0].id;
    const res = await request(`/api/boards/${boardId}/import`, {
      email: owner, method: "POST",
      body: { cards: [
        { title: "Tarjeta importada A", column: col, details: "Detalle A" },
        { title: "Tarjeta importada B", column: col },
      ]},
    });
    expect(res.status).toBe(200);
    const state = await res.json();
    const titles = state.cards.map(c => c.title);
    expect(titles).toContain("Tarjeta importada A");
    expect(titles).toContain("Tarjeta importada B");
    const cardA = state.cards.find(c => c.title === "Tarjeta importada A");
    expect(cardA.details).toBe("Detalle A");
  });

  it("importa el responsable si es miembro del tablero", async () => {
    const col = columns[0].id;
    const res = await request(`/api/boards/${boardId}/import`, {
      email: owner, method: "POST",
      body: { cards: [
        { title: "Con responsable miembro", column: col, assignee: member },
        { title: "Con responsable externo", column: col, assignee: "no-member@ext.com" },
      ]},
    });
    expect(res.status).toBe(200);
    const state = await res.json();
    const conMiembro = state.cards.find(c => c.title === "Con responsable miembro");
    const sinMiembro = state.cards.find(c => c.title === "Con responsable externo");
    expect(conMiembro.assignee).toBe(member);
    expect(sinMiembro.assignee).toBeNull();
  });

  it("importa etiquetas: reutiliza las existentes y crea las nuevas", async () => {
    // crear una etiqueta existente
    const labelRes = await request(`/api/boards/${boardId}/labels`, {
      email: owner, method: "POST", body: { name: "Urgente", color: "#F44336" },
    });
    const existingLabel = await labelRes.json();

    const col = columns[0].id;
    const res = await request(`/api/boards/${boardId}/import`, {
      email: owner, method: "POST",
      body: { cards: [
        {
          title: "Tarjeta con etiquetas", column: col,
          labels: [
            { name: "Urgente", color: "#F44336" },   // existente
            { name: "Nueva etiqueta", color: "#2196F3" }, // nueva
          ],
        },
      ]},
    });
    expect(res.status).toBe(200);
    const state = await res.json();
    const card = state.cards.find(c => c.title === "Tarjeta con etiquetas");
    expect(card).toBeDefined();
    const labelNames = (card.labels || []).map(l => l.name);
    expect(labelNames).toContain("Urgente");
    expect(labelNames).toContain("Nueva etiqueta");
    // la etiqueta existente tiene el mismo id
    const urgente = card.labels.find(l => l.name === "Urgente");
    expect(urgente.id).toBe(existingLabel.id);
  });

  it("importa checklists con sus ítems", async () => {
    const col = columns[0].id;
    const res = await request(`/api/boards/${boardId}/import`, {
      email: owner, method: "POST",
      body: { cards: [
        {
          title: "Tarjeta con checklist", column: col,
          checklists: [
            {
              name: "Lista de prueba", position: 0,
              items: [
                { text: "Paso 1", checked: false, position: 0 },
                { text: "Paso 2", checked: true,  position: 1 },
              ],
            },
          ],
        },
      ]},
    });
    expect(res.status).toBe(200);
    const state = await res.json();
    const card = state.cards.find(c => c.title === "Tarjeta con checklist");
    expect(card).toBeDefined();
    expect(card.checklists).toHaveLength(1);
    expect(card.checklists[0].name).toBe("Lista de prueba");
    expect(card.checklists[0].items).toHaveLength(2);
    expect(card.checklists[0].items.find(i => i.text === "Paso 2").checked).toBe(true);
  });

  it("importa comentarios junto con las tarjetas", async () => {
    const col = columns[0].id;
    const res = await request(`/api/boards/${boardId}/import`, {
      email: owner, method: "POST",
      body: { cards: [
        {
          title: "Tarjeta con comentario", column: col,
          comments: [{ text: "Primer comentario importado", author_email: owner }],
        },
      ]},
    });
    expect(res.status).toBe(200);
    const state = await res.json();
    const card = state.cards.find(c => c.title === "Tarjeta con comentario");
    expect(card).toBeDefined();
    expect((card.comments || []).length).toBeGreaterThanOrEqual(1);
  });

  it("no importa adjuntos (los archivos no están disponibles)", async () => {
    const col = columns[0].id;
    const res = await request(`/api/boards/${boardId}/import`, {
      email: owner, method: "POST",
      body: { cards: [
        {
          title: "Tarjeta con adjunto ignorado", column: col,
          attachments: [{ id: "att_fake", name: "foto.png", url: "https://example.com/foto.png" }],
        },
      ]},
    });
    expect(res.status).toBe(200); // no falla, simplemente ignora adjuntos
    const state = await res.json();
    const card = state.cards.find(c => c.title === "Tarjeta con adjunto ignorado");
    expect(card).toBeDefined();
    expect((card.attachments || []).length).toBe(0);
  });
});
