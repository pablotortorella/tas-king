import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "../src/category-data.js";
import { CategoryError, categoryForEntry, createCategory, mergeCategory, readCategories, resolveCategory, seedCategoriesStatement, setCategoryArchived, updateCategory } from "../src/categories.js";
import { getLedgerAccess } from "../src/ledger.js";
import { createSpaceForUser, ensureLocalUser, inviteToSpace, resolveInvitation } from "../src/spaces.js";

async function book(name) {
  const owner = await ensureLocalUser(env.DB, `${name}@example.test`);
  const space = await createSpaceForUser(env.DB, { userId: owner.id, name });
  const ledger = await getLedgerAccess(env.DB, space.id, owner.id);
  return { owner, space, ledger };
}
const count = ledgerId => env.DB.prepare("SELECT COUNT(*) AS n FROM ledger_categories WHERE ledger_id = ?").bind(ledgerId).first().then(row => row.n);
const byName = (categories, name) => categories.find(category => category.name === name);

describe("modelo de datos de categorías", () => {
  it("la restricción única rechaza dos nombres normalizados iguales en un libro, pero no en otro", async () => {
    const one = await book("cat-unica-a");
    const two = await book("cat-unica-b");
    const insert = (ledgerId, id, name, key) => env.DB.prepare("INSERT INTO ledger_categories (ledger_id, id, name, name_key, group_name, group_key) VALUES (?, ?, ?, ?, 'G', 'g')").bind(ledgerId, id, name, key).run();
    await insert(one.ledger.id, "c1", "Mía", "mia");
    await expect(insert(one.ledger.id, "c2", "MIA", "mia")).rejects.toThrow(/UNIQUE|constraint/iu);
    await expect(insert(two.ledger.id, "c1", "Mía", "mia")).resolves.toBeDefined();
  });

  it("rechaza estados, nombres vacíos y una fusión sobre sí misma", async () => {
    const { ledger } = await book("cat-checks");
    const run = sql => env.DB.prepare(sql).bind(ledger.id).run();
    await expect(run("INSERT INTO ledger_categories (ledger_id, id, name, name_key, group_name, group_key, status) VALUES (?, 'x', 'x', 'x', 'g', 'g', 'otro')")).rejects.toThrow();
    await expect(run("INSERT INTO ledger_categories (ledger_id, id, name, name_key, group_name, group_key) VALUES (?, 'y', '', '', 'g', 'g')")).rejects.toThrow();
    await expect(run("INSERT INTO ledger_categories (ledger_id, id, name, name_key, group_name, group_key, merged_into) VALUES (?, 'z', 'z', 'z', 'g', 'g', 'z')")).rejects.toThrow();
  });

  it("la base impide los ciclos de fusión", async () => {
    const { ledger } = await book("cat-ciclo");
    const categories = await readCategories(env.DB, ledger.id);
    const [a, b, c] = categories;
    const merge = (from, into) => env.DB.prepare("UPDATE ledger_categories SET merged_into = ? WHERE ledger_id = ? AND id = ?").bind(into.id, ledger.id, from.id).run();
    await merge(a, b);
    await merge(b, c);
    await expect(merge(c, a)).rejects.toThrow(/cycle|ciclo/iu);
    await expect(merge(c, b)).rejects.toThrow(/cycle|ciclo/iu);
  });

  it("los movimientos existentes quedan sin categoría tras la migración", async () => {
    const { ledger } = await book("cat-columna");
    const columns = (await env.DB.prepare("SELECT name, \"notnull\" AS required FROM pragma_table_info('ledger_entries')").all()).results;
    expect(columns.find(column => column.name === "category_id")).toMatchObject({ required: 0 });
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM ledger_entries WHERE ledger_id = ? AND category_id IS NOT NULL").bind(ledger.id).first()).toMatchObject({ n: 0 });
  });
});

describe("siembra de la lista inicial", () => {
  it("un libro nuevo tiene todas las categorías activas, agrupadas y sin fusiones", async () => {
    const { ledger } = await book("cat-siembra-nuevo");
    expect(await count(ledger.id)).toBe(DEFAULT_CATEGORIES.length);
    const categories = await readCategories(env.DB, ledger.id);
    expect(categories.every(category => category.status === "active" && category.mergedInto === null)).toBe(true);
    expect(new Set(categories.map(category => category.group)).size).toBe(9);
    expect(byName(categories, "Restaurantes")).toMatchObject({ group: "Comidas y bebidas", groupKey: "comidas y bebidas" });
  });

  it("un libro anterior sin lista la recibe en la primera lectura y una sola vez", async () => {
    const { ledger } = await book("cat-siembra-anterior");
    await env.DB.prepare("DELETE FROM ledger_categories WHERE ledger_id = ?").bind(ledger.id).run();
    expect(await count(ledger.id)).toBe(0);
    const first = await readCategories(env.DB, ledger.id);
    expect(first).toHaveLength(DEFAULT_CATEGORIES.length);
    const second = await readCategories(env.DB, ledger.id);
    expect(second.map(category => category.id)).toEqual(first.map(category => category.id));
    expect(await count(ledger.id)).toBe(DEFAULT_CATEGORIES.length);
  });

  it("dos accesos simultáneos a un libro anterior no duplican", async () => {
    const { ledger } = await book("cat-siembra-concurrente");
    await env.DB.prepare("DELETE FROM ledger_categories WHERE ledger_id = ?").bind(ledger.id).run();
    await Promise.all([readCategories(env.DB, ledger.id), readCategories(env.DB, ledger.id), seedCategoriesStatement(env.DB, ledger.id).run()]);
    expect(await count(ledger.id)).toBe(DEFAULT_CATEGORIES.length);
    const keys = (await env.DB.prepare("SELECT name_key FROM ledger_categories WHERE ledger_id = ?").bind(ledger.id).all()).results.map(row => row.name_key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("sembrar de nuevo no pisa lo que el titular ya cambió", async () => {
    const { ledger, owner } = await book("cat-siembra-respeta");
    const categories = await readCategories(env.DB, ledger.id);
    await updateCategory(env.DB, { ledger, userId: owner.id, categoryId: byName(categories, "Alimentos").id, name: "Supermercado" });
    await seedCategoriesStatement(env.DB, ledger.id).run();
    const after = await readCategories(env.DB, ledger.id);
    expect(byName(after, "Supermercado")).toBeDefined();
    expect(after.length).toBe(DEFAULT_CATEGORIES.length + 1);
  });

  it("la lista y las categorías creadas en un libro no aparecen en otro", async () => {
    const one = await book("cat-aislamiento-a");
    const two = await book("cat-aislamiento-b");
    await createCategory(env.DB, { ledgerId: one.ledger.id, userId: one.owner.id, name: "Solo del libro A" });
    const a = await readCategories(env.DB, one.ledger.id);
    const b = await readCategories(env.DB, two.ledger.id);
    expect(byName(a, "Solo del libro A")).toBeDefined();
    expect(byName(b, "Solo del libro A")).toBeUndefined();
    expect(b).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(new Set(a.map(category => category.id)).size + new Set(b.map(category => category.id)).size).toBe(a.length + b.length);
    expect(a.filter(category => b.some(other => other.id === category.id))).toEqual([]);
  });
});

describe("normalización al crear y renombrar", () => {
  it("las variantes de un nombre existente no crean una categoría nueva", async () => {
    const { ledger, owner } = await book("cat-variantes");
    for (const variant of ["alimentos ", "Álimentos", "ALIMENTOS", "  alimentos"]) {
      const result = await createCategory(env.DB, { ledgerId: ledger.id, userId: owner.id, name: variant });
      expect(result.created).toBe(false);
      expect(result.category.name).toBe("Alimentos");
    }
    expect(await count(ledger.id)).toBe(DEFAULT_CATEGORIES.length);
  });

  it("conserva el nombre tal como se escribió la primera vez y compara por la forma normalizada", async () => {
    const { ledger, owner } = await book("cat-original");
    const created = await createCategory(env.DB, { ledgerId: ledger.id, userId: owner.id, name: "Café  y  Panadería" });
    expect(created).toMatchObject({ created: true, category: { name: "Café  y  Panadería", nameKey: "cafe y panaderia" } });
    expect((await createCategory(env.DB, { ledgerId: ledger.id, userId: owner.id, name: "cafe y panaderia" })).created).toBe(false);
  });

  it("renombrar a un nombre que ya pertenece a otra se rechaza e indica que existe", async () => {
    const { ledger, owner } = await book("cat-renombrar-choque");
    const categories = await readCategories(env.DB, ledger.id);
    await expect(updateCategory(env.DB, { ledger, userId: owner.id, categoryId: byName(categories, "Alimentos").id, name: "restaurantes" })).rejects.toThrow(/Ya existe.*Restaurantes/u);
  });

  it("renombrar una categoría a su propio nombre con otras mayúsculas está permitido", async () => {
    const { ledger, owner } = await book("cat-renombrar-propio");
    const categories = await readCategories(env.DB, ledger.id);
    await updateCategory(env.DB, { ledger, userId: owner.id, categoryId: byName(categories, "Alimentos").id, name: "ALIMENTOS" });
    expect(byName(await readCategories(env.DB, ledger.id), "ALIMENTOS")).toBeDefined();
  });

  it.each(["", "   ", "!!!", "x".repeat(61)])("rechaza el nombre inválido %j", async name => {
    const { ledger, owner } = await book(`cat-invalido-${name.length}`);
    await expect(createCategory(env.DB, { ledgerId: ledger.id, userId: owner.id, name })).rejects.toThrow(CategoryError);
  });

  it("una categoría nueva sin grupo cae en «Mis categorías» y reutiliza un grupo existente aunque cambien las mayúsculas", async () => {
    const { ledger, owner } = await book("cat-grupo");
    const sin = await createCategory(env.DB, { ledgerId: ledger.id, userId: owner.id, name: "Algo propio" });
    expect(sin.category.group).toBe("Mis categorías");
    const con = await createCategory(env.DB, { ledgerId: ledger.id, userId: owner.id, name: "Otra cosa", group: "CASA" });
    expect(con.category.group).toBe("Casa");
  });

  it("rechaza un ícono desconocido", async () => {
    const { ledger, owner } = await book("cat-icono");
    await expect(createCategory(env.DB, { ledgerId: ledger.id, userId: owner.id, name: "Con ícono raro", icon: "<script>" })).rejects.toThrow(/Ícono/u);
  });
});

describe("gestión por la persona titular", () => {
  async function team(name) {
    const base = await book(name);
    const member = await ensureLocalUser(env.DB, `${name}-integrante@example.test`);
    const invitation = await inviteToSpace(env.DB, { spaceId: base.space.id, inviterUserId: base.owner.id, email: member.email });
    await resolveInvitation(env.DB, { invitationId: invitation.id, userId: member.id, email: member.email, accepted: true });
    const memberLedger = await getLedgerAccess(env.DB, base.space.id, member.id);
    return { ...base, member, memberLedger };
  }

  it("un integrante recibe un rechazo al renombrar, archivar o fusionar y la categoría no cambia", async () => {
    const { ledger, memberLedger, member } = await team("cat-permisos");
    const categories = await readCategories(env.DB, ledger.id);
    const food = byName(categories, "Alimentos");
    const rejection = promise => expect(promise).rejects.toMatchObject({ status: 403 });
    await rejection(updateCategory(env.DB, { ledger: memberLedger, userId: member.id, categoryId: food.id, name: "Hackeada" }));
    await rejection(setCategoryArchived(env.DB, { ledger: memberLedger, userId: member.id, categoryId: food.id, archived: true }));
    await rejection(mergeCategory(env.DB, { ledger: memberLedger, userId: member.id, categoryId: food.id, intoId: byName(categories, "Licor").id }));
    expect(byName(await readCategories(env.DB, ledger.id), "Alimentos")).toMatchObject({ status: "active", mergedInto: null });
  });

  it("renombrar cambia una sola fila y conserva el identificador", async () => {
    const { ledger, owner } = await team("cat-renombrar");
    const food = byName(await readCategories(env.DB, ledger.id), "Alimentos");
    await updateCategory(env.DB, { ledger, userId: owner.id, categoryId: food.id, name: "Supermercado", group: "Casa", icon: "cart" });
    const after = (await readCategories(env.DB, ledger.id)).find(category => category.id === food.id);
    expect(after).toMatchObject({ name: "Supermercado", group: "Casa", groupKey: "casa", icon: "cart", nameKey: "supermercado" });
  });

  it("archivar quita la categoría de las ofertas y restaurar la devuelve", async () => {
    const { ledger, owner } = await team("cat-archivar");
    const food = byName(await readCategories(env.DB, ledger.id), "Alimentos");
    await setCategoryArchived(env.DB, { ledger, userId: owner.id, categoryId: food.id, archived: true });
    expect((await readCategories(env.DB, ledger.id)).find(category => category.id === food.id).status).toBe("archived");
    await expect(categoryForEntry(env.DB, { ledgerId: ledger.id, userId: owner.id, categoryId: food.id })).rejects.toThrow(/archivada/u);
    await setCategoryArchived(env.DB, { ledger, userId: owner.id, categoryId: food.id, archived: false });
    await expect(categoryForEntry(env.DB, { ledgerId: ledger.id, userId: owner.id, categoryId: food.id })).resolves.toMatchObject({ id: food.id });
  });

  it("fusionar archiva la origen con un alias a la destino y no toca otras categorías", async () => {
    const { ledger, owner } = await team("cat-fusionar");
    const categories = await readCategories(env.DB, ledger.id);
    const other = byName(categories, "Utilidades - Otro");
    const subs = byName(categories, "Suscripciones");
    await mergeCategory(env.DB, { ledger, userId: owner.id, categoryId: other.id, intoId: subs.id });
    const after = await readCategories(env.DB, ledger.id);
    expect(after.find(category => category.id === other.id)).toMatchObject({ status: "archived", mergedInto: subs.id });
    expect(resolveCategory(after, other.id).id).toBe(subs.id);
    expect(after.filter(category => category.status === "active")).toHaveLength(DEFAULT_CATEGORIES.length - 1);
  });

  it("rechaza fusiones sobre sí misma, hacia un destino inexistente, archivado o que cree un ciclo", async () => {
    const { ledger, owner } = await team("cat-fusion-rechazos");
    const categories = await readCategories(env.DB, ledger.id);
    const [a, b, c] = ["Licor", "Taxi", "Hotel"].map(name => byName(categories, name));
    const merge = (from, into) => mergeCategory(env.DB, { ledger, userId: owner.id, categoryId: from.id, intoId: into?.id ?? "no-existe" });
    await expect(merge(a, a)).rejects.toThrow(/consigo misma/u);
    await expect(merge(a, null)).rejects.toMatchObject({ status: 404 });
    await merge(a, b);
    await expect(merge(a, c)).rejects.toThrow(/ya fue fusionada/u);
    await expect(merge(b, a)).rejects.toThrow(/ciclo/u);
    await setCategoryArchived(env.DB, { ledger, userId: owner.id, categoryId: c.id, archived: true });
    await expect(merge(b, c)).rejects.toThrow(/archivada/u);
  });

  it("fusionar una categoría que ya recibió otras mantiene la cadena resoluble en uno y dos pasos", async () => {
    const { ledger, owner } = await team("cat-fusion-cadena");
    const categories = await readCategories(env.DB, ledger.id);
    const [a, b, c] = ["Licor", "Taxi", "Hotel"].map(name => byName(categories, name));
    await mergeCategory(env.DB, { ledger, userId: owner.id, categoryId: a.id, intoId: b.id });
    await mergeCategory(env.DB, { ledger, userId: owner.id, categoryId: b.id, intoId: c.id });
    const after = await readCategories(env.DB, ledger.id);
    expect(resolveCategory(after, a.id).id).toBe(c.id);
    expect(resolveCategory(after, b.id).id).toBe(c.id);
    expect(resolveCategory(after, c.id).id).toBe(c.id);
  });

  it("gestionar deja eventos en la línea de tiempo del libro y sube su revisión", async () => {
    const { ledger, owner } = await team("cat-eventos");
    const before = await env.DB.prepare("SELECT revision FROM expense_ledgers WHERE id = ?").bind(ledger.id).first();
    const food = byName(await readCategories(env.DB, ledger.id), "Alimentos");
    await updateCategory(env.DB, { ledger, userId: owner.id, categoryId: food.id, name: "Mercado" });
    const after = await env.DB.prepare("SELECT revision FROM expense_ledgers WHERE id = ?").bind(ledger.id).first();
    expect(after.revision).toBe(before.revision + 1);
    const events = (await env.DB.prepare("SELECT action, entity_type FROM ledger_events WHERE ledger_id = ? AND entity_type = 'category'").bind(ledger.id).all()).results;
    expect(events).toEqual([{ action: "category_updated", entity_type: "category" }]);
  });
});

describe("resolveCategory (puro)", () => {
  const rows = [
    { id: "a", mergedInto: "b" }, { id: "b", mergedInto: "c" }, { id: "c", mergedInto: null },
    { id: "x", mergedInto: "y" }, { id: "y", mergedInto: "x" }, { id: "huerfana", mergedInto: "borrada" },
  ];
  it("sigue la cadena de uno y dos pasos", () => {
    expect(resolveCategory(rows, "b").id).toBe("c");
    expect(resolveCategory(rows, "a").id).toBe("c");
    expect(resolveCategory(rows, "c").id).toBe("c");
  });
  it("devuelve null si no existe, corta un ciclo y tolera un destino borrado", () => {
    expect(resolveCategory(rows, "nada")).toBeNull();
    expect(resolveCategory(rows, "x")).toBeTruthy();
    expect(resolveCategory(rows, "huerfana").id).toBe("huerfana");
  });
});
