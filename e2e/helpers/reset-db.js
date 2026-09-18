import { execSync } from "child_process";
import { resolve } from "path";
import { esBaseBloqueada } from "./sqlite-busy.js";

const root = resolve(process.cwd());

const COMANDO =
  "npx wrangler d1 execute tas-king --local --persist-to .wrangler/e2e-state --file test/fixtures/seed.sql";

// El reset corre en un proceso aparte que escribe el mismo SQLite que el dev
// server tiene abierto. Bajo la carga de la suite completa esa carrera se pierde
// cada tanto y wrangler aborta con SQLITE_BUSY, dejando rojo un test que no tiene
// nada que ver con lo que estaba probando.
//
// Reintentar es el remedio correcto para un lock transitorio: no debilita ninguna
// aserción, solo espera a que el otro proceso suelte el archivo. Cualquier otro
// error se propaga tal cual — no queremos tapar un seed roto con reintentos.
const INTENTOS = 4;
const ESPERA_BASE_MS = 250;

function esperar(ms) {
  // Bloqueante a propósito: resetDb() es sincrónico y se llama desde beforeAll y
  // beforeEach sin await.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}


export function resetDb() {
  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      execSync(COMANDO, { cwd: root, stdio: "pipe" });
      return;
    } catch (e) {
      if (!esBaseBloqueada(e) || intento === INTENTOS) throw e;
      const espera = ESPERA_BASE_MS * 2 ** (intento - 1);
      console.warn(`[reset-db] base bloqueada, reintento ${intento}/${INTENTOS - 1} en ${espera}ms`);
      esperar(espera);
    }
  }
}
