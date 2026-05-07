-- Rollback for 20260504110000_add_language_favorite.sql

DROP INDEX IF EXISTS idx_user_language_settings_favorite;
ALTER TABLE user_language_settings DROP COLUMN IF EXISTS is_favorite;
