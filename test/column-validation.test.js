import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index.js";

const owner = "colval-owner@test.local";
const other = "colval-other@test.local";
const headers = email => ({ "X-Dev-User": email });
const jsonHeaders = email => ({ ...headers(email), "Content-Type": "application/json" });

async function request(path, { email = owner, method = "GET", body } = {}) {
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

describe("Las tarjetas solo pueden vivir en columnas que existen en su tablero", () => {
  let boardId;
  let foreignColumn; // columna válida, pero de otro tablero
  let cardId;

  const cardsOf = async () => (await (await request(`/api/boards/${boardId}/cards`)).json()).cards;

  beforeAll(async () => {
    boardId = (await me(owner)).boards[0].id;
    const otherBoard = (await me(other)).boards[0].id;
    const created = await request(`/api/boards/${otherBoard}/columns`, {
      email: other, method: "POST", body: { name: "Solo del otro" },
    });
    foreignColumn = (await created.json()).id;

    const card = await request(`/api/boards/${boardId}/cards`, {
      method: "POST", body: { title: "Existente", column: "pendiente" },
    });
    cardId = (await card.json()).id;
  });

  describe("crear", () => {
    it("rechaza una columna inexistente y no deja la tarjeta guardada", async () => {
      const res = await request(`/api/boards/${boardId}/cards`, {
        method: "POST", body: { title: "Huérfana", column: "no_existe" },
      });
      expect(res.status).toBe(400);
      expect((await cardsOf()).some(c => c.title === "Huérfana")).toBe(false);
    });

    it("rechaza una columna que pertenece a otro tablero", async () => {
      const res = await request(`/api/boards/${boardId}/cards`, {
        method: "POST", body: { title: "Ajena", column: foreignColumn },
      });
      expect(res.status).toBe(400);
    });

    it("rechaza una columna que no es texto", async () => {
      const res = await request(`/api/boards/${boardId}/cards`, {
        method: "POST", body: { title: "Rara", column: { id: "pendiente" } },
      });
      expect(res.status).toBe(400);
    });

    it("sigue aceptando una columna del tablero", async () => {
      const res = await request(`/api/boards/${boardId}/cards`, {
        method: "POST", body: { title: "Válida", column: "en_progreso" },
      });
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({ column: "en_progreso" });
    });
  });

  describe("editar", () => {
    it("rechaza mover a una columna inexistente y deja la tarjeta como estaba", async () => {
      const res = await request(`/api/cards/${cardId}`, { method: "PUT", body: { column: "no_existe" } });
      expect(res.status).toBe(400);
      expect((await cardsOf()).find(c => c.id === cardId)).toMatchObject({ column: "pendiente", title: "Existente" });
    });

    it("rechaza mover a una columna de otro tablero", async () => {
      const res = await request(`/api/cards/${cardId}`, { method: "PUT", body: { column: foreignColumn } });
      expect(res.status).toBe(400);
    });

    it("permite editar otros campos sin mandar columna", async () => {
      const res = await request(`/api/cards/${cardId}`, { method: "PUT", body: { title: "Renombrada" } });
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({ title: "Renombrada", column: "pendiente" });
    });

    it("permite mover a otra columna del tablero", async () => {
      const res = await request(`/api/cards/${cardId}`, { method: "PUT", body: { column: "por_revisar" } });
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({ column: "por_revisar" });
    });
  });

  describe("reordenar", () => {
    it("rechaza todo el lote si alguna columna no existe, sin mover nada", async () => {
      const res = await request(`/api/boards/${boardId}/reorder`, {
        method: "POST", body: [{ id: cardId, column: "no_existe", position: 1 }],
      });
      expect(res.status).toBe(400);
      expect((await cardsOf()).find(c => c.id === cardId)).toMatchObject({ column: "por_revisar" });
    });
  });
});

describe("Importar tarjetas con columnas que no existen en el tablero", () => {
  const importer = "colval-import@test.local";
  let boardId;
  let firstColumn;

  const importCards = cards => request(`/api/boards/${boardId}/import`, {
    email: importer, method: "POST", body: { cards },
  });

  beforeAll(async () => {
    boardId = (await me(importer)).boards[0].id;
    // Tablero sin la columna que el import usaba por defecto ("por_conversar").
    const del = await request(`/api/boards/${boardId}/columns/por_conversar`, { email: importer, method: "DELETE" });
    expect(del.status).toBe(200);
    const columns = await (await request(`/api/boards/${boardId}/columns`, { email: importer })).json();
    firstColumn = columns[0].id;
    expect(firstColumn).toBe("pendiente");
  });

  it("manda a la primera columna las tarjetas sin columna o con una desconocida", async () => {
    const res = await importCards([
      { title: "Sin columna" },
      { title: "Columna ajena", column: "id-de-otro-tablero" },
      { title: "Columna propia", column: "en_progreso" },
    ]);
    expect(res.status).toBe(200);
    const { cards } = await res.json();
    const byTitle = Object.fromEntries(cards.map(c => [c.title, c.column]));
    expect(byTitle).toMatchObject({
      "Sin columna": firstColumn,
      "Columna ajena": firstColumn,
      "Columna propia": "en_progreso",
    });
  });

  it("no deja ninguna tarjeta fuera de las columnas del tablero", async () => {
    const board = await (await request(`/api/boards/${boardId}/cards`, { email: importer })).json();
    const ids = new Set(board.columns.map(c => c.id));
    expect(board.cards.length).toBeGreaterThan(0);
    for (const card of board.cards) expect(ids.has(card.column)).toBe(true);
  });
});
