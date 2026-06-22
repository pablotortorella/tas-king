-- Iteración 4: perfil de usuario (avatar) y autoría de comentarios.

ALTER TABLE users ADD COLUMN avatar_emoji TEXT;
ALTER TABLE users ADD COLUMN avatar_color TEXT;

ALTER TABLE comments ADD COLUMN author_email TEXT;
