import { describe, it, expect } from "vitest";
import { esBaseBloqueada } from "../e2e/helpers/sqlite-busy.js";

// El reset de la base E2E corre en un proceso aparte que escribe el mismo SQLite
// que el dev server tiene abierto. Bajo la carga de la suite completa esa carrera
// se pierde cada tanto y wrangler aborta con SQLITE_BUSY, dejando rojo un test
// que no tiene nada que ver con lo que estaba probando.
//
// Reintentar es correcto para un lock transitorio. Reintentar ante CUALQUIER
// error no: taparía un seed roto detrás de cuatro intentos y un mensaje confuso.
describe("esBaseBloqueada", () => {
  it("reconoce SQLITE_BUSY en stderr", () => {
    expect(esBaseBloqueada({ stderr: "✘ [ERROR] NOSENTRY database is locked: SQLITE_BUSY" })).toBe(true);
  });

  it("reconoce el mensaje en stdout o en message", () => {
    expect(esBaseBloqueada({ stdout: "database is locked" })).toBe(true);
    expect(esBaseBloqueada({ message: "SQLITE_BUSY" })).toBe(true);
  });

  it("no le importa el uso de mayúsculas", () => {
    expect(esBaseBloqueada({ stderr: "Database Is Locked" })).toBe(true);
  });

  it("NO reintenta ante un seed con SQL inválido", () => {
    expect(esBaseBloqueada({ stderr: 'near "INSRT": syntax error' })).toBe(false);
  });

  it("NO reintenta ante una tabla que no existe", () => {
    expect(esBaseBloqueada({ stderr: "no such table: cards" })).toBe(false);
  });

  it("tolera un error sin campos, o ninguno", () => {
    expect(esBaseBloqueada({})).toBe(false);
    expect(esBaseBloqueada(null)).toBe(false);
    expect(esBaseBloqueada(undefined)).toBe(false);
  });
});
