import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { purgeClosedUsageMarkers, runMaintenance, saveSuiteSnapshot } from "../src/maintenance.js";
import { recordUsage } from "../src/usage.js";
import { isClosed, periodKeys } from "../src/usage-periods.js";

// Mantenimiento de la estadística de uso (tarea 5.1; spec proteccion-operativa-homesuite y estadisticas-de-uso-homesuite).
const SECRET = "p".repeat(32);
const at = (day, hour = "15:00") => new Date(`${day}T${hour}:00-05:00`);
const markers = async () => (await env.DB.prepare("SELECT period_type, period_key FROM usage_period_markers WHERE period_key LIKE '2033%' ORDER BY period_type, period_key").all()).results;
const count = async (sql) => (await env.DB.prepare(sql).first()).n;

describe("purga de marcas de períodos cerrados", () => {
  it("al pasar fin de mes borra las marcas del mes, de sus días y de sus semanas cerradas; quedan trimestre y año; el contador queda", async () => {
    const userId = `user_${crypto.randomUUID()}`;
    for (const day of ["2033-11-03", "2033-11-17", "2033-11-30"]) await recordUsage(env.DB, { userId, tool: "tasks", level: "entro", secret: SECRET, now: at(day) });
    const peopleBefore = await count("SELECT people AS n FROM usage_period_people WHERE period_type = 'month' AND period_key = '2033-11' AND tool = 'tasks' AND level = 'entro'");
    expect(peopleBefore).toBe(1);

    // El cron del 1 de diciembre a las 23:23 de Colombia: hoy es 2033-12-01.
    const purged = await purgeClosedUsageMarkers(env.DB, new Date("2033-12-02T04:23:00Z"));
    expect(purged).toBeGreaterThan(0);
    const left = await markers();
    expect(left.filter((row) => row.period_type === "month")).toEqual([]);
    expect(left.filter((row) => row.period_type === "day")).toEqual([]);
    for (const row of left.filter((r) => r.period_type === "week")) expect(isClosed("week", row.period_key, "2033-12-01")).toBe(false);
    expect(left).toEqual(expect.arrayContaining([{ period_type: "quarter", period_key: "2033-Q4" }, { period_type: "year", period_key: "2033" }]));
    expect(await count("SELECT people AS n FROM usage_period_people WHERE period_type = 'month' AND period_key = '2033-11' AND tool = 'tasks' AND level = 'entro'")).toBe(1);

    // A mitad del trimestre siguiente siguen las del año; al cerrar el año se van todas.
    await purgeClosedUsageMarkers(env.DB, at("2033-12-20"));
    expect((await markers()).map((row) => row.period_type)).toEqual(expect.arrayContaining(["quarter", "year"]));
    await purgeClosedUsageMarkers(env.DB, at("2034-01-01"));
    expect(await markers()).toEqual([]);
    expect(await count("SELECT people AS n FROM usage_period_people WHERE period_type = 'year' AND period_key = '2033' AND tool = 'tasks' AND level = 'entro'")).toBe(1);
  });

  it("después de purgar una semana cerrada, la misma persona no cuenta doble en el mes en curso", async () => {
    const userId = `user_${crypto.randomUUID()}`;
    await recordUsage(env.DB, { userId, tool: "calm", level: "entro", secret: SECRET, now: at("2035-03-02") });
    await purgeClosedUsageMarkers(env.DB, at("2035-03-20"));
    await recordUsage(env.DB, { userId, tool: "calm", level: "entro", secret: SECRET, now: at("2035-03-21") });
    expect(await count("SELECT people AS n FROM usage_period_people WHERE period_type = 'month' AND period_key = '2035-03' AND tool = 'calm' AND level = 'entro'")).toBe(1);
    expect(await count(`SELECT people AS n FROM usage_period_people WHERE period_type = 'week' AND period_key = '${periodKeys("2035-03-21").week}' AND tool = 'calm' AND level = 'entro'`)).toBe(1);
  });

  it("no toca la auditoría, los contadores ni la historia financiera", async () => {
    const before = await Promise.all(["platform_audit_events", "usage_daily_counts", "usage_period_people", "ledger_entries", "entry_revisions"].map((table) => count(`SELECT COUNT(*) AS n FROM ${table}`)));
    await purgeClosedUsageMarkers(env.DB, at("2040-01-01"));
    await saveSuiteSnapshot(env.DB, at("2040-01-01"));
    const after = await Promise.all(["platform_audit_events", "usage_daily_counts", "usage_period_people", "ledger_entries", "entry_revisions"].map((table) => count(`SELECT COUNT(*) AS n FROM ${table}`)));
    expect(after).toEqual(before);
  });
});

describe("foto diaria de la suite", () => {
  it("guarda cuentas y activas en 1, 7 y 30 días; dos corridas el mismo día dejan una sola foto con la última", async () => {
    const day = "2032-06-15";
    const seed = [day, day, day, "2032-06-10", "2032-06-09", "2032-06-09", "2032-05-27", "2032-05-20", "2032-05-17", "2032-05-16", null, null];
    for (const lastActive of seed) {
      const id = `user_${crypto.randomUUID()}`;
      await env.DB.prepare("INSERT INTO users (id, google_sub, email, display_name, last_active_on) VALUES (?, ?, ?, 'Foto', ?)").bind(id, `sub-${id}`, `${id}@example.test`, lastActive).run();
    }
    const now = new Date("2032-06-16T04:23:00Z"); // 23:23 del 15 en Colombia
    expect(await saveSuiteSnapshot(env.DB, now)).toBe(day);
    const accounts = await count("SELECT COUNT(*) AS n FROM users");
    expect(await env.DB.prepare("SELECT * FROM usage_suite_snapshots WHERE day = ?").bind(day).first()).toEqual({ day, accounts, active_1d: 3, active_7d: 6, active_30d: 9 });

    await env.DB.prepare("UPDATE users SET last_active_on = ? WHERE last_active_on = '2032-05-16'").bind(day).run();
    await saveSuiteSnapshot(env.DB, now);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n, MAX(active_1d) AS one, MAX(active_30d) AS thirty FROM usage_suite_snapshots WHERE day = ?").bind(day).first())).toEqual({ n: 1, one: 4, thirty: 10 });
  });

  it("runMaintenance informa la purga y el día de la foto", async () => {
    const result = await runMaintenance(env.DB, { now: new Date("2032-07-02T04:23:00Z") });
    expect(result).toMatchObject({ usageSnapshotDay: "2032-07-01" });
    expect(typeof result.purgedUsageMarkers).toBe("number");
  });
});
