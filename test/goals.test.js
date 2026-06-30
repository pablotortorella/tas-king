import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index.js";

const owner = "goals-owner@test.local";
const outsider = "goals-outsider@test.local";
const headers = email => ({ "X-Dev-User": email });
const jsonHeaders = email => ({ ...headers(email), "Content-Type": "application/json" });

async function request(path, { email, method = "GET", body } = {}) {
  return app.request(`http://localhost${path}`, {
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

describe("Objetivos: CRUD, vínculo con tarjetas y progreso", () => {
  let boardId;
  let goalId;
  let cardA;
  let cardB;

  beforeAll(async () => {
    boardId = (await me(owner)).boards[0].id;
    await me(outsider);
  });

  it("crea un objetivo en el tablero", async () => {
    const res = await request(`/api/boards/${boardId}/goals`, {
      email: owner, method: "POST", body: { title: "  Lanzar v1  ", description: "Primer release" },
    });
    expect(res.status).toBe(200);
    const goal = await res.json();
    expect(goal).toMatchObject({ title: "Lanzar v1", description: "Primer release", total: 0, done: 0, pct: 0 });
    goalId = goal.id;
  });

  it("rechaza objetivos sin título", async () => {
    const res = await request(`/api/boards/${boardId}/goals`, {
      email: owner, method: "POST", body: { title: "   " },
    });
    expect(res.status).toBe(400);
  });

  it("niega acceso a quien no es miembro del tablero", async () => {
    const res = await request(`/api/boards/${boardId}/goals`, { email: outsider });
    expect(res.status).toBe(403);
  });

  it("vincula tarjetas y calcula el progreso por columna", async () => {
    const a = await request(`/api/boards/${boardId}/cards`, {
      email: owner, method: "POST", body: { title: "Tarea A", column: "pendiente" },
    });
    cardA = (await a.json()).id;
    const b = await request(`/api/boards/${boardId}/cards`, {
      email: owner, method: "POST", body: { title: "Tarea B", column: "terminado" },
    });
    cardB = (await b.json()).id;

    expect((await request(`/api/cards/${cardA}/goals/${goalId}`, { email: owner, method: "POST" })).status).toBe(200);
    expect((await request(`/api/cards/${cardB}/goals/${goalId}`, { email: owner, method: "POST" })).status).toBe(200);

    // 2 vinculadas, 1 en "terminado" → 50%
    const goals = await (await request(`/api/boards/${boardId}/goals`, { email: owner })).json();
    const goal = goals.find(g => g.id === goalId);
    expect(goal).toMatchObject({ total: 2, done: 1, pct: 50 });
  });

  it("expone los objetivos vinculados en cada tarjeta", async () => {
    const board = await (await request(`/api/boards/${boardId}/cards`, { email: owner })).json();
    const card = board.cards.find(c => c.id === cardA);
    expect(card.goals).toContainEqual(expect.objectContaining({ id: goalId, title: "Lanzar v1" }));
  });

  it("rechaza vincular dos veces la misma tarjeta", async () => {
    const res = await request(`/api/cards/${cardA}/goals/${goalId}`, { email: owner, method: "POST" });
    expect(res.status).toBe(400);
  });

  it("al completar todas las tarjetas el progreso llega a 100%", async () => {
    await request(`/api/cards/${cardA}`, {
      email: owner, method: "PUT", body: { column: "terminado" },
    });
    const goals = await (await request(`/api/boards/${boardId}/goals`, { email: owner })).json();
    expect(goals.find(g => g.id === goalId)).toMatchObject({ total: 2, done: 2, pct: 100 });
  });

  it("las tarjetas archivadas no cuentan para el progreso", async () => {
    await request(`/api/cards/${cardB}/archive`, { email: owner, method: "POST" });
    const goals = await (await request(`/api/boards/${boardId}/goals`, { email: owner })).json();
    expect(goals.find(g => g.id === goalId)).toMatchObject({ total: 1, done: 1, pct: 100 });
    await request(`/api/cards/${cardB}/restore`, { email: owner, method: "POST" });
  });

  it("desvincula una tarjeta del objetivo", async () => {
    expect((await request(`/api/cards/${cardA}/goals/${goalId}`, { email: owner, method: "DELETE" })).status).toBe(200);
    const goals = await (await request(`/api/boards/${boardId}/goals`, { email: owner })).json();
    expect(goals.find(g => g.id === goalId)).toMatchObject({ total: 1 });
  });

  it("edita el título del objetivo", async () => {
    const res = await request(`/api/boards/${boardId}/goals/${goalId}`, {
      email: owner, method: "PUT", body: { title: "Lanzar v1.0" },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ id: goalId, title: "Lanzar v1.0" });
  });

  it("elimina el objetivo y limpia los vínculos", async () => {
    expect((await request(`/api/boards/${boardId}/goals/${goalId}`, { email: owner, method: "DELETE" })).status).toBe(200);
    const goals = await (await request(`/api/boards/${boardId}/goals`, { email: owner })).json();
    expect(goals.find(g => g.id === goalId)).toBeUndefined();
    // la tarjeta ya no debe reportar el objetivo
    const board = await (await request(`/api/boards/${boardId}/cards`, { email: owner })).json();
    expect(board.cards.find(c => c.id === cardB).goals).toHaveLength(0);
  });
});
