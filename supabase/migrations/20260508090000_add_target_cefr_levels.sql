ALTER TABLE user_language_settings
    ADD COLUMN target_cefr_levels TEXT[] NOT NULL DEFAULT '{}'
    CHECK (
        target_cefr_levels <@ ARRAY['A1', 'A2', 'B1', 'B2', 'C1', 'C2']::TEXT[]
    );

CREATE INDEX idx_user_language_settings_target_cefr_levels
    ON user_language_settings USING GIN (target_cefr_levels);
