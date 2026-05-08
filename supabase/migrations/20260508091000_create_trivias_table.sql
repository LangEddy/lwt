CREATE TABLE trivia_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
    name TEXT NOT NULL,
    icon_svg TEXT NOT NULL,
    color TEXT NOT NULL,
    bg_color TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE trivias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES trivia_categories(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    subtitle TEXT,
    content TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'plain'
        CHECK (content_type IN ('plain', 'markdown', 'html')),
    cefr_level TEXT NOT NULL
        CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
    direction TEXT NOT NULL DEFAULT 'ltr'
        CHECK (direction IN ('ltr', 'rtl')),
    is_published BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trivias_language_id ON trivias(language_id);
CREATE INDEX idx_trivias_cefr_level ON trivias(cefr_level);
CREATE INDEX idx_trivias_category_id ON trivias(category_id);
CREATE INDEX idx_trivias_published_created_at ON trivias(is_published, created_at DESC);

CREATE TRIGGER update_trivia_categories_updated_at BEFORE UPDATE ON trivia_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trivias_updated_at BEFORE UPDATE ON trivias
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
