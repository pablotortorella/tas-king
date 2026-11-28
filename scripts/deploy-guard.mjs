// Guardia de publicación en producción: sólo se publica un commit que ya está
// en `origin/main` y con el árbol limpio (Operación, paso 3: «validar el SHA
// final de main»; paso 1: «trabajar con árbol limpio para publicar»).
//
// Staging no se restringe: el método permite validar una rama en staging antes
// de integrarla. La excepción de producción requiere OK explícito de Pablo y
// se activa con HOMESUITE_DEPLOY_ALLOW_UNMERGED=1.
//
// Módulo puro y sin imports de Node: los tests de la raíz corren en el pool de
// Workers. Lo usa scripts/wrangler-deploy.mjs.

export const OVERRIDE_ENV = "HOMESUITE_DEPLOY_ALLOW_UNMERGED";

// Entorno de wrangler al que apunta la publicación. Sin `--env`, wrangler usa
// la configuración de nivel superior, que en TasKing es producción.
export function targetEnv(args) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--env" || arg === "-e") return args[i + 1] ?? "production";
    if (arg.startsWith("--env=")) return arg.slice("--env=".length);
  }
  return "production";
}

// Decide si se puede publicar. Devuelve { ok, reason }.
export function checkDeploy({ env, dirty, inMain, override }) {
  if (env !== "production") return { ok: true, reason: null };
  if (override) return { ok: true, reason: `${OVERRIDE_ENV}=1: se publica igual (requiere OK explícito de Pablo).` };

  const problems = [];
  if (dirty) problems.push("hay cambios sin commitear");
  if (!inMain) problems.push("el commit no está en origin/main (integrar el PR antes de publicar)");
  if (problems.length === 0) return { ok: true, reason: null };
  return {
    ok: false,
    reason: `No se publica en producción: ${problems.join("; ")}. ` +
      `Excepción con OK explícito de Pablo: ${OVERRIDE_ENV}=1.`,
  };
}
