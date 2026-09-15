-- Revisión persistente: incluye borrados y recursos relacionados sin depender
-- de MAX(updated_at). Los triggers se ejecutan en la transacción de la escritura.
-- Aplicar ANTES de publicar el Worker que consulta sync_version.
ALTER TABLE boards ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 0;

-- Mantener la escala anterior permite seguir usando clientes abiertos con `>`.
UPDATE boards SET sync_version = COALESCE(
  (SELECT MAX(updated_at) FROM cards WHERE board_id = boards.id), 0
);

CREATE TRIGGER cards_sync_insert AFTER INSERT ON cards BEGIN
  UPDATE boards SET sync_version = MAX(sync_version + 1, NEW.updated_at)
    WHERE id = NEW.board_id;
END;
CREATE TRIGGER cards_sync_update AFTER UPDATE ON cards BEGIN
  UPDATE boards SET sync_version = MAX(sync_version + 1, NEW.updated_at)
    WHERE id IN (OLD.board_id, NEW.board_id);
END;
CREATE TRIGGER cards_sync_delete AFTER DELETE ON cards BEGIN
  UPDATE boards SET sync_version = sync_version + 1 WHERE id = OLD.board_id;
END;

CREATE TRIGGER comments_sync_insert AFTER INSERT ON comments BEGIN
  UPDATE boards SET sync_version = sync_version + 1
    WHERE id = (SELECT board_id FROM cards WHERE id = NEW.card_id);
END;
CREATE TRIGGER comments_sync_update AFTER UPDATE ON comments BEGIN
  UPDATE boards SET sync_version = sync_version + 1
    WHERE id IN (SELECT board_id FROM cards WHERE id IN (OLD.card_id, NEW.card_id));
END;
CREATE TRIGGER comments_sync_delete AFTER DELETE ON comments BEGIN
  UPDATE boards SET sync_version = sync_version + 1
    WHERE id = (SELECT board_id FROM cards WHERE id = OLD.card_id);
END;

CREATE TRIGGER checklists_sync_insert AFTER INSERT ON checklists BEGIN
  UPDATE boards SET sync_version = sync_version + 1
    WHERE id = (SELECT board_id FROM cards WHERE id = NEW.card_id);
END;
CREATE TRIGGER checklists_sync_update AFTER UPDATE ON checklists BEGIN
  UPDATE boards SET sync_version = sync_version + 1
    WHERE id IN (SELECT board_id FROM cards WHERE id IN (OLD.card_id, NEW.card_id));
END;
CREATE TRIGGER checklists_sync_delete AFTER DELETE ON checklists BEGIN
  UPDATE boards SET sync_version = sync_version + 1
    WHERE id = (SELECT board_id FROM cards WHERE id = OLD.card_id);
END;

CREATE TRIGGER checklist_items_sync_insert AFTER INSERT ON checklist_items BEGIN
  UPDATE boards SET sync_version = sync_version + 1 WHERE id = (
    SELECT c.board_id FROM cards c JOIN checklists cl ON cl.card_id = c.id
    WHERE cl.id = NEW.checklist_id
  );
END;
CREATE TRIGGER checklist_items_sync_update AFTER UPDATE ON checklist_items BEGIN
  UPDATE boards SET sync_version = sync_version + 1 WHERE id IN (
    SELECT c.board_id FROM cards c JOIN checklists cl ON cl.card_id = c.id
    WHERE cl.id IN (OLD.checklist_id, NEW.checklist_id)
  );
END;
CREATE TRIGGER checklist_items_sync_delete AFTER DELETE ON checklist_items BEGIN
  UPDATE boards SET sync_version = sync_version + 1 WHERE id = (
    SELECT c.board_id FROM cards c JOIN checklists cl ON cl.card_id = c.id
    WHERE cl.id = OLD.checklist_id
  );
END;
