ALTER TABLE groups ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX groups_slug_unique ON groups(slug) WHERE slug IS NOT NULL;
