-- Tip diario: avance de la secuencia por persona.
--
-- tip_index es un CONTADOR MONÓTONO de tips vistos, no una posición: el backend
-- lo incrementa sin saber cuántos tips hay y el frontend resuelve
-- DAILY_TIPS[tip_index % DAILY_TIPS.length]. Así el ciclado vive junto al
-- catálogo (public/tips.js) y agregar tips no obliga a tocar el backend.
--
-- tip_date es la fecha 'YYYY-MM-DD' en que se mostró por última vez.
-- Ambas NULL = todavía no vio ningún tip: empieza por el primero.

ALTER TABLE users ADD COLUMN tip_index INTEGER;
ALTER TABLE users ADD COLUMN tip_date TEXT;
