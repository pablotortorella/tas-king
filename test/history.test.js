import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/index.js";

const owner = "history-owner@test.local";
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
  const res = await request("/api/me", { email });
  expect(res.status).toBe(200);
  return res.json();
}

describe("Historial: nombres de columna guardados en el evento", () => {
  let boardId, cardId, columns;

  beforeAll(async () => {
    boardId = (await me(owner)).boards[0].id;
    const colsRes = await request(`/api/boards/${boardId}/columns`, { email: owner });
    columns = await colsRes.json();
  });

  it("card_created guarda columnName en el audit_log", async () => {
    const col = columns[0];
    const res = await request(`/api/boards/${boardId}/cards`, {
      email: owner, method: "POST",
      body: { title: "Test historial", column: col.id },
    });
    expect(res.status).toBe(200);
    const card = await res.json();
    cardId = card.id;

    const hRes = await request(`/api/cards/${cardId}/history`, { email: owner });
    expect(hRes.status).toBe(200);
    const { history } = await hRes.json();
    const created = history.find(e => e.action === "card_created");
    expect(created).toBeDefined();
    expect(created.details.columnName).toBe(col.name);
  });

  it("card_moved guarda fromName y toName en el audit_log", async () => {
    const fromCol = columns[0];
    const toCol = columns[1];

    const res = await request(`/api/cards/${cardId}`, {
      email: owner, method: "PUT",
      body: { column: toCol.id },
    });
    expect(res.status).toBe(200);

    const hRes = await request(`/api/cards/${cardId}/history`, { email: owner });
    const { history } = await hRes.json();
    const moved = history.find(e => e.action === "card_moved");
    expect(moved).toBeDefined();
    expect(moved.details.column.fromName).toBe(fromCol.name);
    expect(moved.details.column.toName).toBe(toCol.name);
  });

  it("column_renamed queda registrado en la actividad del tablero", async () => {
    const col = columns[0];
    const newName = "Columna Renombrada Test";

    const pRes = await request(`/api/boards/${boardId}/columns/${col.id}`, {
      email: owner, method: "PATCH",
      body: { name: newName },
    });
    expect(pRes.status).toBe(200);

    const actRes = await request(`/api/boards/${boardId}/activity`, { email: owner });
    expect(actRes.status).toBe(200);
    const { activity } = await actRes.json();
    const renamed = activity.find(e => e.action === "column_renamed");
    expect(renamed).toBeDefined();
    expect(renamed.details.from).toBe(col.name);
    expect(renamed.details.to).toBe(newName);
    expect(renamed.cardId).toBeNull();
  });

  it("column_created queda registrado en la actividad del tablero", async () => {
    const res = await request(`/api/boards/${boardId}/columns`, {
      email: owner, method: "POST",
      body: { name: "Columna Nueva Test" },
    });
    expect(res.status).toBe(200);

    const { activity } = await (await request(`/api/boards/${boardId}/activity`, { email: owner })).json();
    const created = activity.find(e => e.action === "column_created");
    expect(created).toBeDefined();
    expect(created.details.name).toBe("Columna Nueva Test");
    expect(created.cardId).toBeNull();

    // cleanup: borrar la columna recién creada
    const newColId = (await res.json()).id;
    await request(`/api/boards/${boardId}/columns/${newColId}`, { email: owner, method: "DELETE" });
  });

  it("column_deleted queda registrado en la actividad del tablero", async () => {
    // Crear columna para luego borrarla
    const createRes = await request(`/api/boards/${boardId}/columns`, {
      email: owner, method: "POST",
      body: { name: "Columna A Eliminar" },
    });
    expect(createRes.status).toBe(200);
    const { id: newColId } = await createRes.json();

    const delRes = await request(`/api/boards/${boardId}/columns/${newColId}`, {
      email: owner, method: "DELETE",
    });
    expect(delRes.status).toBe(200);

    const { activity } = await (await request(`/api/boards/${boardId}/activity`, { email: owner })).json();
    const deleted = activity.find(e => e.action === "column_deleted");
    expect(deleted).toBeDefined();
    expect(deleted.details.name).toBe("Columna A Eliminar");
    expect(deleted.cardId).toBeNull();
  });

  it("column_moved queda registrado al usar direction", async () => {
    const col = columns[1]; // columna que no es la primera (puede ir a la izquierda)

    const res = await request(`/api/boards/${boardId}/columns/${col.id}`, {
      email: owner, method: "PATCH",
      body: { direction: "left" },
    });
    expect(res.status).toBe(200);

    const { activity } = await (await request(`/api/boards/${boardId}/activity`, { email: owner })).json();
    const moved = activity.find(e => e.action === "column_moved");
    expect(moved).toBeDefined();
    expect(moved.details.direction).toBe("left");
    expect(moved.details.name).toBe(col.name);
    expect(moved.cardId).toBeNull();

    // restaurar posición original
    await request(`/api/boards/${boardId}/columns/${col.id}`, {
      email: owner, method: "PATCH", body: { direction: "right" },
    });
  });
});
