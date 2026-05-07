-- Rollback for 20260505120000_add_word_unique_constraint.sql
-- The DELETE in the forward migration is irreversible; this only drops the
-- index it added.

DROP INDEX IF EXISTS idx_words_user_language_word;
