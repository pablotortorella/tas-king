import { describe, it, expect } from "vitest";
import pkg from "../package.json";

// El orden de los pasos de despliegue es una decisión de arquitectura, no un
// detalle del script: ADR-016 y docs/STATUS.md exigen aplicar la migración
// ANTES de subir el Worker nuevo.
//
// El motivo es concreto: la migración 0015 agrega `boards.sync_version` y el
// Worker la consulta en cada carga de tablero y en /version. Si el Worker sube
// primero, hay una ventana en la que cada petición responde 500 con "no such
// column". La documentación lo pedía desde el 2026-09-15, pero ningún script lo
// hacía cumplir y los dos desplegaban antes de migrar.
//
// Esto se prueba acá, en el paquete, porque es donde vive la decisión. Un test
// de integración no puede cubrirlo sin desplegar de verdad.

function pasos(script) {
  return script.split("&&").map(s => s.trim());
}

function indiceDe(script, patron) {
  return pasos(script).findIndex(p => patron.test(p));
}

describe("orden de los scripts de despliegue", () => {
  for (const [nombre, migrar] of [["deploy", /db:migrate:remote/], ["deploy:staging", /db:migrate:staging/]]) {
    describe(nombre, () => {
      const script = pkg.scripts[nombre];

      it("migra antes de subir el Worker", () => {
        const iMigrar = indiceDe(script, migrar);
        const iDesplegar = indiceDe(script, /wrangler deploy/);
        expect(iMigrar, "no encuentro el paso de migración").toBeGreaterThanOrEqual(0);
        expect(iDesplegar, "no encuentro el paso de deploy").toBeGreaterThanOrEqual(0);
        expect(iMigrar, `${nombre} debe migrar antes de desplegar`).toBeLessThan(iDesplegar);
      });

      it("corre la suite completa antes que nada", () => {
        expect(indiceDe(script, /verify-ready/)).toBe(0);
      });
    });
  }

  it("producción respalda la base antes de migrarla", () => {
    const s = pkg.scripts.deploy;
    expect(indiceDe(s, /db:backup:prod/)).toBeLessThan(indiceDe(s, /db:migrate:remote/));
  });
});
