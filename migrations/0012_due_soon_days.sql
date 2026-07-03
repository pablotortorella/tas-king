-- Umbral configurable por tablero para "¡Pilas con esto!": cuántos días antes
-- del vencimiento una tarjeta pasa a considerarse urgente (sección "Por vencer").

ALTER TABLE boards ADD COLUMN due_soon_days INTEGER NOT NULL DEFAULT 3;
