DROP INDEX IF EXISTS idx_user_language_settings_target_cefr_levels;

ALTER TABLE user_language_settings
    DROP COLUMN IF EXISTS target_cefr_levels;
