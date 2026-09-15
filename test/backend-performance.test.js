import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/index.js";
import { ensureUser } from "../src/db/helpers.js";
import { cardJSONById, getBoard } from "../src/db/queries.js";
import { resolveEmail, signSession } from "../src/middleware/auth.js";
import { DEFAULT_COLUMNS } from "../src/db/columns.js";

// Cuenta llamadas al binding, ejecutando las sentencias sobre D1 real de tests.
// Un batch es una llamada aunque ejecute varias sentencias SQL.
function observeD1(db) {
  const calls = [];
  function wrap(statement, sql) {
    return {
      statement, sql,
      bind: (...values) => wrap(statement.bind(...values), sql),
      ...Object.fromEntries(["run", "first", "all"].map(method => [method, (...args) => {
        calls.push({ method, sql });
        return statement[method](...args);
      }])),
    };
  }
  return {
    calls,
    prepare: sql => wrap(db.prepare(sql), sql),
    batch: statements => {
      calls.push({ method: "batch", sql: statements.map(s => s.sql).join("; ") });
      return db.batch(statements.map(s => s.statement));
    },
  };
}

const freshEmail = () => `perf-${crypto.randomUUID()}@test.local`;
const personalBoard = email => env.DB.prepare("SELECT * FROM boards WHERE owner_email = ? AND is_personal = 1").bind(email).first();
const userRow = email => env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
afterEach(() => vi.restoreAllMocks());

it("lee datos y revisión del tablero en una sola llamada transaccional", async () => {
  const email = freshEmail();
  await ensureUser(env.DB, email);
  const board = await personalBoard(email);
  const db = observeD1(env.DB);
  const result = await getBoard(db, board.id);
  expect(db.calls).toHaveLength(1);
  expect(db.calls[0].method).toBe("batch");
  expect(result).toMatchObject({ version: 0, cards: [] });
  expect(result.columns).toHaveLength(DEFAULT_COLUMNS.length);
});

describe("presupuesto D1 de preparación de usuario", () => {
  it.each([false, true])("usuario existente: una llamada D1 (admin configurado: %s)", async admin => {
    const email = freshEmail();
    await ensureUser(env.DB, email);
    const db = observeD1(env.DB);
    await ensureUser(db, email, admin ? ` otro@test.local, ${email.toUpperCase()} ` : "");
    expect(db.calls).toHaveLength(1);
    expect((await userRow(email)).is_admin).toBe(admin ? 1 : 0);
  });

  it("crea usuario admin, tablero, membresía y columnas en la primera preparación", async () => {
    const email = freshEmail();
    await ensureUser(env.DB, email, email);
    expect((await userRow(email)).is_admin).toBe(1);
    const board = await personalBoard(email);
    expect(board.name).toBe("Mi tablero");
    expect(await env.DB.prepare("SELECT role FROM board_members WHERE board_id = ? AND email = ?").bind(board.id, email).first()).toEqual({ role: "owner" });
    const columns = await env.DB.prepare("SELECT id, name, position, is_done FROM columns WHERE board_id = ? ORDER BY position").bind(board.id).all();
    expect(columns.results).toEqual(DEFAULT_COLUMNS);
  });

  it("conserva el perfil y un admin existente cuando el Secret no lo incluye", async () => {
    const email = freshEmail();
    await ensureUser(env.DB, email);
    await env.DB.prepare("UPDATE users SET name = 'Nombre editado', is_admin = 1 WHERE email = ?").bind(email).run();
    const before = await userRow(email);
    const board = await personalBoard(email);
    await ensureUser(env.DB, email, "otro@test.local");
    await ensureUser(env.DB, email);
    expect(await userRow(email)).toEqual(before);
    const boards = await env.DB.prepare("SELECT id FROM boards WHERE owner_email = ? AND is_personal = 1").bind(email).all();
    expect(boards.results).toEqual([{ id: board.id }]);
  });

  it("prepara una cuenta ya existente sin tablero personal, sin promoverla por coincidencia parcial", async () => {
    const email = freshEmail();
    await env.DB.prepare("INSERT INTO users (id, email, name, created_at) VALUES (?, ?, 'Invitado', 1)").bind(crypto.randomUUID(), email).run();
    await ensureUser(env.DB, email, `prefix-${email}`);
    expect(await userRow(email)).toMatchObject({ name: "Invitado", is_admin: 0 });
    expect(await personalBoard(email)).not.toBeNull();
  });
});

async function cookieFor(email, exp = Date.now() + 60_000) {
  return `session=${await signSession({ email, exp }, env.SESSION_SECRET)}`;
}
async function allow(email) {
  await env.DB.prepare("INSERT INTO allowed_emails (email, added_by, added_at) VALUES (?, 'test', datetime('now'))").bind(email).run();
}

describe("autenticación: una verificación por petición, sin cachear permisos", () => {
  it.each([false, true])("el polling completo usa seis llamadas D1 con sesión real (admin: %s)", async admin => {
    const email = freshEmail();
    await ensureUser(env.DB, email);
    await allow(email);
    const board = await personalBoard(email);
    const db = observeD1(env.DB);
    const res = await app.request(`https://tasking.test/api/boards/${board.id}/version`, {
      headers: { Cookie: await cookieFor(email) },
    }, { ...env, DB: db, ADMIN_EMAILS: admin ? email : "" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ version: 0 });
    expect(db.calls).toHaveLength(6);
    expect((await userRow(email)).is_admin).toBe(admin ? 1 : 0);
  });

  it("verifica una vez la cookie y sigue comprobando la revocación en la siguiente petición", async () => {
    const email = freshEmail();
    await allow(email);
    const cookie = await cookieFor(email);
    const verify = vi.spyOn(crypto.subtle, "verify");
    const res = await app.request("https://tasking.test/api/me", { headers: { Cookie: cookie } }, env);
    expect(res.status).toBe(200);
    expect(verify).toHaveBeenCalledTimes(1);
    await env.DB.prepare("DELETE FROM allowed_emails WHERE email = ?").bind(email).run();
    verify.mockClear();
    const revoked = await app.request("http://localhost/api/me", { headers: { Cookie: cookie, "X-Dev-User": freshEmail() } }, env);
    expect(revoked.status).toBe(403);
    expect(await revoked.json()).toMatchObject({ code: "access_revoked" });
    expect(revoked.headers.get("set-cookie")).toContain("session=;");
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("una cookie expirada no habilita el bypass fuera de localhost", async () => {
    const cookie = await cookieFor(freshEmail(), Date.now() - 1000);
    const verify = vi.spyOn(crypto.subtle, "verify");
    const res = await app.request("https://tasking.test/api/me", { headers: { Cookie: cookie, "X-Dev-User": freshEmail() } }, { ...env, DEV_USER_EMAIL: freshEmail() });
    expect(res.status).toBe(401);
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("rechaza una firma inválida aunque el email siga permitido", async () => {
    const email = freshEmail();
    await allow(email);
    const token = await signSession({ email, exp: Date.now() + 60_000 }, "otra-clave");
    const verify = vi.spyOn(crypto.subtle, "verify");
    const res = await app.request("https://tasking.test/api/me", { headers: { Cookie: `session=${token}` } }, env);
    expect(res.status).toBe(401);
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("sin cookie conserva el bypass local y el resolver independiente", async () => {
    const email = freshEmail();
    const verify = vi.spyOn(crypto.subtle, "verify");
    expect((await app.request("http://localhost/api/me", { headers: { "X-Dev-User": email } }, env)).status).toBe(200);
    expect(verify).not.toHaveBeenCalled();
    const cookie = await cookieFor(email);
    const c = { req: { url: "https://tasking.test/", raw: new Request("https://tasking.test/", { headers: { Cookie: cookie } }), header: name => name === "Cookie" ? cookie : undefined }, env };
    expect(await resolveEmail(c)).toBe(email);
  });
});

async function fixtureCards() {
  const email = freshEmail();
  await ensureUser(env.DB, email);
  const board = await personalBoard(email);
  const ids = [crypto.randomUUID(), crypto.randomUUID()];
  await env.DB.batch(ids.map(id => env.DB.prepare("INSERT INTO cards (id, board_id, title, column_id, created_at, updated_at) VALUES (?, ?, 'Performance', 'pendiente', 1, 1)").bind(id, board.id)));
  return { email, ids };
}
async function addChecklist(cardId, position, items = []) {
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO checklists (id, card_id, name, position, created_at) VALUES (?, ?, ?, ?, 1)").bind(id, cardId, `Lista ${position}`, position).run();
  for (const item of items) {
    await env.DB.prepare("INSERT INTO checklist_items (id, checklist_id, text, checked, position, created_at) VALUES (?, ?, ?, ?, ?, 1)").bind(crypto.randomUUID(), id, item.text, item.checked ? 1 : 0, item.position).run();
  }
  return id;
}

describe("ítems de checklist: costo constante y aislamiento", () => {
  it("conserva orden, estados y listas vacías, sin traer ítems de otra tarjeta", async () => {
    const { ids: [id, otherId] } = await fixtureCards();
    const empty = await addChecklist(id, 2);
    const first = await addChecklist(id, 0, [{ text: "Segundo", position: 2, checked: false }, { text: "Primero", position: 1, checked: true }]);
    const middle = await addChecklist(id, 1, [{ text: "Propio", position: 0 }]);
    await addChecklist(otherId, 0, [{ text: "Ajeno", position: 0 }]);
    const db = observeD1(env.DB);
    const card = await cardJSONById(db, id);
    expect(card.checklists.map(cl => cl.id)).toEqual([first, middle, empty]);
    expect(card.checklists.map(cl => cl.items.map(i => [i.text, i.checked, i.checklistId]))).toEqual([
      [["Primero", true, first], ["Segundo", false, first]], [["Propio", false, middle]], [],
    ]);
    expect(db.calls.filter(call => call.sql.includes("checklist_items"))).toHaveLength(1);
  });

  it("agregar checklists no agrega llamadas D1 a la lectura de tarjeta", async () => {
    const { ids: [id] } = await fixtureCards();
    await addChecklist(id, 0, [{ text: "Uno", position: 0 }]);
    const db = observeD1(env.DB);
    await cardJSONById(db, id);
    const callsWithOne = db.calls.length;
    for (let n = 1; n <= 4; n++) await addChecklist(id, n, [{ text: `Ítem ${n}`, position: 0 }]);
    db.calls.length = 0;
    const card = await cardJSONById(db, id);
    expect(card.checklists).toHaveLength(5);
    expect(db.calls).toHaveLength(callsWithOne);
    expect(db.calls.length).toBeLessThanOrEqual(7);
  });

  it("una tarjeta sin checklists no consulta ítems; una inexistente devuelve null", async () => {
    const { ids: [id] } = await fixtureCards();
    const db = observeD1(env.DB);
    expect((await cardJSONById(db, id)).checklists).toEqual([]);
    expect(db.calls.filter(call => call.sql.includes("checklist_items"))).toHaveLength(0);
    expect(db.calls.length).toBeLessThanOrEqual(6);
    expect(await cardJSONById(db, crypto.randomUUID())).toBeNull();
  });

  it("la ruta de tarjeta sigue rechazando a quien no pertenece al tablero", async () => {
    const { ids: [id] } = await fixtureCards();
    await addChecklist(id, 0, [{ text: "Privado", position: 0 }]);
    const res = await app.request(`http://localhost/api/cards/${id}`, { headers: { "X-Dev-User": freshEmail() } }, env);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Sin acceso a esta tarjeta." });
  });
});
