import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";
import { app } from "../src/index.js";
import { runMaintenance } from "../src/maintenance.js";
import { createSession } from "../src/sessions.js";
import { createCsrfToken } from "../src/csrf.js";

describe("protección operativa", () => {
  it("rechaza payload declarado mayor a 16 KiB antes del handler", async () => {
    const response = await app.request("https://app.test/api/local/groups", {
      method: "POST",
      headers: { "Content-Length": "16385", "Content-Type": "application/json", "X-HomeSuite-Dev-Email": "payload@example.test" },
      body: "{}",
    }, env);
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("grande"), requestId: expect.any(String) });
  });

  it("limita OAuth por dirección antes de redirigir", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    const response = await app.request("https://app.test/auth/google", { headers: { "CF-Connecting-IP": "192.0.2.10" } }, {
      ...env,
      AUTH_RATE_LIMITER: { limit },
      REQUIRE_RATE_LIMITS: "true",
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "secret",
      SESSION_SECRET: "s".repeat(32),
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(limit).toHaveBeenCalledWith({ key: "192.0.2.10" });
  });

  it("limita mutaciones por sesión antes de tocar D1", async () => {
    const userId = "rate_user";
    await env.DB.prepare("INSERT INTO users (id, google_sub, email, display_name) VALUES (?, ?, ?, ?)").bind(userId, "rate_sub", "rate@example.test", "Rate").run();
    const secret = "r".repeat(32);
    const session = await createSession(env.DB, { userId, secret });
    const csrf = await createCsrfToken({ sessionId: session.id, secret });
    const response = await app.request("https://app.test/groups", {
      method: "POST",
      headers: {
        Cookie: `__Host-homesuite_session=${encodeURIComponent(session.token)}`,
        Origin: "https://app.test",
        "X-CSRF-Token": csrf,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "name=No+crear",
    }, { ...env, SESSION_SECRET: secret, REQUIRE_RATE_LIMITS: "true", MUTATION_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: false }) } });
    expect(response.status).toBe(429);
    const membership = await env.DB.prepare("SELECT COUNT(*) AS count FROM memberships WHERE user_id = ?").bind(userId).first();
    expect(membership.count).toBe(0);
  });
});

describe("mantenimiento programado", () => {
  it("purga sesiones antiguas y vence invitaciones sin tocar historia financiera", async () => {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id, google_sub, email, display_name) VALUES ('maint_user', 'maint_sub', 'maint@example.test', 'Maint')"),
      env.DB.prepare("INSERT INTO groups (id, name) VALUES ('maint_group', 'Maint Group')"),
      env.DB.prepare("INSERT INTO memberships (group_id, user_id, role) VALUES ('maint_group', 'maint_user', 'owner')"),
      env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES ('old_session', 'maint_user', '2026-01-01T00:00:00.000Z')"),
      env.DB.prepare("INSERT INTO invitations (id, group_id, invitee_email, inviter_user_id, expires_at) VALUES ('old_invite', 'maint_group', 'old@example.test', 'maint_user', '2026-01-01T00:00:00.000Z')"),
      env.DB.prepare("INSERT INTO expense_ledgers (id, group_id, default_currency) VALUES ('maint_ledger', 'maint_group', 'COP')"),
    ]);
    const result = await runMaintenance(env.DB, { now: new Date("2026-10-20T05:00:00.000Z") });
    expect(result).toEqual({ expiredInvitations: 1, deletedSessions: 1, deletedImportPreviews: 0, deletedPendingImports: 0, convertedLegacyBatches: 0 });
    expect(await env.DB.prepare("SELECT status FROM invitations WHERE id = 'old_invite'").first()).toEqual({ status: "expired" });
    expect(await env.DB.prepare("SELECT action FROM platform_audit_events WHERE entity_id = 'old_invite'").first()).toEqual({ action: "invitation_expired" });
    expect(await env.DB.prepare("SELECT id FROM expense_ledgers WHERE id = 'maint_ledger'").first()).toEqual({ id: "maint_ledger" });
  });
});
