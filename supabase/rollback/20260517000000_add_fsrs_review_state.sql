ALTER TABLE spaced_repetition
    DROP COLUMN IF EXISTS lapses,
    DROP COLUMN IF EXISTS reps,
    DROP COLUMN IF EXISTS learning_steps,
    DROP COLUMN IF EXISTS scheduled_days,
    DROP COLUMN IF EXISTS state,
    DROP COLUMN IF EXISTS difficulty,
    DROP COLUMN IF EXISTS stability;