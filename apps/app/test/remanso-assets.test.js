import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../public");

// El motor es EXACTAMENTE el del paquete de traspaso (2026-10-26). Los sonidos de gong
// propios viven en remanso-gongs.js, que sólo reemplaza gong() en una subclase.
// Actualizar el motor es una decisión explícita: cambiar archivo, huella y
// docs/productos/REMANSO.md en el mismo commit.
const ENGINE_SHA256 = "f00c37b50d166523377348c2be3410a6f4141cf0d7eff070ec774bc513047042";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) =>
    entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
  return nested.flat();
}

describe("archivos estáticos de la app", () => {
  it("el motor de Remanso es idéntico al del paquete recibido", async () => {
    const engine = await readFile(path.join(publicDir, "remanso/remanso-engine.js"));
    expect(sha256(engine)).toBe(ENGINE_SHA256);
  });

  it("public/ no contiene HTML ni source maps (un .html capturaría su ruta sin cabeceras de seguridad)", async () => {
    const offenders = (await files(publicDir)).filter((file) => /\.(html?|map)$/iu.test(file));
    expect(offenders.map((file) => path.relative(publicDir, file))).toEqual([]);
  });

  it("_headers pide nosniff para los recursos de Remanso", async () => {
    const headers = await readFile(path.join(publicDir, "_headers"), "utf8");
    expect(headers).toMatch(/^\/remanso\/\*\s*\n\s+X-Content-Type-Options: nosniff/mu);
  });
});
