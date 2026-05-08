DROP TRIGGER IF EXISTS update_trivia_categories_updated_at ON trivia_categories;
DROP TRIGGER IF EXISTS update_trivias_updated_at ON trivias;
DROP INDEX IF EXISTS idx_trivias_published_created_at;
DROP INDEX IF EXISTS idx_trivias_category_id;
DROP INDEX IF EXISTS idx_trivias_cefr_level;
DROP INDEX IF EXISTS idx_trivias_language_id;
DROP TABLE IF EXISTS trivias;
DROP TABLE IF EXISTS trivia_categories;
