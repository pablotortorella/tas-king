-- Tema de color por tablero (#10): paleta elegida por el dueño + si ya vio
-- el prompt de bienvenida. theme = NULL significa "sin asignar todavía"
-- (se renderiza como Candy Pop, la paleta oficial/default).

ALTER TABLE boards ADD COLUMN theme TEXT;
ALTER TABLE boards ADD COLUMN theme_prompt_seen INTEGER NOT NULL DEFAULT 0;
