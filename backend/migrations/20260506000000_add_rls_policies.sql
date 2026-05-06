-- Enable Row Level Security on all user-scoped tables.
-- The backend connects via the Postgres service-role / superuser connection string
-- and therefore bypasses RLS (defense-in-depth remains in Rust handler code).
-- RLS protects against direct PostgREST / SQL access outside the backend.

ALTER TABLE user_language_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE texts                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE words                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE examples                ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaced_repetition       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_state              ENABLE ROW LEVEL SECURITY;

-- user_language_settings: each user manages only their own rows
CREATE POLICY "user_language_settings: owner access"
    ON user_language_settings FOR ALL
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- texts: platform texts (user_id IS NULL) are readable by all authenticated users;
--        personal texts are owned exclusively by the creating user.
CREATE POLICY "texts: read own and platform"
    ON texts FOR SELECT
    USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "texts: insert own"
    ON texts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "texts: update own"
    ON texts FOR UPDATE
    USING      (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "texts: delete own"
    ON texts FOR DELETE
    USING (auth.uid() = user_id);

-- words: each user owns their own word records
CREATE POLICY "words: owner access"
    ON words FOR ALL
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- examples: ownership is derived through the parent word
CREATE POLICY "examples: owner access via word"
    ON examples FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM words
            WHERE words.id = examples.word_id
              AND words.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM words
            WHERE words.id = examples.word_id
              AND words.user_id = auth.uid()
        )
    );

-- spaced_repetition: ownership derived through example -> word chain
CREATE POLICY "spaced_repetition: owner access via example"
    ON spaced_repetition FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM examples
            JOIN words ON words.id = examples.word_id
            WHERE examples.id = spaced_repetition.example_id
              AND words.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM examples
            JOIN words ON words.id = examples.word_id
            WHERE examples.id = spaced_repetition.example_id
              AND words.user_id = auth.uid()
        )
    );

-- sync_state: each user manages only their own device sync records
CREATE POLICY "sync_state: owner access"
    ON sync_state FOR ALL
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
