-- Rollback for 20260504075709_init.sql
-- Drops everything created by the initial migration.

DROP TRIGGER IF EXISTS update_user_language_settings_updated_at ON user_language_settings;
DROP TRIGGER IF EXISTS update_spaced_repetition_updated_at      ON spaced_repetition;
DROP TRIGGER IF EXISTS update_examples_updated_at               ON examples;
DROP TRIGGER IF EXISTS update_words_updated_at                  ON words;
DROP TRIGGER IF EXISTS update_texts_updated_at                  ON texts;

DROP FUNCTION IF EXISTS update_updated_at_column();

DROP TABLE IF EXISTS sync_state;
DROP TABLE IF EXISTS spaced_repetition;
DROP TABLE IF EXISTS examples;
DROP TABLE IF EXISTS words;
DROP TABLE IF EXISTS texts;
DROP TABLE IF EXISTS user_language_settings;
DROP TABLE IF EXISTS languages;

-- Extension is intentionally left in place; other databases on the same
-- cluster may rely on it.
