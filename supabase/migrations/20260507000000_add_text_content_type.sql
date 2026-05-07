ALTER TABLE texts
    ADD COLUMN content_type TEXT NOT NULL DEFAULT 'plain'
    CHECK (content_type IN ('plain', 'markdown', 'html'));
