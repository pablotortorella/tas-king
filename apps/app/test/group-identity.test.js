import { describe, expect, it } from "vitest";
import { DESCRIPTION_MAX, EXCERPT_MAX, excerpt, normalizeDescription, normalizeGroupPatch, presentGroup } from "../src/group-identity.js";
import { AVATAR_COLORS } from "../src/profiles.js";
import { groupAvatar, groupSwitch } from "../src/group-ui.js";

describe("identidad del grupo: validación", () => {
  it("la descripción es texto plano de hasta 500 caracteres; vacía es ninguna", () => {
    expect(normalizeDescription("  Viaje   a Cartagena \n\n\n\ncon la familia  ")).toBe("Viaje a Cartagena\n\ncon la familia");
    expect(normalizeDescription("   ")).toBeNull();
    expect(normalizeDescription(null)).toBeNull();
    expect(normalizeDescription("a".repeat(DESCRIPTION_MAX))).toHaveLength(DESCRIPTION_MAX);
    expect(() => normalizeDescription("a".repeat(DESCRIPTION_MAX + 1))).toThrow(/hasta 500 caracteres/u);
    expect(() => normalizeDescription("hola\u0007")).toThrow(/caracteres/u);
    expect(() => normalizeDescription(7)).toThrow(/texto/u);
  });

  it("cuenta los caracteres y no las unidades del texto: 500 emojis caben", () => {
    expect(Array.from(normalizeDescription("🏠".repeat(DESCRIPTION_MAX)))).toHaveLength(DESCRIPTION_MAX);
    expect(() => normalizeDescription("🏠".repeat(DESCRIPTION_MAX + 1))).toThrow();
  });

  it("el emoji sigue las reglas del perfil: uno solo y completo; vacío lo quita", () => {
    expect(normalizeGroupPatch({ emoji: "🏠" })).toEqual({ emoji: "🏠" });
    expect(normalizeGroupPatch({ emoji: "👨‍👩‍👧" })).toEqual({ emoji: "👨‍👩‍👧" });
    expect(normalizeGroupPatch({ emoji: "  " })).toEqual({ emoji: null });
    for (const bad of ["hola", "🏠🏡", "a", "<b>"]) expect(() => normalizeGroupPatch({ emoji: bad }), bad).toThrow("Elegí un único emoji completo.");
  });

  it("el color es uno de la paleta de los perfiles; vacío vuelve al automático", () => {
    for (const token of Object.keys(AVATAR_COLORS)) expect(normalizeGroupPatch({ color: token })).toEqual({ color: token });
    expect(normalizeGroupPatch({ color: "" })).toEqual({ color: null });
    expect(() => normalizeGroupPatch({ color: "#ff0000" })).toThrow(/Color inválido/u);
  });

  it("el nombre no puede quedar vacío ni pasar de 120; lo que no se envía no cambia", () => {
    expect(normalizeGroupPatch({ name: "  Casa   nueva " })).toEqual({ name: "Casa nueva" });
    expect(() => normalizeGroupPatch({ name: "   " })).toThrow(/entre 1 y 120/u);
    expect(() => normalizeGroupPatch({ name: "x".repeat(121) })).toThrow();
    expect(normalizeGroupPatch({})).toEqual({});
  });
});

describe("identidad del grupo: presentación", () => {
  it("sin identidad elegida usa la inicial y un color estable del grupo", () => {
    const row = { id: "group_abc", slug: "casa", name: "casa de playa" };
    const first = presentGroup(row);
    expect(first).toMatchObject({ initial: "C", emoji: null, description: null, colorChosen: null });
    expect(Object.keys(AVATAR_COLORS)).toContain(first.color);
    expect(presentGroup(row).color).toBe(first.color);
  });

  it("con emoji y color elegidos los usa", () => {
    const group = presentGroup({ id: "group_abc", name: "Viaje", avatar_emoji: "✈️", avatar_color: "violet", description: "Cartagena" });
    expect(group).toMatchObject({ emoji: "✈️", color: "violet", colorChosen: "violet", description: "Cartagena" });
    expect(presentGroup({ id: "group_abc", name: "Viaje", avatar_color: "no-existe" }).colorChosen).toBe("no-existe");
    expect(Object.keys(AVATAR_COLORS)).toContain(presentGroup({ id: "group_abc", name: "Viaje", avatar_color: "no-existe" }).color);
  });

  it("el avatar escapa el HTML y no se anuncia a lectores de pantalla; el enlace de cambio nombra al grupo", () => {
    const avatar = groupAvatar({ id: "group_1", name: "<b>X</b>", avatar_color: "rose" });
    expect(avatar).toContain("avatar-rose");
    expect(avatar).toContain('aria-hidden="true"');
    expect(avatar).not.toContain("<b>");
    expect(groupAvatar({ id: "group_1", name: "Viaje", avatar_emoji: "✈️" })).toContain("✈️");
    const link = groupSwitch({ id: "group_1", slug: "viaje", name: "Viaje <i>" });
    expect(link).toContain('href="/groups"');
    expect(link).toContain("Cambiar de grupo. Estás en Viaje &lt;i&gt;");
    expect(link).not.toContain("<select");
  });
});

describe("extracto de la descripción", () => {
  it("deja intacta una descripción corta y junta los saltos de línea", () => {
    expect(excerpt("Casa de la familia\ncon todos")).toBe("Casa de la familia con todos");
    expect(excerpt(null)).toBe("");
  });

  it("corta en 150 caracteres como máximo, en un límite de palabra, y termina en «…»", () => {
    const long = "palabra ".repeat(60);
    const short = excerpt(long);
    expect(Array.from(short).length).toBeLessThanOrEqual(EXCERPT_MAX + 1);
    expect(short.endsWith("…")).toBe(true);
    expect(short.endsWith("palabra…")).toBe(true);
    expect(excerpt("x".repeat(400))).toBe(`${"x".repeat(EXCERPT_MAX)}…`);
  });

  it("exactamente 150 caracteres no se acorta", () => {
    expect(excerpt("a".repeat(EXCERPT_MAX))).toBe("a".repeat(EXCERPT_MAX));
  });
});
