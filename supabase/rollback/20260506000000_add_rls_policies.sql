-- Rollback for 20260506000000_add_rls_policies.sql

DROP POLICY IF EXISTS "sync_state: owner access"                   ON sync_state;
DROP POLICY IF EXISTS "spaced_repetition: owner access via example" ON spaced_repetition;
DROP POLICY IF EXISTS "examples: owner access via word"            ON examples;
DROP POLICY IF EXISTS "words: owner access"                        ON words;
DROP POLICY IF EXISTS "texts: delete own"                          ON texts;
DROP POLICY IF EXISTS "texts: update own"                          ON texts;
DROP POLICY IF EXISTS "texts: insert own"                          ON texts;
DROP POLICY IF EXISTS "texts: read own and platform"               ON texts;
DROP POLICY IF EXISTS "user_language_settings: owner access"       ON user_language_settings;

ALTER TABLE sync_state              DISABLE ROW LEVEL SECURITY;
ALTER TABLE spaced_repetition       DISABLE ROW LEVEL SECURITY;
ALTER TABLE examples                DISABLE ROW LEVEL SECURITY;
ALTER TABLE words                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE texts                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_language_settings  DISABLE ROW LEVEL SECURITY;
