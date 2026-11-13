import { describe, expect, it } from "vitest";
import {
  COMPROBACIONES_SEMANALES, CUERPO_ESPERADO, ETIQUETA, OPERADOR, TITULOS, UMBRAL_HORAS,
  cuerpoRespaldoFallido, ejecutar, estaDesactualizado, evaluarRespuestaSalud, revisarSalud, semanaIso, sondaSimulada, tituloRevision, ultimoRespaldoExitoso,
} from "../../../scripts/alertas-operativas.mjs";

// Un `gh` falso con issues, etiquetas y corridas en memoria: registra cada llamada y responde como la CLI real.
function ghFalso({ issues = [], etiquetas = [], corridas = [], trabajos = {}, rechazarEtiquetaYAsignacion = false } = {}) {
  const estado = { issues: issues.map((issue) => ({ comentarios: [], cerrado: false, ...issue })), etiquetas: [...etiquetas], llamadas: [] };
  let siguiente = 100 + estado.issues.length;
  const valor = (args, bandera) => args[args.indexOf(bandera) + 1];
  const gh = (args) => {
    estado.llamadas.push(args);
    const [grupo, accion] = args;
    if (grupo === "label" && accion === "list") return JSON.stringify(estado.etiquetas.map((name) => ({ name })));
    if (grupo === "label" && accion === "create") { estado.etiquetas.push(args[2]); return ""; }
    if (grupo === "issue" && accion === "list") {
      return JSON.stringify(estado.issues.filter((issue) => !issue.cerrado).map((issue) => ({ number: issue.number, title: issue.title, url: `https://example.test/${issue.number}`, createdAt: issue.createdAt ?? "2026-11-03T00:00:00Z" })));
    }
    if (grupo === "issue" && accion === "view") {
      const issue = estado.issues.find((candidato) => String(candidato.number) === args[2]);
      return JSON.stringify({ createdAt: issue.createdAt ?? "2026-11-03T00:00:00Z", comments: issue.comentarios.map((c) => ({ createdAt: c.createdAt ?? "2026-11-03T00:00:00Z" })) });
    }
    if (grupo === "issue" && accion === "create") {
      if (rechazarEtiquetaYAsignacion && (args.includes("--label") || args.includes("--assignee"))) throw new Error("could not add label: 'alerta-operativa' not found\nmás detalle");
      estado.issues.push({ number: siguiente += 1, title: valor(args, "--title"), cuerpo: valor(args, "--body"), etiqueta: args.includes("--label") ? valor(args, "--label") : null, asignado: args.includes("--assignee") ? valor(args, "--assignee") : null, comentarios: [], cerrado: false });
      return "https://example.test/nuevo";
    }
    if (grupo === "issue" && accion === "comment") {
      estado.issues.find((issue) => String(issue.number) === args[2]).comentarios.push({ cuerpo: valor(args, "--body") });
      return "";
    }
    if (grupo === "issue" && accion === "close") { estado.issues.find((issue) => String(issue.number) === args[2]).cerrado = true; return ""; }
    if (grupo === "run" && accion === "list") return JSON.stringify(corridas);
    if (grupo === "run" && accion === "view") return JSON.stringify({ jobs: trabajos[args[2]] ?? [] });
    throw new Error(`gh no previsto: ${args.join(" ")}`);
  };
  return { gh, estado };
}

const ENTORNO = { GH_REPO: "pablotortorella/tas-king", GITHUB_RUN_ID: "123", GITHUB_SERVER_URL: "https://github.com" };
const AHORA = new Date("2026-11-03T20:00:00Z");
const abiertos = (estado) => estado.issues.filter((issue) => !issue.cerrado);
const sinDormir = async () => {};

describe("respaldo fallido", () => {
  it("abre un issue con etiqueta, asignación, enlace a la corrida y fecha UTC, sin registros", async () => {
    const { gh, estado } = ghFalso();
    const resumen = await ejecutar("respaldo-fallido", { entorno: ENTORNO, gh, ahora: AHORA });
    expect(resumen.accion).toBe("creado");
    const [issue] = abiertos(estado);
    expect(issue).toMatchObject({ title: TITULOS.respaldo, etiqueta: ETIQUETA, asignado: OPERADOR });
    expect(issue.cuerpo.split("\n")[0]).toBe("Corrida: https://github.com/pablotortorella/tas-king/actions/runs/123");
    expect(issue.cuerpo).toContain("2026-11-03 20:00 UTC");
    expect(estado.etiquetas).toContain(ETIQUETA);
  });

  it("una segunda falla con el issue abierto comenta y no abre otro", async () => {
    const { gh, estado } = ghFalso({ issues: [{ number: 7, title: TITULOS.respaldo }], etiquetas: [ETIQUETA] });
    const resumen = await ejecutar("respaldo-fallido", { entorno: { ...ENTORNO, GITHUB_RUN_ID: "456" }, gh, ahora: AHORA });
    expect(resumen).toMatchObject({ accion: "comentado", numero: 7 });
    expect(abiertos(estado)).toHaveLength(1);
    expect(estado.issues[0].comentarios[0].cuerpo).toContain("actions/runs/456");
  });

  it("un issue cerrado no cuenta: la nueva falla abre uno nuevo", async () => {
    const { gh, estado } = ghFalso({ issues: [{ number: 7, title: TITULOS.respaldo, cerrado: true }], etiquetas: [ETIQUETA] });
    await ejecutar("respaldo-fallido", { entorno: ENTORNO, gh, ahora: AHORA });
    expect(abiertos(estado)).toHaveLength(1);
    expect(abiertos(estado)[0].number).not.toBe(7);
  });

  it("si la etiqueta o la asignación son rechazadas, igual abre el issue", async () => {
    const { gh, estado } = ghFalso({ rechazarEtiquetaYAsignacion: true });
    await ejecutar("respaldo-fallido", { entorno: ENTORNO, gh, ahora: AHORA });
    expect(abiertos(estado)).toHaveLength(1);
    expect(abiertos(estado)[0]).toMatchObject({ title: TITULOS.respaldo, etiqueta: null, asignado: null });
  });

  it("un simulacro usa otro título y no toca el aviso real", async () => {
    const { gh, estado } = ghFalso({ issues: [{ number: 7, title: TITULOS.respaldo }], etiquetas: [ETIQUETA] });
    await ejecutar("respaldo-fallido", { entorno: { ...ENTORNO, SIMULATE: "true" }, gh, ahora: AHORA });
    expect(abiertos(estado).map((issue) => issue.title)).toEqual([TITULOS.respaldo, `[Simulacro] ${TITULOS.respaldo}`]);
    expect(estado.issues[0].comentarios).toHaveLength(0);
    // Un segundo simulacro comenta en el simulado.
    await ejecutar("respaldo-fallido", { entorno: { ...ENTORNO, SIMULATE: "true" }, gh, ahora: AHORA });
    expect(abiertos(estado)).toHaveLength(2);
    expect(estado.issues[1].comentarios).toHaveLength(1);
  });

  it("el texto del aviso no trae registros ni correos", () => {
    const cuerpo = cuerpoRespaldoFallido({ urlCorrida: "https://github.com/x/y/actions/runs/1", repo: "x/y", ahora: AHORA, simulacro: false });
    expect(cuerpo).not.toMatch(/@\w+\.\w+/u);
    expect(cuerpo).toContain("no incluye registros");
  });
});

describe("evaluación de /healthz", () => {
  it("exige 200 y el cuerpo esperado", () => {
    expect(evaluarRespuestaSalud({ codigo: 200, cuerpo: JSON.stringify(CUERPO_ESPERADO) }).ok).toBe(true);
    expect(evaluarRespuestaSalud({ codigo: 200, cuerpo: ` {"service":"homesuite-app", "status":"ok"}\n` }).ok).toBe(true);
    expect(evaluarRespuestaSalud({ codigo: 200, cuerpo: "<html>Cloudflare</html>" })).toMatchObject({ ok: false, motivo: "cuerpo" });
    expect(evaluarRespuestaSalud({ codigo: 200, cuerpo: '{"status":"ok","service":"otra"}' })).toMatchObject({ ok: false, motivo: "cuerpo" });
    expect(evaluarRespuestaSalud({ codigo: 502, cuerpo: "" })).toMatchObject({ ok: false, motivo: "codigo", codigo: 502 });
    expect(evaluarRespuestaSalud({ codigo: 0, cuerpo: "" })).toMatchObject({ ok: false, motivo: "sin-respuesta" });
  });

  it("reintenta tres veces, separadas por 15 segundos, y para en el primer éxito", async () => {
    const esperas = [];
    const dormir = async (ms) => { esperas.push(ms); };
    const bien = { codigo: 200, cuerpo: JSON.stringify(CUERPO_ESPERADO) };
    const caida = await revisarSalud({ sonda: () => ({ codigo: 503, cuerpo: "" }), dormir });
    expect(caida).toMatchObject({ sano: false });
    expect(caida.intentos).toHaveLength(3);
    expect(esperas).toEqual([15_000, 15_000]);
    esperas.length = 0;
    const respuestas = [{ codigo: 0, cuerpo: "" }, bien];
    const tropiezo = await revisarSalud({ sonda: () => respuestas.shift(), dormir });
    expect(tropiezo.sano).toBe(true);
    expect(tropiezo.intentos).toHaveLength(2);
    expect(esperas).toEqual([15_000]);
  });
});

describe("chequeo de salud con issues", () => {
  const caida = () => ({ codigo: 503, cuerpo: "" });
  const bien = () => ({ codigo: 200, cuerpo: JSON.stringify(CUERPO_ESPERADO) });

  it("caída: tres intentos fallidos abren el issue", async () => {
    const { gh, estado } = ghFalso();
    const resumen = await ejecutar("salud", { entorno: ENTORNO, gh, sonda: caida, dormir: sinDormir, ahora: AHORA });
    expect(resumen).toMatchObject({ sano: false, intentos: 3, accion: "creado" });
    expect(abiertos(estado)[0]).toMatchObject({ title: TITULOS.salud, asignado: OPERADOR });
    expect(abiertos(estado)[0].cuerpo).toContain("1) HTTP 503");
  });

  it("tropiezo aislado: no crea ningún issue", async () => {
    const { gh, estado } = ghFalso();
    const respuestas = [{ codigo: 0, cuerpo: "" }, bien()];
    const resumen = await ejecutar("salud", { entorno: ENTORNO, gh, sonda: () => respuestas.shift(), dormir: sinDormir, ahora: AHORA });
    expect(resumen).toMatchObject({ sano: true, accion: "nada" });
    expect(estado.issues).toHaveLength(0);
  });

  it("recuperación: comenta y cierra el issue abierto", async () => {
    const { gh, estado } = ghFalso({ issues: [{ number: 9, title: TITULOS.salud }] });
    const resumen = await ejecutar("salud", { entorno: ENTORNO, gh, sonda: bien, dormir: sinDormir, ahora: AHORA });
    expect(resumen).toMatchObject({ sano: true, accion: "cerrado", numero: 9 });
    expect(estado.issues[0].cerrado).toBe(true);
    expect(estado.issues[0].comentarios[0].cuerpo).toContain("Recuperado");
  });

  it("caída sostenida: no comenta de nuevo antes de dos horas, y sí después", async () => {
    const { gh, estado } = ghFalso({ issues: [{ number: 9, title: TITULOS.salud, createdAt: "2026-11-03T19:30:00Z" }] });
    expect(await ejecutar("salud", { entorno: ENTORNO, gh, sonda: caida, dormir: sinDormir, ahora: AHORA })).toMatchObject({ accion: "omitido" });
    expect(estado.issues[0].comentarios).toHaveLength(0);
    const tarde = new Date("2026-11-03T22:00:00Z");
    expect(await ejecutar("salud", { entorno: ENTORNO, gh, sonda: caida, dormir: sinDormir, ahora: tarde })).toMatchObject({ accion: "comentado" });
    expect(estado.issues[0].comentarios).toHaveLength(1);
  });

  it("los tres ensayos de workflow_dispatch cubren los tres caminos sin tocar el aviso real", async () => {
    const { gh, estado } = ghFalso({ issues: [{ number: 1, title: TITULOS.salud }] });
    const correr = (simulacion) => ejecutar("salud", { entorno: { ...ENTORNO, SIMULATE: simulacion }, gh, ahora: AHORA });
    expect(await correr("tropiezo")).toMatchObject({ sano: true, intentos: 2, accion: "nada" });
    expect(await correr("caida")).toMatchObject({ sano: false, accion: "creado" });
    expect(estado.issues.at(-1).title).toBe(`[Simulacro] ${TITULOS.salud}`);
    expect(await correr("recuperacion")).toMatchObject({ sano: true, accion: "cerrado" });
    expect(estado.issues.at(-1).cerrado).toBe(true);
    expect(estado.issues[0].cerrado).toBe(false);
    expect(estado.issues[0].comentarios).toHaveLength(0);
    expect(sondaSimulada("tropiezo")().codigo).toBe(0);
  });
});

describe("antigüedad del respaldo", () => {
  const hace = (horas) => new Date(AHORA.getTime() - horas * 3_600_000).toISOString();
  const trabajoOk = [{ name: "backup", conclusion: "success" }];

  it("al día: 14 horas no abren ningún issue", async () => {
    const { gh, estado } = ghFalso({ corridas: [{ databaseId: 1, createdAt: hace(14), url: "u" }], trabajos: { 1: trabajoOk } });
    expect(await ejecutar("antiguedad", { entorno: ENTORNO, gh, ahora: AHORA })).toMatchObject({ accion: "nada" });
    expect(estado.issues).toHaveLength(0);
  });

  it("un día sin respaldo: más de 26 horas abren el issue y las siguientes veces comenta", async () => {
    const { gh, estado } = ghFalso({ corridas: [{ databaseId: 1, createdAt: hace(30), url: "u" }], trabajos: { 1: trabajoOk } });
    expect(await ejecutar("antiguedad", { entorno: ENTORNO, gh, ahora: AHORA })).toMatchObject({ accion: "creado" });
    expect(abiertos(estado)[0]).toMatchObject({ title: TITULOS.antiguedad, asignado: OPERADOR });
    expect(abiertos(estado)[0].cuerpo).toContain("hace 30 h");
    expect(await ejecutar("antiguedad", { entorno: ENTORNO, gh, ahora: AHORA })).toMatchObject({ accion: "comentado" });
    expect(abiertos(estado)).toHaveLength(1);
  });

  it("el umbral es de 26 horas", () => {
    expect(UMBRAL_HORAS).toBe(26);
    expect(estaDesactualizado({ horas: 26 })).toBe(false);
    expect(estaDesactualizado({ horas: 26.1 })).toBe(true);
    expect(estaDesactualizado(null)).toBe(true);
  });

  it("variable de habilitación en false: una corrida «exitosa» con el trabajo omitido no cuenta y se abre el issue", async () => {
    const { gh, estado } = ghFalso({
      corridas: [{ databaseId: 2, createdAt: hace(3), url: "u2" }, { databaseId: 1, createdAt: hace(40), url: "u1" }],
      trabajos: { 2: [{ name: "backup", conclusion: "skipped" }], 1: trabajoOk },
    });
    expect(ultimoRespaldoExitoso({ gh, ahora: AHORA })).toMatchObject({ databaseId: 1 });
    expect(await ejecutar("antiguedad", { entorno: ENTORNO, gh, ahora: AHORA })).toMatchObject({ accion: "creado" });
    expect(abiertos(estado)).toHaveLength(1);
  });

  it("sin ninguna corrida exitosa abre el issue", async () => {
    const { gh, estado } = ghFalso();
    expect(await ejecutar("antiguedad", { entorno: ENTORNO, gh, ahora: AHORA })).toMatchObject({ accion: "creado" });
    expect(abiertos(estado)[0].cuerpo).toContain("No hay ninguna corrida exitosa reciente");
  });

  it("los ensayos usan un título de simulacro", async () => {
    const { gh, estado } = ghFalso();
    expect(await ejecutar("antiguedad", { entorno: { ...ENTORNO, SIMULATE: "al-dia" }, gh, ahora: AHORA })).toMatchObject({ accion: "nada" });
    expect(await ejecutar("antiguedad", { entorno: { ...ENTORNO, SIMULATE: "desactualizado" }, gh, ahora: AHORA })).toMatchObject({ accion: "creado" });
    expect(estado.issues.map((issue) => issue.title)).toEqual([`[Simulacro] ${TITULOS.antiguedad}`]);
  });
});

describe("revisión semanal", () => {
  it("calcula la semana ISO", () => {
    expect(semanaIso(new Date("2026-11-02T12:00:00Z"))).toBe("2026-S45");
    expect(semanaIso(new Date("2026-01-01T12:00:00Z"))).toBe("2026-S01");
    expect(semanaIso(new Date("2027-01-01T12:00:00Z"))).toBe("2026-S53");
    expect(tituloRevision(new Date("2026-11-09T12:00:00Z"))).toBe("Revisión semanal de operación 2026-S46");
  });

  it("abre el issue con la lista de comprobación y menciona la revisión anterior abierta", async () => {
    const { gh, estado } = ghFalso({ issues: [{ number: 40, title: "Revisión semanal de operación 2026-S45" }] });
    const resumen = await ejecutar("revision-semanal", { entorno: ENTORNO, gh, ahora: new Date("2026-11-09T12:00:00Z") });
    expect(resumen.accion).toBe("creado");
    const nuevo = estado.issues.at(-1);
    expect(nuevo).toMatchObject({ title: "Revisión semanal de operación 2026-S46", asignado: OPERADOR });
    for (const linea of COMPROBACIONES_SEMANALES) expect(nuevo.cuerpo).toContain(`- [ ] ${linea}`);
    expect(nuevo.cuerpo).toContain("#40");
  });

  it("no duplica el de la misma semana", async () => {
    const { gh, estado } = ghFalso({ issues: [{ number: 41, title: "Revisión semanal de operación 2026-S46" }] });
    expect(await ejecutar("revision-semanal", { entorno: ENTORNO, gh, ahora: new Date("2026-11-09T12:00:00Z") })).toMatchObject({ accion: "omitido" });
    expect(estado.issues).toHaveLength(1);
  });
});

describe("comando desconocido", () => {
  it("falla con un mensaje claro", async () => {
    await expect(ejecutar("otra-cosa", { entorno: ENTORNO, gh: ghFalso().gh })).rejects.toThrow(/Comando desconocido/u);
  });
});
