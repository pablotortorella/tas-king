import { describe, expect, it } from "vitest";
import { accountMenuItems, fillAccount } from "../src/account-ui.js";
import { ACCOUNT_MARKER, ACCOUNT_MENU_MARKER } from "../src/ui-parts.js";

const PERFIL = { displayName: "Pablo", avatar: { type: "initial", initial: "P", color: "green" } };
const CAMPO = '<input type="hidden" name="_csrf" value="token-de-prueba">';

describe("menú de cuenta", () => {
  it("el formulario de «Cerrar sesión» lleva el campo del token CSRF, que la ruta exige", () => {
    const menu = accountMenuItems(CAMPO);
    expect(menu).toContain(`<form action="/auth/logout" method="post">${CAMPO}<button type="submit">Cerrar sesión</button></form>`);
  });

  it("no ofrece un formulario sin token: sin campo, no hay «Cerrar sesión»", () => {
    expect(accountMenuItems("")).not.toContain("/auth/logout");
    expect(accountMenuItems(undefined)).not.toContain("/auth/logout");
  });

  it("rellena las marcas con el token y las quita sin sesión", () => {
    const html = `<header>${ACCOUNT_MARKER}${ACCOUNT_MENU_MARKER}</header>`;
    expect(fillAccount(html, PERFIL, CAMPO)).toContain(CAMPO);
    expect(fillAccount(html, null, CAMPO)).toBe("<header></header>");
  });
});
