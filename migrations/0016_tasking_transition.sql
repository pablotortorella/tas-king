-- Keep the old snapshot closed even if an old Worker is accidentally deployed.
CREATE TABLE tasking_origin_control(id INTEGER PRIMARY KEY CHECK(id=1),phase TEXT NOT NULL CHECK(phase IN ('live','draining','frozen','moved')) DEFAULT 'live');
INSERT INTO tasking_origin_control(id) VALUES(1);
CREATE TABLE tasking_origin_leases(id TEXT PRIMARY KEY,started_at INTEGER NOT NULL);

CREATE TRIGGER tasking_origin_freeze_cards_insert BEFORE INSERT ON cards WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_cards_update BEFORE UPDATE ON cards WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_cards_delete BEFORE DELETE ON cards WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_comments_insert BEFORE INSERT ON comments WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_comments_update BEFORE UPDATE ON comments WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_comments_delete BEFORE DELETE ON comments WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_attachments_insert BEFORE INSERT ON attachments WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_attachments_update BEFORE UPDATE ON attachments WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_attachments_delete BEFORE DELETE ON attachments WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_users_insert BEFORE INSERT ON users WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_users_update BEFORE UPDATE ON users WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_users_delete BEFORE DELETE ON users WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_boards_insert BEFORE INSERT ON boards WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_boards_update BEFORE UPDATE ON boards WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_boards_delete BEFORE DELETE ON boards WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_board_members_insert BEFORE INSERT ON board_members WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_board_members_update BEFORE UPDATE ON board_members WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_board_members_delete BEFORE DELETE ON board_members WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_allowed_emails_insert BEFORE INSERT ON allowed_emails WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_allowed_emails_update BEFORE UPDATE ON allowed_emails WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_allowed_emails_delete BEFORE DELETE ON allowed_emails WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_audit_log_insert BEFORE INSERT ON audit_log WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_audit_log_update BEFORE UPDATE ON audit_log WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_audit_log_delete BEFORE DELETE ON audit_log WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_rate_limit_log_insert BEFORE INSERT ON rate_limit_log WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_rate_limit_log_update BEFORE UPDATE ON rate_limit_log WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_rate_limit_log_delete BEFORE DELETE ON rate_limit_log WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_labels_insert BEFORE INSERT ON labels WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_labels_update BEFORE UPDATE ON labels WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_labels_delete BEFORE DELETE ON labels WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_card_labels_insert BEFORE INSERT ON card_labels WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_card_labels_update BEFORE UPDATE ON card_labels WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_card_labels_delete BEFORE DELETE ON card_labels WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_pending_access_insert BEFORE INSERT ON pending_access WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_pending_access_update BEFORE UPDATE ON pending_access WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_pending_access_delete BEFORE DELETE ON pending_access WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_checklists_insert BEFORE INSERT ON checklists WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_checklists_update BEFORE UPDATE ON checklists WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_checklists_delete BEFORE DELETE ON checklists WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_checklist_items_insert BEFORE INSERT ON checklist_items WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_checklist_items_update BEFORE UPDATE ON checklist_items WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_checklist_items_delete BEFORE DELETE ON checklist_items WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_goals_insert BEFORE INSERT ON goals WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_goals_update BEFORE UPDATE ON goals WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_goals_delete BEFORE DELETE ON goals WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_card_goals_insert BEFORE INSERT ON card_goals WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_card_goals_update BEFORE UPDATE ON card_goals WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_card_goals_delete BEFORE DELETE ON card_goals WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_columns_insert BEFORE INSERT ON columns WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_columns_update BEFORE UPDATE ON columns WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;

CREATE TRIGGER tasking_origin_freeze_columns_delete BEFORE DELETE ON columns WHEN (SELECT phase FROM tasking_origin_control WHERE id=1) IN ('frozen','moved') BEGIN SELECT RAISE(ABORT,'TasKing migrated: origin is read-only'); END;
