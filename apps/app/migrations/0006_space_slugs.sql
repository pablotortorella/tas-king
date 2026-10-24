ALTER TABLE spaces ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX spaces_slug_unique ON spaces(slug) WHERE slug IS NOT NULL;
