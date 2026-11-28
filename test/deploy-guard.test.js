import { describe, it, expect } from "vitest";
import { targetEnv, checkDeploy, OVERRIDE_ENV } from "../scripts/deploy-guard.mjs";

describe("targetEnv", () => {
  it("sin --env es producción (configuración de nivel superior de TasKing)", () => {
    expect(targetEnv([])).toBe("production");
    expect(targetEnv(["--config", "apps/app/wrangler.jsonc"])).toBe("production");
  });

  it("lee --env <x>, --env=<x> y -e <x>", () => {
    expect(targetEnv(["--env", "staging", "--config", "apps/app/wrangler.jsonc"])).toBe("staging");
    expect(targetEnv(["--env=production"])).toBe("production");
    expect(targetEnv(["-e", "staging"])).toBe("staging");
  });
});

describe("checkDeploy", () => {
  const clean = { dirty: false, inMain: true, override: false };

  it("staging no se restringe, aunque sea una rama con cambios", () => {
    expect(checkDeploy({ env: "staging", dirty: true, inMain: false, override: false }).ok).toBe(true);
  });

  it("producción pasa con un commit de main y árbol limpio", () => {
    expect(checkDeploy({ env: "production", ...clean })).toEqual({ ok: true, reason: null });
  });

  it("producción frena un commit que no está en main", () => {
    const result = checkDeploy({ env: "production", ...clean, inMain: false });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no está en origin\/main/);
    expect(result.reason).toContain(OVERRIDE_ENV);
  });

  it("producción frena el árbol con cambios sin commitear", () => {
    const result = checkDeploy({ env: "production", ...clean, dirty: true });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/cambios sin commitear/);
  });

  it("la excepción explícita deja publicar y lo dice", () => {
    const result = checkDeploy({ env: "production", dirty: true, inMain: false, override: true });
    expect(result.ok).toBe(true);
    expect(result.reason).toMatch(/OK explícito/);
  });
});
