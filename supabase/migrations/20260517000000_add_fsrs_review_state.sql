ALTER TABLE spaced_repetition
    ADD COLUMN stability REAL,
    ADD COLUMN difficulty REAL,
    ADD COLUMN state SMALLINT CHECK (state BETWEEN 0 AND 3),
    ADD COLUMN scheduled_days INT,
    ADD COLUMN learning_steps INT,
    ADD COLUMN reps INT,
    ADD COLUMN lapses INT;

UPDATE spaced_repetition
SET scheduled_days = interval,
    reps = repetitions
WHERE scheduled_days IS NULL
   OR reps IS NULL;