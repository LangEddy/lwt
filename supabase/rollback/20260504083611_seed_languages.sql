-- Rollback for 20260504083611_seed_languages.sql
-- Removes seeded platform languages. Will fail if user data references them
-- (FKs cascade-delete user_language_settings/texts/words tied to these
-- languages, so review carefully before invoking in production).

DELETE FROM languages
WHERE is_platform = true
  AND code IN (
    'en','de','fr','es','it','pt','nl','ru','pl',
    'ar','he','ja','zh','ko','la'
  );
