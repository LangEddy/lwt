DROP POLICY IF EXISTS "trivia_categories: read all" ON trivia_categories;
DROP POLICY IF EXISTS "trivias: read published" ON trivias;

ALTER TABLE trivia_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE trivias DISABLE ROW LEVEL SECURITY;
