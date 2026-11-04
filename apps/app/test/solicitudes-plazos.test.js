import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  addBusinessDays, businessDaysLeft, deadlines, evaluate, festivosColombia, formatIsoDate, formatReport, isBusinessDay, loadHolidays, parseIsoDate, parseRequests,
} from "../../../scripts/solicitudes-plazos.mjs";

// Calculadora de plazos de las solicitudes de datos (Ley 1581, arts. 14 y 15): días hábiles de Colombia, fines de semana, un festivo y las
// prórrogas. Los festivos del archivo configurable NO están verificados contra el calendario oficial (ver scripts/festivos-colombia.json).
const holidays = loadHolidays();
const d = (text) => parseIsoDate(text);
const iso = (date) => formatIsoDate(date);
const SCRIPT = fileURLToPath(new URL("../../../scripts/solicitudes-plazos.mjs", import.meta.url));

describe("festivos de Colombia", () => {
  it("el archivo configurable coincide con la regla calculada y avisa que no está verificado", () => {
    expect(holidays.verificado).toBe(false);
    for (const [year, days] of holidays.years) expect([...days].sort()).toEqual(festivosColombia(year));
    expect([...holidays.years.keys()]).toEqual(expect.arrayContaining([2026, 2027]));
  });

  it("2026 tiene los 18 festivos esperados, con los pasados al lunes", () => {
    expect(festivosColombia(2026)).toEqual([
      "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", "2026-05-01", "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29",
      "2026-07-20", "2026-08-07", "2026-08-17", "2026-10-12", "2026-11-02", "2026-11-16", "2026-12-08", "2026-12-25",
    ]);
  });

  it("sábados, domingos y festivos no son días hábiles", () => {
    expect(isBusinessDay(d("2026-11-13"), holidays)).toBe(true); // viernes
    expect(isBusinessDay(d("2026-11-14"), holidays)).toBe(false); // sábado
    expect(isBusinessDay(d("2026-11-15"), holidays)).toBe(false); // domingo
    expect(isBusinessDay(d("2026-11-16"), holidays)).toBe(false); // lunes festivo
    expect(isBusinessDay(d("2026-11-17"), holidays)).toBe(true);
  });

  it("falla de forma explícita si falta el año en lugar de contar mal", () => {
    expect(() => isBusinessDay(d("2035-03-02"), holidays)).toThrow(/No hay festivos cargados para 2035/u);
  });
});

describe("fechas límite", () => {
  it("un reclamo recibido un jueves cuenta 15 días hábiles desde el día siguiente y salta el fin de semana y el festivo", () => {
    // jueves 2026-11-05; el lunes 2026-11-16 es festivo
    expect(iso(deadlines({ tipo: "reclamo", recibido: "2026-11-05" }, holidays).limite)).toBe("2026-11-27");
    // el mismo cálculo sin el festivo caería el lunes siguiente
    const sinFestivo = { years: new Map([[2026, new Set()]]) };
    expect(iso(deadlines({ tipo: "reclamo", recibido: "2026-11-05" }, sinFestivo).limite)).toBe("2026-11-26");
  });

  it("un reclamo recibido en fin de semana empieza a contar el lunes hábil siguiente", () => {
    expect(iso(deadlines({ tipo: "reclamo", recibido: "2026-11-07" }, holidays).limite)).toBe("2026-11-30"); // sábado
    expect(iso(deadlines({ tipo: "reclamo", recibido: "2026-11-08" }, holidays).limite)).toBe("2026-11-30"); // domingo
  });

  it("una consulta cuenta el día del recibo como el primero si es hábil (criterio conservador)", () => {
    expect(iso(deadlines({ tipo: "consulta", recibido: "2026-11-09" }, holidays).limite)).toBe("2026-11-23"); // lunes
    // recibida un sábado, el primero es el lunes siguiente
    expect(iso(deadlines({ tipo: "consulta", recibido: "2026-11-07" }, holidays).limite)).toBe("2026-11-23");
  });

  it("las prórrogas suman hasta 5 (consulta) u 8 (reclamo) días hábiles después del plazo original", () => {
    const reclamo = deadlines({ tipo: "reclamo", recibido: "2026-11-05" }, holidays);
    expect(iso(reclamo.conProrroga)).toBe("2026-12-10"); // 8 hábiles después del 27/11, sin contar el festivo del 8/12
    const consulta = deadlines({ tipo: "consulta", recibido: "2026-11-09" }, holidays);
    expect(iso(consulta.conProrroga)).toBe("2026-11-30"); // 5 hábiles después del 23/11
  });

  it("la leyenda «reclamo en trámite» vence a los 2 días hábiles y la subsanación a los 5 días corridos", () => {
    const reclamo = deadlines({ tipo: "reclamo", recibido: "2026-11-05" }, holidays);
    expect(iso(reclamo.leyenda)).toBe("2026-11-09"); // jueves -> viernes (1), lunes (2)
    expect(iso(reclamo.subsanacion)).toBe("2026-11-10");
    expect(deadlines({ tipo: "consulta", recibido: "2026-11-05" }, holidays).leyenda).toBeNull();
  });

  it("rechaza tipos y fechas inválidos", () => {
    expect(() => deadlines({ tipo: "queja", recibido: "2026-11-05" }, holidays)).toThrow(/Tipo de solicitud desconocido/u);
    expect(() => deadlines({ tipo: "reclamo", recibido: "05/11/2026" }, holidays)).toThrow(/Fecha de recibo inválida/u);
    expect(parseIsoDate("2026-02-30")).toBeNull();
  });

  it("addBusinessDays y businessDaysLeft son consistentes", () => {
    expect(iso(addBusinessDays(d("2026-11-13"), 1, holidays))).toBe("2026-11-17");
    expect(businessDaysLeft(d("2026-11-13"), d("2026-11-17"), holidays)).toBe(1);
    expect(businessDaysLeft(d("2026-11-17"), d("2026-11-17"), holidays)).toBe(0);
    expect(businessDaysLeft(d("2026-11-18"), d("2026-11-17"), holidays)).toBe(-1);
    expect(businessDaysLeft(d("2026-11-20"), d("2026-11-17"), holidays)).toBe(-3);
  });
});

describe("solicitudes abiertas", () => {
  const csv = [
    "id,tipo,recibido,leyenda,prorroga,respondido,resultado",
    "SOL-2026-001,reclamo,2026-11-05,2026-11-06,no,,en curso",
    "SOL-2026-002,consulta,2026-11-09,,no,,",
    "SOL-2026-003,reclamo,2026-10-01,2026-10-02,no,2026-10-20,suprimido",
    "SOL-2026-004,reclamo,2026-10-20,,si,,",
  ].join("\n");

  it("lista sólo las abiertas, con los días hábiles que quedan, ordenadas por urgencia", () => {
    const rows = evaluate(parseRequests(csv), d("2026-11-23"), holidays);
    expect(rows.map((row) => row.id)).toEqual(["SOL-2026-002", "SOL-2026-004", "SOL-2026-001"]);
    expect(rows.find((row) => row.id === "SOL-2026-002")).toMatchObject({ limite: "2026-11-23", restantes: 0, estado: "por vencer" });
    expect(rows.find((row) => row.id === "SOL-2026-001")).toMatchObject({ limite: "2026-11-27", restantes: 4, estado: "por vencer" });
  });

  it("una solicitud con 3 días hábiles por delante figura como por vencer y una pasada como vencida", () => {
    const rows = evaluate(parseRequests(csv), d("2026-11-24"), holidays);
    expect(rows.find((row) => row.id === "SOL-2026-001")).toMatchObject({ restantes: 3, estado: "por vencer" });
    expect(rows.find((row) => row.id === "SOL-2026-002")).toMatchObject({ restantes: -1, estado: "vencida" });
  });

  it("con prórroga avisada usa la fecha ampliada y una solicitud con mucho margen está en plazo", () => {
    const [row] = evaluate(parseRequests("id,tipo,recibido,leyenda,prorroga,respondido\nX,reclamo,2026-11-05,2026-11-06,si,"), d("2026-11-10"), holidays);
    expect(row).toMatchObject({ limite: "2026-12-10", prorroga: true, estado: "en plazo" });
  });

  it("avisa cuando a un reclamo le falta la leyenda pasados 2 días hábiles", () => {
    const [row] = evaluate(parseRequests("id,tipo,recibido,leyenda,prorroga,respondido\nX,reclamo,2026-11-05,,no,"), d("2026-11-10"), holidays);
    expect(row.leyendaPendiente).toBe(true);
    const [dentro] = evaluate(parseRequests("id,tipo,recibido,leyenda,prorroga,respondido\nX,reclamo,2026-11-05,,no,"), d("2026-11-09"), holidays);
    expect(dentro.leyendaPendiente).toBe(false);
  });

  it("acepta encabezados con tildes y mayúsculas, y el informe resume vencidas y por vencer", () => {
    const rows = evaluate(parseRequests("ID,Tipo,Recibido,Leyenda,Prórroga,Respondido\nX,Reclamo,2026-11-05,2026-11-06,Sí,"), d("2026-11-10"), holidays);
    expect(rows[0]).toMatchObject({ prorroga: true, tipo: "reclamo" });
    const report = formatReport(evaluate(parseRequests(csv), d("2026-12-30"), holidays), d("2026-12-30"));
    expect(report).toContain("3 vencidas");
    expect(report).toContain("VENCIDA");
    expect(formatReport([], d("2026-11-10"))).toBe("Sin solicitudes abiertas al 2026-11-10.");
  });

  it("el informe no contiene el contenido de ninguna solicitud: sólo identificador, tipo y fechas", () => {
    const report = formatReport(evaluate(parseRequests(`${csv}`), d("2026-11-23"), holidays), d("2026-11-23"));
    expect(report).not.toContain("suprimido");
    expect(report).not.toContain("en curso");
  });
});

describe("línea de comandos", () => {
  it("lee la planilla, avisa que los festivos no están verificados e imprime el informe", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "solicitudes-"));
    try {
      const file = path.join(directory, "planilla.csv");
      writeFileSync(file, "id,tipo,recibido,leyenda,prorroga,respondido\nSOL-2026-001,reclamo,2026-11-05,2026-11-06,no,\n");
      const stdout = execFileSync(process.execPath, [SCRIPT, file, "--hoy", "2026-11-24"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      expect(stdout).toContain("SOL-2026-001");
      expect(stdout).toContain("límite 2026-11-27");
      expect(stdout).toContain("3 días hábiles");
      expect(stdout).toContain("POR VENCER");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it("sin archivo explica el uso", () => {
    expect(() => execFileSync(process.execPath, [SCRIPT], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })).toThrow(/Uso:/u);
  });
});
