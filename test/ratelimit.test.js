import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index.js";
import { purgeRateLimitLog } from "../src/middleware/rateLimit.js";
import { RATE_LIMIT_RETENTION_MS } from "../src/constants.js";
import { runBackup } from "../src/backup.js";

async function insertLogRow(id, ts) {
  await env.DB.prepare(
    "INSERT INTO rate_limit_log (id, ip, endpoint, ts, method) VALUES (?, '1.2.3.4', '/api/test', ?, 'GET')"
  ).bind(id, ts).run();
}

async function countRows() {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM rate_limit_log").first();
  return row.n;
}

describe("purgeRateLimitLog", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM rate_limit_log").run();
  });

  it("borra las filas más viejas que la retención y conserva las recientes", async () => {
    const now = Date.now();
    await insertLogRow("old-1", now - RATE_LIMIT_RETENTION_MS - 60_000);
    await insertLogRow("old-2", now - RATE_LIMIT_RETENTION_MS - 1_000);
    await insertLogRow("recent", now - 60_000);

    const purged = await purgeRateLimitLog(env.DB);

    expect(purged).toBe(2);
    expect(await countRows()).toBe(1);
    const left = await env.DB.prepare("SELECT id FROM rate_limit_log").first();
    expect(left.id).toBe("recent");
  });

  it("devuelve 0 sin filas viejas y es idempotente", async () => {
    await insertLogRow("recent", Date.now());

    expect(await purgeRateLimitLog(env.DB)).toBe(0);
    expect(await purgeRateLimitLog(env.DB)).toBe(0);
    expect(await countRows()).toBe(1);
  });

  it("no falla con la tabla vacía", async () => {
    expect(await purgeRateLimitLog(env.DB)).toBe(0);
  });
});

describe("backup excluye rate_limit_log", () => {
  it("el dump omite rate_limit_log pero incluye las tablas de datos", async () => {
    await insertLogRow("dump-row", Date.now());

    const result = await runBackup(env);
    expect(result.r2).toBe(true);
    expect(result.errors).toEqual([]);

    const obj = await env.BUCKET.get(`backups/${result.timestamp}.sql`);
    expect(obj).not.toBeNull();
    const sql = await obj.text();

    expect(sql).not.toContain("rate_limit_log");
    expect(sql).toContain('"users"');
    expect(sql).toContain('"cards"');
  });
});

describe("scheduled handler", () => {
  it("purga el log viejo y corre el backup en el mismo ciclo", async () => {
    await insertLogRow("very-old", Date.now() - RATE_LIMIT_RETENTION_MS - 3_600_000);

    const pending = [];
    await worker.scheduled({}, env, { waitUntil: p => pending.push(p) });
    await Promise.all(pending);

    const row = await env.DB.prepare("SELECT 1 AS x FROM rate_limit_log WHERE id = 'very-old'").first();
    expect(row).toBeNull();

    const backups = await env.BUCKET.list({ prefix: "backups/" });
    expect(backups.objects.length).toBeGreaterThan(0);
  });
});
