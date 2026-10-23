import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (id, google_sub, email, display_name) VALUES ('fin_user', 'fin_sub', 'finance@example.test', 'Finance')"),
    env.DB.prepare("INSERT INTO spaces (id, name) VALUES ('fin_space_a', 'Libro A')"),
    env.DB.prepare("INSERT INTO spaces (id, name) VALUES ('fin_space_b', 'Libro B')"),
    env.DB.prepare("INSERT INTO memberships (space_id, user_id, role) VALUES ('fin_space_a', 'fin_user', 'owner')"),
    env.DB.prepare("INSERT INTO memberships (space_id, user_id, role) VALUES ('fin_space_b', 'fin_user', 'owner')"),
    env.DB.prepare("INSERT INTO expense_ledgers (id, space_id, default_currency) VALUES ('ledger_a', 'fin_space_a', 'COP')"),
    env.DB.prepare("INSERT INTO expense_ledgers (id, space_id, default_currency) VALUES ('ledger_b', 'fin_space_b', 'USD')"),
    env.DB.prepare("INSERT INTO ledger_participants (ledger_id, id, display_name, linked_user_id) VALUES ('ledger_a', 'participant_a', 'Ana', 'fin_user')"),
    env.DB.prepare("INSERT INTO ledger_participants (ledger_id, id, display_name) VALUES ('ledger_a', 'participant_b', 'Beto')"),
    env.DB.prepare("INSERT INTO ledger_participants (ledger_id, id, display_name) VALUES ('ledger_b', 'participant_other', 'Otra')"),
  ]);
});

describe("D1: fundaciones financieras", () => {
  it("aísla participantes y componentes por libro", async () => {
    await env.DB.prepare("INSERT INTO ledger_entries (ledger_id, id, entry_type, currency_code, total_minor, occurred_at, created_by_user_id) VALUES ('ledger_a', 'entry_a', 'expense', 'COP', 10000, '2026-10-20T00:00:00Z', 'fin_user')").run();
    await env.DB.prepare("INSERT INTO entry_cash_parties (ledger_id, entry_id, participant_id, direction, amount_minor) VALUES ('ledger_a', 'entry_a', 'participant_a', 'out', 10000)").run();
    await expect(env.DB.prepare("INSERT INTO entry_allocations (ledger_id, entry_id, participant_id, amount_minor) VALUES ('ledger_a', 'entry_a', 'participant_other', 10000)").run()).rejects.toThrow();
  });

  it("conserva revisiones y eventos como filas inmutables", async () => {
    await env.DB.prepare("INSERT INTO entry_revisions (ledger_id, entry_id, revision, actor_user_id, action, snapshot_json) VALUES ('ledger_a', 'entry_a', 1, 'fin_user', 'created', '{\"totalMinor\":10000}')").run();
    await env.DB.prepare("INSERT INTO ledger_events (id, ledger_id, actor_user_id, action, entity_type, entity_id) VALUES ('event_fin_1', 'ledger_a', 'fin_user', 'entry_created', 'entry', 'entry_a')").run();
    await expect(env.DB.prepare("UPDATE entry_revisions SET snapshot_json = '{}' WHERE ledger_id = 'ledger_a' AND entry_id = 'entry_a' AND revision = 1").run()).rejects.toThrow("immutable");
    await expect(env.DB.prepare("DELETE FROM ledger_events WHERE id = 'event_fin_1'").run()).rejects.toThrow("immutable");
  });

  it("impide reutilizar una clave idempotente para otra respuesta", async () => {
    const hash = "a".repeat(64);
    await env.DB.prepare("INSERT INTO idempotency_keys (ledger_id, actor_user_id, idempotency_key, request_hash, response_json) VALUES (?, 'fin_user', 'request-12345678', ?, '{}')").bind("ledger_a", hash).run();
    await expect(env.DB.prepare("INSERT INTO idempotency_keys (ledger_id, actor_user_id, idempotency_key, request_hash, response_json) VALUES (?, 'fin_user', 'request-12345678', ?, '{}')").bind("ledger_a", "b".repeat(64)).run()).rejects.toThrow();
  });

  it("crea invitaciones con vencimiento y admite el estado expired", async () => {
    await env.DB.prepare("INSERT INTO invitations (id, space_id, invitee_email, inviter_user_id) VALUES ('fin_invite', 'fin_space_a', 'invite@example.test', 'fin_user')").run();
    const invitation = await env.DB.prepare("SELECT status, expires_at > created_at AS future_expiry FROM invitations WHERE id = 'fin_invite'").first();
    expect(invitation).toEqual({ status: "pending", future_expiry: 1 });
    await env.DB.prepare("UPDATE invitations SET status = 'expired', resolved_at = CURRENT_TIMESTAMP WHERE id = 'fin_invite'").run();
  });
});
