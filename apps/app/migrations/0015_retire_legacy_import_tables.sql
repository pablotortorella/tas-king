-- Retira el modelo anterior de importación (un efecto por persona, sin pagador ni reparto): tablas splitwise_import_entries y
-- splitwise_import_effects. Change importacion-como-movimientos, tarea 7.2. El 2026-11-20 se contaron 0 filas en staging y producción.
-- Guarda: si todavía queda alguna fila, la migración se detiene acá y no borra nada.
CREATE TABLE legacy_import_guard (ok INTEGER NOT NULL CHECK (ok = 1));
INSERT INTO legacy_import_guard SELECT CASE WHEN EXISTS (SELECT 1 FROM splitwise_import_entries) THEN 0 ELSE 1 END;
DROP TABLE legacy_import_guard;
DROP TABLE splitwise_import_effects;
DROP TABLE splitwise_import_entries;
