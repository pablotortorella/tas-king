import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/index.js";
import { getBoard } from "../src/db/queries.js";
import { runBackup } from "../src/backup.js";

let boardId, otherBoardId, cardId, newerId, checklistId, itemId, secondItemId, commentId, email;
async function request(path, method = "GET", body, user = email) {
  return app.request(`http://localhost${path}`, {
    method,
    headers: { "X-Dev-User": user, "Content-Type": "application/json", "CF-Connecting-IP": user },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, env);
}
async function version(id = boardId) {
  const res = await request(`/api/boards/${id}/version`);
  expect(res.status).toBe(200);
  return (await res.json()).version;
}
async function card() {
  const res = await request(`/api/cards/${cardId}`);
  expect(res.status).toBe(200);
  return res.json();
}

beforeEach(async () => {
  [boardId, otherBoardId, cardId, newerId, checklistId, itemId, secondItemId, commentId] =
    Array.from({ length: 8 }, () => crypto.randomUUID());
  email = `sync-${boardId}@test.local`;
  const stmts = [boardId, otherBoardId].flatMap(id => [
    env.DB.prepare("INSERT INTO boards (id, name, owner_email, created_at) VALUES (?, 'Sync', ?, 1)").bind(id, email),
    env.DB.prepare("INSERT INTO board_members (board_id, email, role, created_at) VALUES (?, ?, 'owner', 1)").bind(id, email),
  ]);
  // La tarjeta más reciente tiene una fecha futura: tocar otra tarjeta con Date.now()
  // no basta. La revisión no debe depender del reloj ni de cuál tarjeta se borra.
  stmts.push(...[cardId, newerId].map((id, i) => env.DB.prepare(
    "INSERT INTO cards (id, board_id, title, column_id, created_at, updated_at) VALUES (?, ?, 'Tarjeta', 'pendiente', 1, ?)"
  ).bind(id, boardId, i ? 8000000000000 : 1000)));
  stmts.push(
    env.DB.prepare("INSERT INTO checklists (id, card_id, name, created_at) VALUES (?, ?, 'Lista', 1)").bind(checklistId, cardId),
    env.DB.prepare("INSERT INTO checklist_items (id, checklist_id, text, position, created_at) VALUES (?, ?, 'Primero', 0, 1)").bind(itemId, checklistId),
    env.DB.prepare("INSERT INTO checklist_items (id, checklist_id, text, position, created_at) VALUES (?, ?, 'Segundo', 1, 1)").bind(secondItemId, checklistId),
    env.DB.prepare("INSERT INTO comments (id, card_id, text, created_at) VALUES (?, ?, 'Inicial', 1)").bind(commentId, cardId),
  );
  await env.DB.batch(stmts);
});
afterEach(() => vi.restoreAllMocks());

const changes = [
  ["agregar comentario", () => [`/api/cards/${cardId}/comments`, "POST", { text: "Remoto" }], c => expect(c.comments.map(x => x.text)).toContain("Remoto")],
  ["borrar comentario", () => [`/api/comments/${commentId}`, "DELETE"], c => expect(c.comments).toEqual([])],
  ["crear checklist", () => [`/api/cards/${cardId}/checklists`, "POST", { name: "Nueva lista" }], c => expect(c.checklists).toHaveLength(2)],
  ["renombrar checklist", () => [`/api/checklists/${checklistId}`, "PUT", { name: "Renombrada" }], c => expect(c.checklists[0].name).toBe("Renombrada")],
  ["borrar checklist con ítems", () => [`/api/checklists/${checklistId}`, "DELETE"], c => expect(c.checklists).toEqual([])],
  ["agregar ítem", () => [`/api/checklists/${checklistId}/items`, "POST", { text: "Tercero" }], c => expect(c.checklists[0].items).toHaveLength(3)],
  ["editar ítem", () => [`/api/checklist-items/${itemId}`, "PUT", { text: "Editado" }], c => expect(c.checklists[0].items[0].text).toBe("Editado")],
  ["marcar ítem", () => [`/api/checklist-items/${itemId}`, "PUT", { checked: true }], c => expect(c.checklists[0].items[0].checked).toBe(true)],
  ["reordenar ítems", () => [`/api/checklists/${checklistId}/reorder`, "POST", [{ id: secondItemId }, { id: itemId }]], c => expect(c.checklists[0].items.map(x => x.id)).toEqual([secondItemId, itemId])],
  ["borrar ítem", () => [`/api/checklist-items/${itemId}`, "DELETE"], c => expect(c.checklists[0].items.map(x => x.id)).toEqual([secondItemId])],
];

describe("sincronización de recursos relacionados", () => {
  it.each(changes)("%s cambia la revisión y conserva el contenido", async (_name, operation, verify) => {
    const before = await version();
    const otherBefore = await version(otherBoardId);
    const res = await request(...operation());
    expect(res.status).toBe(200);
    const after = await version();
    expect(after).not.toBe(before);
    expect((await getBoard(env.DB, boardId)).version).toBe(after);
    verify(await card());
    expect(await version(otherBoardId)).toBe(otherBefore);
  });

  it.each(["antigua", "reciente", "última"])("detecta el borrado de la tarjeta %s", async which => {
    if (which === "última") await request(`/api/cards/${newerId}`, "DELETE");
    const before = await version();
    const deletedId = which === "reciente" ? newerId : cardId;
    expect((await request(`/api/cards/${deletedId}`, "DELETE")).status).toBe(200);
    const after = await version();
    expect(after).not.toBe(before);
    const board = await getBoard(env.DB, boardId);
    expect(board.version).toBe(after);
    expect(board.cards.map(c => c.id)).not.toContain(deletedId);
    if (which === "última") expect(board.cards).toEqual([]);
  });

  it("detecta dos escrituras con el mismo reloj, sin perder cambios", async () => {
    vi.spyOn(Date, "now").mockReturnValue(8000000000000);
    const before = await version();
    await request(`/api/cards/${cardId}`, "PUT", { title: "Uno" });
    const first = await version();
    await request(`/api/cards/${cardId}`, "PUT", { title: "Dos" });
    const second = await version();
    expect(first).not.toBe(before);
    expect(second).not.toBe(first);
    expect((await card()).title).toBe("Dos");
  });

  it("lecturas y operaciones rechazadas no cambian la revisión", async () => {
    const before = await version();
    expect((await request(`/api/cards/${cardId}/comments`, "POST", { text: " " })).status).toBe(400);
    expect((await request(`/api/checklist-items/${itemId}`, "PUT", { text: " " })).status).toBe(400);
    const outsider = `outsider-${boardId}@test.local`;
    expect((await request(`/api/checklist-items/${itemId}`, "PUT", { checked: true }, outsider)).status).toBe(403);
    expect((await request(`/api/boards/${boardId}/version`, "GET", undefined, outsider)).status).toBe(403);
    await getBoard(env.DB, boardId);
    expect(await version()).toBe(before);
  });

  it("una transacción fallida revierte contenido y revisión juntos", async () => {
    const before = await version();
    await expect(env.DB.batch([
      env.DB.prepare("UPDATE comments SET text = 'No persistir' WHERE id = ?").bind(commentId),
      env.DB.prepare("INSERT INTO checklist_items (id, checklist_id, text, created_at) VALUES (?, 'inexistente', 'Falla FK', 1)").bind(crypto.randomUUID()),
    ])).rejects.toThrow();
    expect(await version()).toBe(before);
    expect((await card()).comments[0].text).toBe("Inicial");
  });

  it("el backup conserva los triggers y permite restaurar la sincronización", async () => {
    const result = await runBackup({ DB: env.DB, BUCKET: env.BUCKET });
    expect(result.errors).toEqual([]);
    const file = await env.BUCKET.get(`backups/${result.timestamp}.sql`);
    const dump = await file.text();
    const triggers = dump.match(/CREATE TRIGGER[\s\S]*?END;/g) || [];
    expect(triggers).toHaveLength(12);
    expect(dump.indexOf(triggers[0])).toBeGreaterThan(dump.lastIndexOf("INSERT INTO"));
    const statement = triggers.find(sql => sql.includes("comments_sync_insert"));
    await env.DB.prepare("DROP TRIGGER comments_sync_insert").run();
    await env.DB.prepare(statement).run();
    const before = await version();
    await request(`/api/cards/${cardId}/comments`, "POST", { text: "Después de restaurar" });
    expect(await version()).not.toBe(before);
  });
});
