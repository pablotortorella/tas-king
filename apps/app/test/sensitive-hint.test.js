import { describe, expect, it } from "vitest";
import { renderGroupSettings } from "../src/group-ui.js";
import { renderEntryForm } from "../src/ledger-ui.js";
import { renderPeople } from "../src/people-ui.js";
import { SENSITIVE_HINT } from "../src/ui-parts.js";

// Advertencia junto a cada campo de texto libre (design.md, D11): HomeSuite no pide datos sensibles (Ley 1581, art. 5).
const TEXT = "No escribas datos sensibles (salud, religión, afiliaciones).";
const participants = [{ id: "p1", displayName: "Ana", linkedUserId: "u", active: 1 }, { id: "p2", displayName: "Beto", linkedUserId: null, active: 1 }];
const data = { ledger: { default_currency: "COP", role: "owner", archived_at: null }, participants, categories: [], entries: [], balances: [] };
const csrf = '<input type="hidden" name="_csrf" value="t">';
const count = (html) => html.split(TEXT).length - 1;

// La advertencia debe quedar a continuación del campo, antes del siguiente control del formulario.
function hintAfterField(html, fieldName) {
  const field = html.indexOf(`name="${fieldName}"`);
  expect(field, `campo ${fieldName}`).toBeGreaterThan(-1);
  const hint = html.indexOf(TEXT, field);
  expect(hint, `advertencia de ${fieldName}`).toBeGreaterThan(field);
  const nextControl = html.slice(field + 1).search(/<(?:input|textarea|select)\b(?![^>]*name="_csrf")/u);
  expect(nextControl === -1 || field + 1 + nextControl > hint, `la advertencia de ${fieldName} va antes del siguiente control`).toBe(true);
}

describe("advertencia de datos sensibles", () => {
  it("el texto de la advertencia es el de la política", () => {
    expect(SENSITIVE_HINT).toContain(TEXT);
  });

  it("el formulario del movimiento la muestra junto a la descripción y la nota", () => {
    const html = renderEntryForm(data, { groupId: "casa", csrf, userId: "u" });
    hintAfterField(html, "description");
    hintAfterField(html, "note");
    expect(count(html)).toBe(2);
  });

  it("Personas la muestra al agregar un participante y al renombrar", () => {
    const members = [{ user_id: "u", display_name: "Ana", role: "owner" }];
    const html = renderPeople({ data, group: { slug: "casa", name: "Casa" }, members, invitations: [], csrf, userId: "u", owner: true });
    hintAfterField(html, "name");
    expect(count(html)).toBeGreaterThanOrEqual(2);
    expect(html.match(/name="name"/gu).length).toBe(count(html));
  });

  it("Administrar grupo la muestra junto al nombre y a la descripción del grupo", () => {
    const html = renderGroupSettings({ group: { id: "group_1", slug: "casa", name: "Casa" }, data, csrf });
    hintAfterField(html, "name");
    hintAfterField(html, "description");
    expect(count(html)).toBe(2);
  });
});
