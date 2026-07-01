import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index.js";

const owner    = "metrics-owner@test.local";
const outsider = "metrics-outsider@test.local";
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

describe("Métricas del tablero", () => {
  let boardId;

  beforeAll(async () => {
    boardId = (await me(owner)).boards[0].id;
    await me(outsider);
  });

  it("retorna 200 con estructura correcta", async () => {
    const res = await request(`/api/boards/${boardId}/metrics`, { email: owner });
    expect(res.status).toBe(200);
    const m = await res.json();
    expect(m).toHaveProperty("completedByPeriod");
    expect(m).toHaveProperty("leadTimeDays");
    expect(m).toHaveProperty("wipByColumn");
    expect(m).toHaveProperty("burnup");
  });

  it("completedByPeriod contiene today/thisWeek/thisMonth como números", async () => {
    const res = await request(`/api/boards/${boardId}/metrics`, { email: owner });
    const { completedByPeriod } = await res.json();
    expect(typeof completedByPeriod.today).toBe("number");
    expect(typeof completedByPeriod.thisWeek).toBe("number");
    expect(typeof completedByPeriod.thisMonth).toBe("number");
  });

  it("leadTimeDays es null cuando no hay tarjetas completadas", async () => {
    const res = await request(`/api/boards/${boardId}/metrics`, { email: owner });
    const { leadTimeDays } = await res.json();
    expect(leadTimeDays).toBeNull();
  });

  it("wipByColumn tiene una entrada por columna (5 columnas por defecto)", async () => {
    const res = await request(`/api/boards/${boardId}/metrics`, { email: owner });
    const { wipByColumn } = await res.json();
    expect(wipByColumn).toHaveLength(5);
    for (const col of wipByColumn) {
      expect(typeof col.name).toBe("string");
      expect(typeof col.count).toBe("number");
    }
  });

  it("burnup es un array (puede estar vacío)", async () => {
    const res = await request(`/api/boards/${boardId}/metrics`, { email: owner });
    const { burnup } = await res.json();
    expect(Array.isArray(burnup)).toBe(true);
  });

  it("retorna 403 para no miembros", async () => {
    const res = await request(`/api/boards/${boardId}/metrics`, { email: outsider });
    expect(res.status).toBe(403);
  });

  it("leadTimeDays tiene avg/min/max/sample tras mover una tarjeta a la columna done", async () => {
    // Obtener columnas del tablero
    const colsRes = await request(`/api/boards/${boardId}/columns`, { email: owner });
    const columns = await colsRes.json();
    const doneCol = columns.find(c => c.is_done) || columns[columns.length - 1];
    const firstCol = columns[0];

    // Crear tarjeta en primera columna
    const cardRes = await request(`/api/boards/${boardId}/cards`, {
      email: owner, method: "POST",
      body: { title: "Métrica test", column: firstCol.id },
    });
    expect(cardRes.status).toBe(200);
    const card = await cardRes.json();

    // Mover a columna done
    const moveRes = await request(`/api/cards/${card.id}`, {
      email: owner, method: "PUT",
      body: { column: doneCol.id },
    });
    expect(moveRes.status).toBe(200);

    // Verificar métricas
    const metricsRes = await request(`/api/boards/${boardId}/metrics`, { email: owner });
    expect(metricsRes.status).toBe(200);
    const { leadTimeDays } = await metricsRes.json();
    expect(leadTimeDays).not.toBeNull();
    expect(typeof leadTimeDays.avg).toBe("number");
    expect(typeof leadTimeDays.min).toBe("number");
    expect(typeof leadTimeDays.max).toBe("number");
    expect(leadTimeDays.sample).toBeGreaterThanOrEqual(1);
  });
});
