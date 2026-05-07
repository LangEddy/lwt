-- Seed pre-defined languages
INSERT INTO languages (code, name, direction, is_platform) VALUES
  ('en', 'English', 'ltr', true),
  ('de', 'German', 'ltr', true),
  ('fr', 'French', 'ltr', true),
  ('es', 'Spanish', 'ltr', true),
  ('it', 'Italian', 'ltr', true),
  ('pt', 'Portuguese', 'ltr', true),
  ('nl', 'Dutch', 'ltr', true),
  ('ru', 'Russian', 'ltr', true),
  ('pl', 'Polish', 'ltr', true),
  ('ar', 'Arabic', 'rtl', true),
  ('he', 'Hebrew', 'rtl', true),
  ('ja', 'Japanese', 'ltr', true),
  ('zh', 'Chinese', 'ltr', true),
  ('ko', 'Korean', 'ltr', true),
  ('la', 'Latin', 'ltr', true)
ON CONFLICT (code) DO NOTHING;
