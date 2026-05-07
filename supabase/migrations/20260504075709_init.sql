-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Languages (pre-defined, admin-managed)
CREATE TABLE languages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'ltr' CHECK (direction IN ('ltr', 'rtl')),
    is_platform BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User language settings
CREATE TABLE user_language_settings (
    user_id UUID NOT NULL,
    language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    tts_voice TEXT,
    dictionary_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, language_id)
);

-- Texts (user-owned or platform-wide)
CREATE TABLE texts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Words and phrases
CREATE TABLE words (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    text_id UUID REFERENCES texts(id) ON DELETE SET NULL,
    word TEXT NOT NULL,
    is_phrase BOOLEAN NOT NULL DEFAULT false,
    level SMALLINT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Examples for words
CREATE TABLE examples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    word_id UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    sentence TEXT NOT NULL,
    translation TEXT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spaced repetition state per example
CREATE TABLE spaced_repetition (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    example_id UUID NOT NULL REFERENCES examples(id) ON DELETE CASCADE,
    interval INT NOT NULL DEFAULT 1,
    repetitions INT NOT NULL DEFAULT 0,
    ease_factor REAL NOT NULL DEFAULT 2.5,
    next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (example_id)
);

-- Per-device sync tracking
CREATE TABLE sync_state (
    device_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cursor TEXT
);

-- Indexes
CREATE INDEX idx_texts_user_id ON texts(user_id);
CREATE INDEX idx_texts_language_id ON texts(language_id);
CREATE INDEX idx_words_user_id ON words(user_id);
CREATE INDEX idx_words_language_id ON words(language_id);
CREATE INDEX idx_words_level ON words(level);
CREATE INDEX idx_examples_word_id ON examples(word_id);
CREATE INDEX idx_spaced_repetition_next_review ON spaced_repetition(next_review_at);
CREATE INDEX idx_sync_state_user_id ON sync_state(user_id);

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_texts_updated_at BEFORE UPDATE ON texts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_words_updated_at BEFORE UPDATE ON words
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_examples_updated_at BEFORE UPDATE ON examples
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_spaced_repetition_updated_at BEFORE UPDATE ON spaced_repetition
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_language_settings_updated_at BEFORE UPDATE ON user_language_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
