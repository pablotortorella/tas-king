#!/usr/bin/env node
// Envoltorio de `wrangler deploy` que guarda el SHA de git en el mensaje de
// versión de Cloudflare. Así se puede calcular qué hay en main sin publicar con
// `git log <SHA publicado>..origin/main`.
//
// Uso: node scripts/wrangler-deploy.mjs <mismos argumentos que wrangler deploy>
//
// No valida que la rama sea main ni que el árbol esté limpio: sólo lo marca en
// el mensaje. Tampoco publica por su cuenta: delega en `npx wrangler deploy`.
import { execFileSync, spawnSync } from "node:child_process";
import { deployMessage } from "./deploy-message.mjs";

const args = process.argv.slice(2);

if (args.some(a => a === "--message" || a.startsWith("--message="))) {
  console.error("wrangler-deploy: el mensaje de versión lo pone este script; no pasar --message.");
  process.exit(1);
}

const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();

let message;
let fullSha;
try {
  fullSha = git("rev-parse", "HEAD");
  message = deployMessage({
    sha: git("rev-parse", "--short=7", "HEAD"),
    branch: git("rev-parse", "--abbrev-ref", "HEAD"),
    dirty: git("status", "--porcelain", "--untracked-files=no") !== "",
  });
} catch (error) {
  console.error(`wrangler-deploy: no pude armar el mensaje de versión: ${error.message}`);
  process.exit(1);
}

console.log(`Mensaje de versión: ${message}`);
console.log(`SHA completo (copiar a STATUS): ${fullSha}`);

const result = spawnSync("npx", ["wrangler", "deploy", ...args, "--message", message], { stdio: "inherit" });
if (result.error) {
  console.error(`wrangler-deploy: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
