#!/usr/bin/env node
// Envoltorio de `wrangler deploy` que guarda el SHA de git en el mensaje de
// versión de Cloudflare. Así se puede calcular qué hay en main sin publicar con
// `git log <SHA publicado>..origin/main`.
//
// Uso: node scripts/wrangler-deploy.mjs <mismos argumentos que wrangler deploy>
//
// En producción frena si el commit no está en origin/main o el árbol tiene
// cambios sin commitear (scripts/deploy-guard.mjs); staging no se restringe.
// No publica por su cuenta: delega en `npx wrangler deploy`.
import { execFileSync, spawnSync } from "node:child_process";
import { deployMessage } from "./deploy-message.mjs";
import { targetEnv, checkDeploy, OVERRIDE_ENV } from "./deploy-guard.mjs";

const args = process.argv.slice(2);

if (args.some(a => a === "--message" || a.startsWith("--message="))) {
  console.error("wrangler-deploy: el mensaje de versión lo pone este script; no pasar --message.");
  process.exit(1);
}

const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();

// ¿HEAD ya está en origin/main? Trae main antes de comparar.
function headInMain() {
  execFileSync("git", ["fetch", "--quiet", "origin", "main"], { stdio: "inherit" });
  const r = spawnSync("git", ["merge-base", "--is-ancestor", "HEAD", "origin/main"]);
  if (r.status === 0) return true;
  if (r.status === 1) return false;
  throw new Error(`git merge-base falló (${r.status})`);
}

let message;
let fullSha;
let dirty;
try {
  fullSha = git("rev-parse", "HEAD");
  dirty = git("status", "--porcelain", "--untracked-files=no") !== "";
  message = deployMessage({
    sha: git("rev-parse", "--short=7", "HEAD"),
    branch: git("rev-parse", "--abbrev-ref", "HEAD"),
    dirty,
  });
} catch (error) {
  console.error(`wrangler-deploy: no pude armar el mensaje de versión: ${error.message}`);
  process.exit(1);
}

const env = targetEnv(args);
let guard;
try {
  guard = checkDeploy({
    env,
    dirty,
    inMain: env === "production" ? headInMain() : true,
    override: process.env[OVERRIDE_ENV] === "1",
  });
} catch (error) {
  console.error(`wrangler-deploy: no pude comprobar origin/main: ${error.message}`);
  process.exit(1);
}
if (guard.reason) console.error(`wrangler-deploy: ${guard.reason}`);
if (!guard.ok) process.exit(1);

console.log(`Mensaje de versión: ${message}`);
console.log(`SHA completo (copiar a STATUS): ${fullSha}`);

const result = spawnSync("npx", ["wrangler", "deploy", ...args, "--message", message], { stdio: "inherit" });
if (result.error) {
  console.error(`wrangler-deploy: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
