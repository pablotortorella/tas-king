PRAGMA defer_foreign_keys = true;

CREATE TABLE invitations_v2 (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id),
  invitee_email TEXT NOT NULL,
  inviter_user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK(status IN ('pending', 'accepted', 'rejected', 'canceled', 'expired')) DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL DEFAULT (datetime('now', '+30 days')),
  resolved_at TEXT
);

INSERT INTO invitations_v2 (id, space_id, invitee_email, inviter_user_id, status, created_at, expires_at, resolved_at)
SELECT id, space_id, invitee_email, inviter_user_id, status, created_at, datetime(created_at, '+30 days'), resolved_at
FROM invitations;

DROP TABLE invitations;
ALTER TABLE invitations_v2 RENAME TO invitations;

CREATE UNIQUE INDEX invitations_one_pending_email_per_space ON invitations(space_id, invitee_email) WHERE status = 'pending';
CREATE INDEX invitations_pending_by_email ON invitations(invitee_email) WHERE status = 'pending';
CREATE INDEX invitations_pending_by_expiry ON invitations(expires_at) WHERE status = 'pending';

CREATE TABLE expense_ledgers (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL UNIQUE REFERENCES spaces(id),
  default_currency TEXT NOT NULL CHECK(length(default_currency) = 3 AND default_currency GLOB '[A-Z][A-Z][A-Z]'),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ledger_participants (
  ledger_id TEXT NOT NULL REFERENCES expense_ledgers(id),
  id TEXT NOT NULL,
  display_name TEXT NOT NULL CHECK(length(trim(display_name)) BETWEEN 1 AND 120),
  linked_user_id TEXT REFERENCES users(id),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ledger_id, id)
);
CREATE UNIQUE INDEX ledger_participants_linked_user ON ledger_participants(ledger_id, linked_user_id) WHERE linked_user_id IS NOT NULL;

CREATE TABLE ledger_entries (
  ledger_id TEXT NOT NULL REFERENCES expense_ledgers(id),
  id TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK(entry_type IN ('expense', 'income', 'transfer')),
  currency_code TEXT NOT NULL CHECK(length(currency_code) = 3 AND currency_code GLOB '[A-Z][A-Z][A-Z]'),
  total_minor INTEGER NOT NULL CHECK(total_minor > 0),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 240),
  occurred_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'voided')),
  current_revision INTEGER NOT NULL DEFAULT 1 CHECK(current_revision >= 1),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ledger_id, id)
);
CREATE INDEX ledger_entries_timeline ON ledger_entries(ledger_id, occurred_at DESC, id);
CREATE INDEX ledger_entries_active_currency ON ledger_entries(ledger_id, currency_code) WHERE status = 'active';

CREATE TABLE entry_cash_parties (
  ledger_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('out', 'in')),
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
  PRIMARY KEY (ledger_id, entry_id, participant_id, direction),
  FOREIGN KEY (ledger_id, entry_id) REFERENCES ledger_entries(ledger_id, id),
  FOREIGN KEY (ledger_id, participant_id) REFERENCES ledger_participants(ledger_id, id)
);

CREATE TABLE entry_allocations (
  ledger_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
  PRIMARY KEY (ledger_id, entry_id, participant_id),
  FOREIGN KEY (ledger_id, entry_id) REFERENCES ledger_entries(ledger_id, id),
  FOREIGN KEY (ledger_id, participant_id) REFERENCES ledger_participants(ledger_id, id)
);

CREATE TABLE entry_revisions (
  ledger_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision >= 1),
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK(action IN ('created', 'revised', 'voided')),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ledger_id, entry_id, revision),
  FOREIGN KEY (ledger_id, entry_id) REFERENCES ledger_entries(ledger_id, id)
);

CREATE TABLE ledger_events (
  id TEXT PRIMARY KEY,
  ledger_id TEXT NOT NULL REFERENCES expense_ledgers(id),
  actor_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ledger_events_timeline ON ledger_events(ledger_id, created_at, id);

CREATE TABLE idempotency_keys (
  ledger_id TEXT NOT NULL REFERENCES expense_ledgers(id),
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 16 AND 200),
  request_hash TEXT NOT NULL CHECK(length(request_hash) = 64),
  response_json TEXT NOT NULL CHECK(json_valid(response_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ledger_id, actor_user_id, idempotency_key)
);
CREATE INDEX idempotency_keys_by_age ON idempotency_keys(created_at);

CREATE TRIGGER entry_revisions_no_update
BEFORE UPDATE ON entry_revisions
BEGIN
  SELECT RAISE(ABORT, 'entry revisions are immutable');
END;

CREATE TRIGGER entry_revisions_no_delete
BEFORE DELETE ON entry_revisions
BEGIN
  SELECT RAISE(ABORT, 'entry revisions are immutable');
END;

CREATE TRIGGER ledger_events_no_update
BEFORE UPDATE ON ledger_events
BEGIN
  SELECT RAISE(ABORT, 'ledger events are immutable');
END;

CREATE TRIGGER ledger_events_no_delete
BEFORE DELETE ON ledger_events
BEGIN
  SELECT RAISE(ABORT, 'ledger events are immutable');
END;

PRAGMA defer_foreign_keys = false;
