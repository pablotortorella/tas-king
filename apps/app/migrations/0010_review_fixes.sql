-- Categorías genéricas: la que usa Splitwise («General») y la que se ofrece para «sin clasificar». Un movimiento con una
-- categoría genérica cuenta como pendiente en «Clasificar rápido». Es una marca explícita, no un nombre de grupo mágico.
ALTER TABLE ledger_categories ADD COLUMN generic INTEGER NOT NULL DEFAULT 0 CHECK(generic IN (0, 1));
UPDATE ledger_categories SET generic = 1 WHERE name_key IN ('general', 'sin categoria');
INSERT OR IGNORE INTO ledger_categories (ledger_id, id, name, name_key, group_name, group_key, icon, position, generic)
SELECT l.id, 'category_' || lower(hex(randomblob(12))), 'General', 'general', 'Sin categoría', 'sin categoria', 'tag',
       COALESCE((SELECT MAX(position) FROM ledger_categories c WHERE c.ledger_id = l.id), 0) + 1, 1
FROM expense_ledgers l
WHERE EXISTS (SELECT 1 FROM ledger_categories c WHERE c.ledger_id = l.id);

-- La clave de idempotencia de una recategorización identifica una solicitud concreta: otra carga útil con la misma clave se rechaza.
ALTER TABLE recategorization_batches ADD COLUMN request_hash TEXT;

-- Una vista previa confirmada recuerda su lote, así repetir la confirmación devuelve el mismo lote en lugar de un error.
ALTER TABLE splitwise_import_previews ADD COLUMN batch_id TEXT;
