-- Add unique constraint on (user_id, language_id, LOWER(word)) to prevent duplicate word entries.
-- Uses a unique index rather than a table constraint so we can index the expression LOWER(word).

-- Keep the newest row per normalized word and drop older duplicates.
DELETE FROM words w
USING words d
WHERE w.id <> d.id
    AND w.user_id = d.user_id
    AND w.language_id = d.language_id
    AND LOWER(w.word) = LOWER(d.word)
    AND (
        w.updated_at < d.updated_at
        OR (w.updated_at = d.updated_at AND w.created_at < d.created_at)
        OR (w.updated_at = d.updated_at AND w.created_at = d.created_at AND w.id < d.id)
    );

CREATE UNIQUE INDEX IF NOT EXISTS idx_words_user_language_word
    ON words (user_id, language_id, LOWER(word));
