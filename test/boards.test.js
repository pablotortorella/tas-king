import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index.js";

const owner    = "boards-owner@test.local";
const outsider = "boards-outsider@test.local";
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

describe("PATCH /api/boards/:boardId", () => {
  let boardId;

  beforeAll(async () => {
    boardId = (await me(owner)).boards[0].id;
    await me(outsider);
  });

  it("GET /api/me expone dueSoonDays con default 3 para un tablero nuevo", async () => {
    const board = (await me(owner)).boards[0];
    expect(board.dueSoonDays).toBe(3);
  });

  it("actualiza dueSoonDays y lo persiste", async () => {
    const res = await request(`/api/boards/${boardId}`, {
      email: owner, method: "PATCH", body: { dueSoonDays: 7 },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dueSoonDays).toBe(7);

    const board = (await me(owner)).boards[0];
    expect(board.dueSoonDays).toBe(7);
  });

  it("rechaza valores fuera de rango (0-90)", async () => {
    const res = await request(`/api/boards/${boardId}`, {
      email: owner, method: "PATCH", body: { dueSoonDays: 91 },
    });
    expect(res.status).toBe(400);
  });

  it("rechaza valores no numéricos", async () => {
    const res = await request(`/api/boards/${boardId}`, {
      email: owner, method: "PATCH", body: { dueSoonDays: "pronto" },
    });
    expect(res.status).toBe(400);
  });

  it("rechaza el cambio si quien pide no es dueño", async () => {
    await request(`/api/boards/${boardId}/members`, {
      email: owner, method: "POST", body: { email: outsider },
    });
    const res = await request(`/api/boards/${boardId}`, {
      email: outsider, method: "PATCH", body: { dueSoonDays: 5 },
    });
    expect(res.status).toBe(403);
  });

  it("rechaza body vacío", async () => {
    const res = await request(`/api/boards/${boardId}`, {
      email: owner, method: "PATCH", body: {},
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/boards/:boardId — theme", () => {
  const themeOwner = "boards-theme-owner@test.local";
  const themeOutsider = "boards-theme-outsider@test.local";
  let boardId;

  beforeAll(async () => {
    boardId = (await me(themeOwner)).boards[0].id;
    await me(themeOutsider);
  });

  it("GET /api/me expone theme null y themePromptSeen false para un tablero nuevo", async () => {
    const board = (await me(themeOwner)).boards[0];
    expect(board.theme).toBeNull();
    expect(board.themePromptSeen).toBe(false);
  });

  it("permite marcar themePromptSeen sin elegir paleta (caso 'omitir')", async () => {
    const res = await request(`/api/boards/${boardId}`, {
      email: themeOwner, method: "PATCH", body: { themePromptSeen: true },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.themePromptSeen).toBe(true);
    expect(body.theme).toBeNull();
  });

  it("rechaza paletas fuera del allow-list", async () => {
    const res = await request(`/api/boards/${boardId}`, {
      email: themeOwner, method: "PATCH", body: { theme: "trello_blue" },
    });
    expect(res.status).toBe(400);
  });

  it("actualiza theme, lo persiste y mantiene themePromptSeen", async () => {
    const res = await request(`/api/boards/${boardId}`, {
      email: themeOwner, method: "PATCH", body: { theme: "sunset_pop" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.theme).toBe("sunset_pop");
    expect(body.themePromptSeen).toBe(true);

    const board = (await me(themeOwner)).boards[0];
    expect(board.theme).toBe("sunset_pop");
    expect(board.themePromptSeen).toBe(true);
  });

  it("rechaza el cambio de theme si quien pide no es dueño", async () => {
    await request(`/api/boards/${boardId}/members`, {
      email: themeOwner, method: "POST", body: { email: themeOutsider },
    });
    const res = await request(`/api/boards/${boardId}`, {
      email: themeOutsider, method: "PATCH", body: { theme: "jungle_pop" },
    });
    expect(res.status).toBe(403);
  });
});
