import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { COMPROBACIONES_SEMANALES, TITULOS } from "../../../scripts/alertas-operativas.mjs";

// Change alertas-minimas-homesuite, D6: los workflows de vigilancia usan solo GITHUB_TOKEN y permisos mínimos por trabajo.
const root = path.resolve(import.meta.dirname, "../../..");
const leer = (relativa) => fs.readFileSync(path.join(root, relativa), "utf8");

const WORKFLOWS_DE_VIGILANCIA = [
  ".github/workflows/homesuite-production-health.yml",
  ".github/workflows/homesuite-backup-freshness.yml",
  ".github/workflows/homesuite-weekly-ops-review.yml",
];
const PERMISOS_PERMITIDOS = { issues: ["read", "write"], actions: ["read"], contents: ["read"] };

/** Devuelve las violaciones de un trabajo (o del nivel superior) frente a las reglas de mínimo privilegio. */
export function violacionesDePermisos(permisos, donde) {
  if (permisos === undefined) return [`${donde}: no declara permisos`];
  if (typeof permisos !== "object" || permisos === null) return [`${donde}: permisos «${String(permisos)}» más amplios que los declarados`];
  return Object.entries(permisos).flatMap(([nombre, nivel]) => (
    PERMISOS_PERMITIDOS[nombre]?.includes(nivel) ? [] : [`${donde}: permiso ${nombre}: ${nivel} fuera de lo declarado`]
  ));
}

/** Revisa un workflow de vigilancia (o solo los trabajos indicados de otro). */
export function revisarWorkflow(texto, { trabajos } = {}) {
  const workflow = parse(texto);
  const violaciones = [];
  if (!trabajos) violaciones.push(...violacionesDePermisos(workflow.permissions, "nivel superior"));
  if (workflow.on && typeof workflow.on === "object" && "pull_request_target" in workflow.on) violaciones.push("usa pull_request_target");
  for (const [nombre, trabajo] of Object.entries(workflow.jobs)) {
    if (trabajos && !trabajos.includes(nombre)) continue;
    violaciones.push(...violacionesDePermisos(trabajo.permissions, `trabajo ${nombre}`));
    const textoDelTrabajo = JSON.stringify(trabajo);
    for (const [, secreto] of textoDelTrabajo.matchAll(/secrets\.([A-Za-z0-9_]+)/gu)) {
      if (secreto !== "GITHUB_TOKEN") violaciones.push(`trabajo ${nombre}: usa secrets.${secreto}`);
    }
    if (/secrets\[|toJSON\(secrets\)|secrets:\s*inherit/u.test(textoDelTrabajo)) violaciones.push(`trabajo ${nombre}: accede a secretos de forma indirecta`);
    for (const paso of trabajo.steps ?? []) {
      if (paso.run && paso.run.includes("${{")) violaciones.push(`trabajo ${nombre}: expresión dentro de run (usar env)`);
    }
  }
  return violaciones;
}

describe("workflows de vigilancia: mínimo privilegio", () => {
  for (const archivo of WORKFLOWS_DE_VIGILANCIA) {
    it(`${path.basename(archivo)} usa solo GITHUB_TOKEN y permisos declarados por trabajo`, () => {
      expect(revisarWorkflow(leer(archivo))).toEqual([]);
    });
  }

  it("el aviso del respaldo diario cumple lo mismo sin que el respaldo gane permisos", () => {
    const texto = leer(".github/workflows/homesuite-production-backup.yml");
    expect(revisarWorkflow(texto, { trabajos: ["notify-failure"] })).toEqual([]);
    const workflow = parse(texto);
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflow.jobs.backup.permissions).toBeUndefined();
    expect(workflow.jobs["notify-failure"]).toMatchObject({ needs: "backup", if: "failure()" });
    // El trabajo que lleva el token de Cloudflare no puede abrir issues, y el de aviso no ve ese token.
    expect(JSON.stringify(workflow.jobs.backup)).toContain("HOMESUITE_PROD_BACKUP_API_TOKEN");
    expect(JSON.stringify(workflow.jobs["notify-failure"])).not.toMatch(/CLOUDFLARE|HOMESUITE_PROD_BACKUP/u);
  });

  it("el aviso del respaldo no se dispara si el respaldo no corre ni si termina bien", () => {
    // `failure()` es falso con el trabajo omitido (variable de habilitación) o exitoso; ese caso lo cubre el control de antigüedad.
    const workflow = parse(leer(".github/workflows/homesuite-production-backup.yml"));
    expect(workflow.jobs.backup.if).toBe("vars.HOMESUITE_PROD_BACKUPS_ENABLED == 'true'");
    expect(workflow.jobs["notify-failure"].if).toBe("failure()");
  });

  it("las frecuencias son las decididas", () => {
    const cron = (archivo) => parse(leer(archivo)).on.schedule[0].cron;
    expect(cron(".github/workflows/homesuite-production-health.yml")).toBe("*/30 * * * *");
    expect(cron(".github/workflows/homesuite-backup-freshness.yml")).toBe("0 20 * * *");
    expect(cron(".github/workflows/homesuite-weekly-ops-review.yml")).toBe("0 12 * * 1");
  });

  it("cada workflow de vigilancia puede ensayarse a mano", () => {
    for (const archivo of WORKFLOWS_DE_VIGILANCIA) expect(parse(leer(archivo)).on).toHaveProperty("workflow_dispatch");
    expect(parse(leer(".github/workflows/homesuite-production-backup.yml")).on.workflow_dispatch.inputs.simulate.type).toBe("boolean");
  });
});

describe("la prueba falla con workflows que violan las reglas", () => {
  const base = (extra) => `name: x\non: { workflow_dispatch: {} }\npermissions:\n  contents: read\njobs:\n  uno:\n    runs-on: ubuntu-latest\n${extra}\n`;

  it("detecta un secreto distinto de GITHUB_TOKEN", () => {
    const texto = base("    permissions: { issues: write, contents: read }\n    env: { CLOUDFLARE_API_TOKEN: '${{ secrets.HOMESUITE_PROD_BACKUP_API_TOKEN }}' }\n    steps: [{ run: echo }]");
    expect(revisarWorkflow(texto)).toEqual(["trabajo uno: usa secrets.HOMESUITE_PROD_BACKUP_API_TOKEN"]);
  });

  it("acepta secrets.GITHUB_TOKEN", () => {
    const texto = base("    permissions: { issues: write, contents: read }\n    env: { GH_TOKEN: '${{ secrets.GITHUB_TOKEN }}' }\n    steps: [{ run: echo }]");
    expect(revisarWorkflow(texto)).toEqual([]);
  });

  it("detecta permisos más amplios o ausentes", () => {
    expect(revisarWorkflow(base("    permissions: { contents: write }\n    steps: [{ run: echo }]"))).toEqual(["trabajo uno: permiso contents: write fuera de lo declarado"]);
    expect(revisarWorkflow(base("    permissions: { pull-requests: write }\n    steps: [{ run: echo }]"))).toEqual(["trabajo uno: permiso pull-requests: write fuera de lo declarado"]);
    expect(revisarWorkflow(base("    permissions: write-all\n    steps: [{ run: echo }]"))).toEqual(["trabajo uno: permisos «write-all» más amplios que los declarados"]);
    expect(revisarWorkflow(base("    steps: [{ run: echo }]"))).toEqual(["trabajo uno: no declara permisos"]);
    expect(revisarWorkflow("name: x\non: { workflow_dispatch: {} }\njobs:\n  uno:\n    runs-on: ubuntu-latest\n    permissions: { contents: read }\n    steps: [{ run: echo }]\n")).toEqual(["nivel superior: no declara permisos"]);
  });

  it("detecta expresiones dentro de run y accesos indirectos a secretos", () => {
    expect(revisarWorkflow(base("    permissions: { contents: read }\n    steps: [{ run: 'echo ${{ inputs.simulate }}' }]"))).toEqual(["trabajo uno: expresión dentro de run (usar env)"]);
    expect(revisarWorkflow(base("    permissions: { contents: read }\n    env: { TODO: '${{ toJSON(secrets) }}' }\n    steps: [{ run: echo }]"))).toEqual(["trabajo uno: accede a secretos de forma indirecta"]);
  });
});

describe("el documento de vigilancia y los avisos coinciden", () => {
  const documento = () => leer("docs/HOMESUITE_VIGILANCIA.md");

  it("la lista semanal del issue es la del documento", () => {
    const texto = documento();
    for (const linea of COMPROBACIONES_SEMANALES) expect(texto, linea).toContain(linea);
  });

  it("los títulos de los avisos figuran en el documento y declara qué no se vigila", () => {
    const texto = documento();
    for (const titulo of Object.values(TITULOS)) expect(texto).toContain(titulo);
    expect(texto).toMatch(/^## Qué no se vigila$/mu);
    for (const limite of ["5xx", "cron de mantenimiento", "slow_book_open", "GitHub Actions", "inactividad"]) expect(texto).toContain(limite);
  });

  it("las guías enlazadas desde los issues existen como títulos del documento", () => {
    const texto = documento();
    for (const titulo of ["Respaldo fallido", "/healthz no responde", "Respaldo desactualizado", "Revisión semanal"]) {
      expect(texto, titulo).toMatch(new RegExp(`^#{2,3} ${titulo}$`, "mu"));
    }
  });
});
