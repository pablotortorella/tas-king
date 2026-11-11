-- Aceptación de los Términos y de la Política de privacidad: una fila por persona, documento y versión (la versión es la fecha de
-- «Última actualización» de la página, en ISO). Es la prueba de la autorización (Ley 1581, arts. 9 y 12). No guarda dirección IP ni
-- agente de usuario. Se conserva tras una baja de cuenta: solo contiene un identificador opaco, una versión y una fecha.
-- Tabla nueva y aditiva: el código anterior no la conoce y sigue funcionando sin ella.
CREATE TABLE legal_acceptances (
  user_id TEXT NOT NULL REFERENCES users(id),
  document TEXT NOT NULL CHECK(document IN ('terms', 'privacy')),
  version TEXT NOT NULL CHECK(version GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  method TEXT NOT NULL CHECK(method IN ('login', 'gate')),
  PRIMARY KEY (user_id, document, version)
);
