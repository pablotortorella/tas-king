-- Retira el modelo anterior de importación (un efecto por persona, sin pagador ni reparto). Antes hay que convertir los
-- lotes publicados con el modelo viejo (convertLegacyImports) o descartarlos: si queda alguna fila, esta migración se
-- detiene en la guarda y no borra nada.
CREATE TABLE legacy_import_guard (ok INTEGER NOT NULL CHECK (ok = 1));
INSERT INTO legacy_import_guard SELECT CASE WHEN EXISTS (SELECT 1 FROM splitwise_import_entries) THEN 0 ELSE 1 END;
DROP TABLE legacy_import_guard;
DROP TABLE splitwise_import_effects;
DROP TABLE splitwise_import_entries;
