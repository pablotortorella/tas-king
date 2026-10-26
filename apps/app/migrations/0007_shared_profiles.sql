CREATE TABLE user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  name_source TEXT NOT NULL DEFAULT 'custom' CHECK(name_source IN ('google', 'custom')),
  google_display_name TEXT,
  custom_display_name TEXT,
  google_picture_url TEXT,
  avatar_mode TEXT NOT NULL DEFAULT 'google' CHECK(avatar_mode IN ('google', 'emoji', 'initial')),
  avatar_emoji TEXT,
  avatar_color TEXT,
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
  last_mutation_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(name_source <> 'custom' OR custom_display_name IS NOT NULL),
  CHECK(avatar_mode <> 'emoji' OR avatar_emoji IS NOT NULL)
);

-- The origin of an existing display name is unknown. Preserve it until the
-- person explicitly chooses to use the Google name.
INSERT INTO user_profiles (user_id, name_source, custom_display_name)
SELECT id, 'custom', display_name FROM users;

-- Nullable additions keep inserts from the preceding Worker compatible.
ALTER TABLE memberships ADD COLUMN nickname TEXT;
ALTER TABLE memberships ADD COLUMN presentation_revision INTEGER NOT NULL DEFAULT 0 CHECK(presentation_revision >= 0);
ALTER TABLE memberships ADD COLUMN membership_generation TEXT;
ALTER TABLE memberships ADD COLUMN last_presentation_mutation_id TEXT;
