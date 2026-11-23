import { describe, expect, it } from "vitest";
import { colombiaDay, isClosed, isPeriodKey, nextPeriod, periodDays, periodEnd, periodKey, periodKeys, periodRange, previousPeriod } from "../src/usage-periods.js";

// Períodos de la estadística de uso (design.md D6): claves, fines, anterior y siguiente, en hora de Colombia (UTC−5).
describe("día de Colombia", () => {
  it("cambia a la medianoche de Colombia, no a la de UTC", () => {
    expect(colombiaDay(new Date("2026-11-23T04:59:59Z"))).toBe("2026-11-22");
    expect(colombiaDay(new Date("2026-11-23T05:00:00Z"))).toBe("2026-11-23");
    // 23:50 y 00:10 de Colombia.
    expect(colombiaDay(new Date("2026-11-23T04:50:00Z"))).toBe("2026-11-22");
    expect(colombiaDay(new Date("2026-11-23T05:10:00Z"))).toBe("2026-11-23");
  });

  it("el cron de producción (04:23 UTC) cae en el día de Colombia que termina", () => {
    expect(colombiaDay(new Date("2026-12-01T04:23:00Z"))).toBe("2026-11-30");
  });
});

describe("claves de período", () => {
  it("arma las cinco claves de un día", () => {
    expect(periodKeys("2026-11-22")).toEqual({ day: "2026-11-22", week: "2026-W47", month: "2026-11", quarter: "2026-Q4", year: "2026" });
  });

  it("semana 53 y el 1 de enero en la semana ISO del año anterior", () => {
    expect(periodKey("week", "2026-12-31")).toBe("2026-W53");
    expect(periodKey("week", "2027-01-01")).toBe("2026-W53");
    expect(periodKey("week", "2027-01-03")).toBe("2026-W53");
    expect(periodKey("week", "2027-01-04")).toBe("2027-W01");
    expect(periodKey("week", "2021-01-01")).toBe("2020-W53");
    // Al revés: el 29 de diciembre de 2025 ya es la semana 1 de 2026.
    expect(periodKey("week", "2025-12-29")).toBe("2026-W01");
  });

  it("fin de año: el 31 de diciembre cierra semana, mes, trimestre y año del mismo año calendario", () => {
    expect(periodKeys("2026-12-31")).toMatchObject({ month: "2026-12", quarter: "2026-Q4", year: "2026" });
    expect(periodKeys("2027-01-01")).toMatchObject({ month: "2027-01", quarter: "2027-Q1", year: "2027" });
  });
});

describe("rangos y fines", () => {
  it("años bisiestos", () => {
    expect(periodEnd("month", "2028-02")).toBe("2028-02-29");
    expect(periodEnd("month", "2027-02")).toBe("2027-02-28");
    expect(periodDays("quarter", "2028-Q1")).toHaveLength(91);
    expect(periodDays("year", "2028")).toHaveLength(366);
    expect(periodDays("year", "2027")).toHaveLength(365);
  });

  it("semanas de lunes a domingo", () => {
    expect(periodRange("week", "2026-W53")).toEqual({ start: "2026-12-28", end: "2027-01-03" });
    expect(periodRange("week", "2026-W01")).toEqual({ start: "2025-12-29", end: "2026-01-04" });
  });

  it("trimestres", () => {
    expect(periodRange("quarter", "2026-Q4")).toEqual({ start: "2026-10-01", end: "2026-12-31" });
    expect(periodRange("quarter", "2026-Q1")).toEqual({ start: "2026-01-01", end: "2026-03-31" });
  });

  it("rechaza claves inválidas", () => {
    expect(isPeriodKey("week", "2027-W53")).toBe(false); // 2027 tiene 52 semanas
    expect(isPeriodKey("week", "2026-W53")).toBe(true);
    expect(isPeriodKey("month", "2026-13")).toBe(false);
    expect(isPeriodKey("day", "2027-02-29")).toBe(false);
    expect(isPeriodKey("quarter", "2026-Q5")).toBe(false);
    expect(isPeriodKey("year", "x")).toBe(false);
    expect(isPeriodKey("semestre", "2026-S1")).toBe(false);
  });
});

describe("anterior, siguiente y cierre", () => {
  it("navega entre períodos del mismo tipo", () => {
    expect(previousPeriod("month", "2026-01")).toBe("2025-12");
    expect(nextPeriod("month", "2026-12")).toBe("2027-01");
    expect(previousPeriod("week", "2026-W01")).toBe("2025-W52");
    expect(nextPeriod("week", "2026-W53")).toBe("2027-W01");
    expect(previousPeriod("quarter", "2027-Q1")).toBe("2026-Q4");
    expect(nextPeriod("year", "2026")).toBe("2027");
    expect(previousPeriod("day", "2028-03-01")).toBe("2028-02-29");
  });

  it("un período está cerrado cuando su último día pasó", () => {
    expect(isClosed("month", "2026-11", "2026-11-30")).toBe(false);
    expect(isClosed("month", "2026-11", "2026-12-01")).toBe(true);
    expect(isClosed("day", "2026-11-22", "2026-11-23")).toBe(true);
    expect(isClosed("year", "2026", "2026-12-31")).toBe(false);
  });
});
