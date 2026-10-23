ALTER TABLE invitations ADD COLUMN target_participant_id TEXT;
CREATE UNIQUE INDEX invitations_one_pending_target ON invitations(space_id, target_participant_id)
WHERE status = 'pending' AND target_participant_id IS NOT NULL;

ALTER TABLE ledger_entries ADD COLUMN note TEXT NOT NULL DEFAULT '' CHECK(length(note) <= 1000);

INSERT INTO expense_ledgers (id, space_id, default_currency)
SELECT 'ledger_' || lower(hex(randomblob(16))), s.id, 'COP'
FROM spaces s
WHERE NOT EXISTS (SELECT 1 FROM expense_ledgers l WHERE l.space_id = s.id);

INSERT INTO ledger_participants (ledger_id, id, display_name, linked_user_id)
SELECT l.id, 'participant_' || lower(hex(randomblob(16))), u.display_name, u.id
FROM expense_ledgers l
JOIN memberships m ON m.space_id = l.space_id
JOIN users u ON u.id = m.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM ledger_participants p WHERE p.ledger_id = l.id AND p.linked_user_id = u.id
);
