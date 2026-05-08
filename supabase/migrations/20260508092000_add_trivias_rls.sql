ALTER TABLE trivia_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE trivias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trivia_categories: read all"
    ON trivia_categories FOR SELECT
    USING (true);

CREATE POLICY "trivias: read published"
    ON trivias FOR SELECT
    USING (is_published = true);
