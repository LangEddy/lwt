-- Add is_favorite to user_language_settings
ALTER TABLE user_language_settings ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT false;

-- Create index for fast lookup
CREATE INDEX idx_user_language_settings_favorite ON user_language_settings(user_id, is_favorite);
