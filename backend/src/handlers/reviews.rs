use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{Duration, Utc};
use fsrs::{DEFAULT_PARAMETERS, FSRS, ItemState, MemoryState};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{auth::Claims, error::AppError, state::AppState};

const DESIRED_RETENTION: f32 = 0.9;
const REVIEW_STATE_NEW: i16 = 0;
const REVIEW_STATE_LEARNING: i16 = 1;
const REVIEW_STATE_REVIEW: i16 = 2;
const REVIEW_STATE_RELEARNING: i16 = 3;

#[derive(Debug, FromRow, Serialize)]
pub struct SpacedRepetition {
    pub id: Uuid,
    pub example_id: Uuid,
    pub interval: i32,
    pub repetitions: i32,
    pub ease_factor: f32,
    pub next_review_at: chrono::DateTime<chrono::Utc>,
    pub last_reviewed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub stability: Option<f32>,
    pub difficulty: Option<f32>,
    pub state: Option<i16>,
    pub scheduled_days: Option<i32>,
    pub learning_steps: Option<i32>,
    pub reps: Option<i32>,
    pub lapses: Option<i32>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Default, Clone)]
pub struct ReviewMetadata {
    pub next_review_at: Option<chrono::DateTime<chrono::Utc>>,
    pub last_reviewed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub stability: Option<f32>,
    pub difficulty: Option<f32>,
    pub state: Option<i16>,
    pub scheduled_days: Option<i32>,
    pub learning_steps: Option<i32>,
    pub reps: Option<i32>,
    pub lapses: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct DueReview {
    pub sr_id: Option<Uuid>,
    pub example_id: Uuid,
    pub sentence: String,
    pub translation: Option<String>,
    pub example_note: Option<String>,
    pub word_id: Uuid,
    pub word: String,
    pub word_level: i16,
    pub word_note: Option<String>,
    pub language_code: String,
    pub language_direction: String,
    #[serde(flatten)]
    pub review: ReviewMetadata,
}

#[derive(Debug, FromRow)]
struct DueReviewRow {
    pub sr_id: Option<Uuid>,
    pub example_id: Uuid,
    pub sentence: String,
    pub translation: Option<String>,
    pub example_note: Option<String>,
    pub word_id: Uuid,
    pub word: String,
    pub word_level: i16,
    pub word_note: Option<String>,
    pub language_code: String,
    pub language_direction: String,
    pub interval: Option<i32>,
    pub repetitions: Option<i32>,
    pub ease_factor: Option<f32>,
    pub next_review_at: Option<chrono::DateTime<chrono::Utc>>,
    pub last_reviewed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub stability: Option<f32>,
    pub difficulty: Option<f32>,
    pub state: Option<i16>,
    pub scheduled_days: Option<i32>,
    pub learning_steps: Option<i32>,
    pub reps: Option<i32>,
    pub lapses: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct AnswerRequest {
    pub rating: i32, // 0=again, 1=hard, 2=good, 3=easy
    pub answered_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize)]
pub struct AnswerResponse {
    pub review: ReviewMetadata,
}

#[derive(Debug, Clone)]
struct ReviewMetadataSource {
    interval: Option<i32>,
    repetitions: Option<i32>,
    ease_factor: Option<f32>,
    next_review_at: Option<chrono::DateTime<chrono::Utc>>,
    last_reviewed_at: Option<chrono::DateTime<chrono::Utc>>,
    stability: Option<f32>,
    difficulty: Option<f32>,
    state: Option<i16>,
    scheduled_days: Option<i32>,
    learning_steps: Option<i32>,
    reps: Option<i32>,
    lapses: Option<i32>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct FsrsReviewState {
    memory_state: Option<MemoryState>,
    state: i16,
    scheduled_days: i32,
    learning_steps: i32,
    reps: i32,
    lapses: i32,
    last_reviewed_at: Option<chrono::DateTime<chrono::Utc>>,
    legacy_interval: i32,
    legacy_repetitions: i32,
    legacy_ease_factor: f32,
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct FsrsReviewUpdate {
    memory_state: MemoryState,
    state: i16,
    scheduled_days: i32,
    learning_steps: i32,
    reps: i32,
    lapses: i32,
    next_review_at: chrono::DateTime<chrono::Utc>,
    legacy_interval: i32,
    legacy_repetitions: i32,
    legacy_ease_factor: f32,
}

fn fsrs_model() -> Result<FSRS, AppError> {
    FSRS::new(Some(&DEFAULT_PARAMETERS))
        .map_err(|err| AppError::Internal(format!("failed to initialize FSRS scheduler: {err}")))
}

fn review_metadata_source_from_spaced_repetition(sr: &SpacedRepetition) -> ReviewMetadataSource {
    ReviewMetadataSource {
        interval: Some(sr.interval),
        repetitions: Some(sr.repetitions),
        ease_factor: Some(sr.ease_factor),
        next_review_at: Some(sr.next_review_at),
        last_reviewed_at: sr.last_reviewed_at,
        stability: sr.stability,
        difficulty: sr.difficulty,
        state: sr.state,
        scheduled_days: sr.scheduled_days,
        learning_steps: sr.learning_steps,
        reps: sr.reps,
        lapses: sr.lapses,
    }
}

fn review_metadata_source_from_due_row(row: &DueReviewRow) -> ReviewMetadataSource {
    ReviewMetadataSource {
        interval: row.interval,
        repetitions: row.repetitions,
        ease_factor: row.ease_factor,
        next_review_at: row.next_review_at,
        last_reviewed_at: row.last_reviewed_at,
        stability: row.stability,
        difficulty: row.difficulty,
        state: row.state,
        scheduled_days: row.scheduled_days,
        learning_steps: row.learning_steps,
        reps: row.reps,
        lapses: row.lapses,
    }
}

fn has_review_metadata(source: &ReviewMetadataSource) -> bool {
    source.interval.is_some()
        || source.repetitions.is_some()
        || source.ease_factor.is_some()
        || source.next_review_at.is_some()
        || source.last_reviewed_at.is_some()
        || source.stability.is_some()
        || source.difficulty.is_some()
        || source.state.is_some()
        || source.scheduled_days.is_some()
        || source.learning_steps.is_some()
        || source.reps.is_some()
        || source.lapses.is_some()
}

fn normalize_review_metadata(source: &ReviewMetadataSource) -> Result<ReviewMetadata, AppError> {
    if !has_review_metadata(source) {
        return Ok(ReviewMetadata::default());
    }

    let derived_memory_state = if source.stability.is_some() && source.difficulty.is_some() {
        None
    } else {
        match (source.ease_factor, source.interval) {
            (Some(ease_factor), Some(interval)) => Some(
                fsrs_model()?
                    .memory_state_from_sm2(
                        ease_factor.max(1.3),
                        interval.max(1) as f32,
                        DESIRED_RETENTION,
                    )
                    .map_err(|err| {
                        AppError::Internal(format!(
                            "failed to derive FSRS metadata from SM-2 values: {err}"
                        ))
                    })?,
            ),
            _ => None,
        }
    };

    let reps = source
        .reps
        .or(source.repetitions.map(|repetitions| repetitions.max(0)));
    let state = source.state.or_else(|| {
        reps.map(|reps| {
            if reps > 0 {
                REVIEW_STATE_REVIEW
            } else {
                REVIEW_STATE_LEARNING
            }
        })
    });

    Ok(ReviewMetadata {
        next_review_at: source.next_review_at,
        last_reviewed_at: source.last_reviewed_at,
        stability: source
            .stability
            .or(derived_memory_state.as_ref().map(|memory| memory.stability)),
        difficulty: source.difficulty.or(derived_memory_state
            .as_ref()
            .map(|memory| memory.difficulty)),
        state,
        scheduled_days: source
            .scheduled_days
            .or(source.interval.map(|interval| interval.max(1))),
        learning_steps: source.learning_steps.or(Some(0)),
        reps,
        lapses: source.lapses.or(Some(0)),
    })
}

impl TryFrom<DueReviewRow> for DueReview {
    type Error = AppError;

    fn try_from(row: DueReviewRow) -> Result<Self, Self::Error> {
        let review = normalize_review_metadata(&review_metadata_source_from_due_row(&row))?;

        Ok(Self {
            sr_id: row.sr_id,
            example_id: row.example_id,
            sentence: row.sentence,
            translation: row.translation,
            example_note: row.example_note,
            word_id: row.word_id,
            word: row.word,
            word_level: row.word_level,
            word_note: row.word_note,
            language_code: row.language_code,
            language_direction: row.language_direction,
            review,
        })
    }
}

fn review_state_from_existing(
    existing: Option<&SpacedRepetition>,
) -> Result<FsrsReviewState, AppError> {
    let Some(existing) = existing else {
        return Ok(FsrsReviewState {
            memory_state: None,
            state: REVIEW_STATE_NEW,
            scheduled_days: 0,
            learning_steps: 0,
            reps: 0,
            lapses: 0,
            last_reviewed_at: None,
            legacy_interval: 1,
            legacy_repetitions: 0,
            legacy_ease_factor: 2.5,
        });
    };

    let memory_state = match (existing.stability, existing.difficulty) {
        (Some(stability), Some(difficulty)) => Some(MemoryState {
            stability,
            difficulty,
        }),
        _ => Some(
            fsrs_model()?
                .memory_state_from_sm2(
                    existing.ease_factor.max(1.3),
                    existing.interval.max(1) as f32,
                    DESIRED_RETENTION,
                )
                .map_err(|err| {
                    AppError::Internal(format!(
                        "failed to derive FSRS state from SM-2 values for example {}: {err}",
                        existing.example_id
                    ))
                })?,
        ),
    };

    let state = existing.state.unwrap_or_else(|| {
        if existing.repetitions > 0 {
            REVIEW_STATE_REVIEW
        } else {
            REVIEW_STATE_LEARNING
        }
    });

    Ok(FsrsReviewState {
        memory_state,
        state,
        scheduled_days: existing.scheduled_days.unwrap_or(existing.interval.max(1)),
        learning_steps: existing.learning_steps.unwrap_or(0),
        reps: existing.reps.unwrap_or(existing.repetitions.max(0)),
        lapses: existing.lapses.unwrap_or(0),
        last_reviewed_at: existing.last_reviewed_at,
        legacy_interval: existing.interval.max(1),
        legacy_repetitions: existing.repetitions.max(0),
        legacy_ease_factor: existing.ease_factor.max(1.3),
    })
}

fn elapsed_days_since(
    last_reviewed_at: Option<chrono::DateTime<chrono::Utc>>,
    now: chrono::DateTime<chrono::Utc>,
) -> u32 {
    last_reviewed_at
        .map(|last_reviewed_at| (now - last_reviewed_at).num_days().max(0) as u32)
        .unwrap_or(0)
}

fn item_state_for_rating(next_states: &fsrs::NextStates, rating: i32) -> ItemState {
    match rating {
        0 => next_states.again.clone(),
        1 => next_states.hard.clone(),
        2 => next_states.good.clone(),
        3 => next_states.easy.clone(),
        _ => next_states.good.clone(),
    }
}

fn duration_from_interval(interval_days: f32) -> Duration {
    let seconds = (interval_days.max(0.0) as f64 * 86_400.0).round() as i64;
    Duration::seconds(seconds.max(60))
}

fn derive_review_state(previous_state: i16, rating: i32, interval_days: f32) -> i16 {
    if rating == 0
        && matches!(
            previous_state,
            REVIEW_STATE_REVIEW | REVIEW_STATE_RELEARNING
        )
    {
        REVIEW_STATE_RELEARNING
    } else if interval_days >= 1.0 {
        REVIEW_STATE_REVIEW
    } else {
        REVIEW_STATE_LEARNING
    }
}

fn next_fsrs_state(
    current: FsrsReviewState,
    rating: i32,
    now: chrono::DateTime<chrono::Utc>,
) -> Result<FsrsReviewUpdate, AppError> {
    let days_elapsed = elapsed_days_since(current.last_reviewed_at, now);
    let next_states = fsrs_model()?
        .next_states(current.memory_state, DESIRED_RETENTION, days_elapsed)
        .map_err(|err| AppError::Internal(format!("failed to schedule next FSRS state: {err}")))?;
    let next_state = item_state_for_rating(&next_states, rating);
    let state = derive_review_state(current.state, rating, next_state.interval);
    let scheduled_days = next_state.interval.round().max(1.0) as i32;
    let learning_steps = if state == REVIEW_STATE_REVIEW {
        0
    } else if state == current.state {
        current.learning_steps + 1
    } else {
        1
    };
    let reps = current.reps + 1;
    let lapses = current.lapses + i32::from(rating == 0);
    let compat_ease_factor = if current.scheduled_days > 0 {
        (next_state.memory.stability / current.scheduled_days.max(1) as f32).clamp(1.3, 10.0)
    } else {
        current.legacy_ease_factor.max(1.3)
    };

    Ok(FsrsReviewUpdate {
        memory_state: next_state.memory,
        state,
        scheduled_days,
        learning_steps,
        reps,
        lapses,
        next_review_at: now + duration_from_interval(next_state.interval),
        legacy_interval: scheduled_days,
        legacy_repetitions: reps,
        legacy_ease_factor: compat_ease_factor,
    })
}

pub async fn list_due(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DueReview>>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let review_rows = sqlx::query_as::<_, DueReviewRow>(
        r#"
        SELECT
            sr.id as sr_id,
            e.id as example_id,
            e.sentence,
            e.translation,
            e.note as example_note,
            w.id as word_id,
            w.word,
            w.level as word_level,
            w.note as word_note,
            l.code as language_code,
            l.direction as language_direction,
            sr.interval,
            sr.repetitions,
            sr.ease_factor,
            sr.next_review_at,
            sr.last_reviewed_at,
            sr.stability,
            sr.difficulty,
            sr.state,
            sr.scheduled_days,
            sr.learning_steps,
            sr.reps,
            sr.lapses
        FROM examples e
        JOIN words w ON e.word_id = w.id
        JOIN languages l ON w.language_id = l.id
        LEFT JOIN spaced_repetition sr ON sr.example_id = e.id
        WHERE w.user_id = $1
          AND (
              sr.next_review_at IS NULL
              OR sr.next_review_at <= NOW()
          )
        ORDER BY sr.next_review_at ASC NULLS FIRST, e.created_at ASC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await?;

    let reviews = review_rows
        .into_iter()
        .map(DueReview::try_from)
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Json(reviews))
}

pub async fn submit_answer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(example_id): Path<Uuid>,
    Json(body): Json<AnswerRequest>,
) -> Result<Json<AnswerResponse>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    if !(0..=3).contains(&body.rating) {
        return Err(AppError::Validation("rating must be 0, 1, 2, or 3".into()));
    }

    let server_now = Utc::now();
    let now = body.answered_at.unwrap_or(server_now);
    if now > server_now + Duration::minutes(5) {
        return Err(AppError::Validation(
            "answered_at cannot be in the future".into(),
        ));
    }

    // Verify example ownership
    let word_owner: Option<(Uuid,)> = sqlx::query_as(
        "SELECT w.user_id FROM examples e JOIN words w ON e.word_id = w.id WHERE e.id = $1",
    )
    .bind(example_id)
    .fetch_optional(&state.pool)
    .await?;

    match word_owner {
        Some((owner_id,)) if owner_id == user_id => {}
        _ => return Err(AppError::Forbidden),
    }

    // Get existing SR record or default values
    let existing: Option<SpacedRepetition> = sqlx::query_as::<_, SpacedRepetition>(
        "SELECT id, example_id, interval, repetitions, ease_factor, next_review_at, last_reviewed_at, stability, difficulty, state, scheduled_days, learning_steps, reps, lapses, created_at, updated_at FROM spaced_repetition WHERE example_id = $1"
    )
    .bind(example_id)
    .fetch_optional(&state.pool)
    .await?;

    let current_state = review_state_from_existing(existing.as_ref())?;
    let next_state = next_fsrs_state(current_state, body.rating, now)?;

    let sr = if let Some(existing_sr) = existing {
        sqlx::query_as::<_, SpacedRepetition>(
            "UPDATE spaced_repetition SET interval = $1, repetitions = $2, ease_factor = $3, next_review_at = $4, last_reviewed_at = $5, stability = $6, difficulty = $7, state = $8, scheduled_days = $9, learning_steps = $10, reps = $11, lapses = $12, updated_at = $5 WHERE id = $13 RETURNING id, example_id, interval, repetitions, ease_factor, next_review_at, last_reviewed_at, stability, difficulty, state, scheduled_days, learning_steps, reps, lapses, created_at, updated_at"
        )
        .bind(next_state.legacy_interval)
        .bind(next_state.legacy_repetitions)
        .bind(next_state.legacy_ease_factor)
        .bind(next_state.next_review_at)
        .bind(now)
        .bind(next_state.memory_state.stability)
        .bind(next_state.memory_state.difficulty)
        .bind(next_state.state)
        .bind(next_state.scheduled_days)
        .bind(next_state.learning_steps)
        .bind(next_state.reps)
        .bind(next_state.lapses)
        .bind(existing_sr.id)
        .fetch_one(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, SpacedRepetition>(
            "INSERT INTO spaced_repetition (example_id, interval, repetitions, ease_factor, next_review_at, last_reviewed_at, stability, difficulty, state, scheduled_days, learning_steps, reps, lapses) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id, example_id, interval, repetitions, ease_factor, next_review_at, last_reviewed_at, stability, difficulty, state, scheduled_days, learning_steps, reps, lapses, created_at, updated_at"
        )
        .bind(example_id)
        .bind(next_state.legacy_interval)
        .bind(next_state.legacy_repetitions)
        .bind(next_state.legacy_ease_factor)
        .bind(next_state.next_review_at)
        .bind(now)
        .bind(next_state.memory_state.stability)
        .bind(next_state.memory_state.difficulty)
        .bind(next_state.state)
        .bind(next_state.scheduled_days)
        .bind(next_state.learning_steps)
        .bind(next_state.reps)
        .bind(next_state.lapses)
        .fetch_one(&state.pool)
        .await?
    };

    Ok(Json(AnswerResponse {
        review: normalize_review_metadata(&review_metadata_source_from_spaced_repetition(&sr))?,
    }))
}

#[cfg(test)]
mod tests {
    use super::{
        DESIRED_RETENTION, REVIEW_STATE_LEARNING, REVIEW_STATE_NEW, REVIEW_STATE_RELEARNING,
        REVIEW_STATE_REVIEW, SpacedRepetition, fsrs_model, next_fsrs_state,
        review_state_from_existing,
    };
    use chrono::{Duration, Utc};
    use uuid::Uuid;

    #[test]
    fn fsrs_new_cards_start_without_memory_state() {
        let state = review_state_from_existing(None).unwrap();
        assert_eq!(state.state, REVIEW_STATE_NEW);
        assert!(state.memory_state.is_none());
        assert_eq!(state.reps, 0);
        assert_eq!(state.lapses, 0);
    }

    #[test]
    fn fsrs_legacy_sm2_rows_are_migrated_to_memory_state() {
        let now = Utc::now();
        let sr = SpacedRepetition {
            id: Uuid::new_v4(),
            example_id: Uuid::new_v4(),
            interval: 10,
            repetitions: 4,
            ease_factor: 2.5,
            next_review_at: now,
            last_reviewed_at: Some(now - Duration::days(10)),
            stability: None,
            difficulty: None,
            state: None,
            scheduled_days: None,
            learning_steps: None,
            reps: None,
            lapses: None,
            created_at: now,
            updated_at: now,
        };

        let state = review_state_from_existing(Some(&sr)).unwrap();
        let expected = fsrs_model()
            .unwrap()
            .memory_state_from_sm2(2.5, 10.0, DESIRED_RETENTION)
            .unwrap();

        assert_eq!(state.state, REVIEW_STATE_REVIEW);
        assert_eq!(state.scheduled_days, 10);
        assert_eq!(state.reps, 4);
        assert_eq!(state.memory_state, Some(expected));
    }

    #[test]
    fn fsrs_again_keeps_new_cards_in_learning() {
        let now = Utc::now();
        let current = review_state_from_existing(None).unwrap();

        let update = next_fsrs_state(current, 0, now).unwrap();

        assert_eq!(update.state, REVIEW_STATE_LEARNING);
        assert_eq!(update.reps, 1);
        assert_eq!(update.lapses, 1);
        assert!(update.next_review_at > now);
        assert!(update.next_review_at < now + Duration::days(1));
        assert!(update.memory_state.stability.is_finite());
        assert!(update.memory_state.difficulty.is_finite());
    }

    #[test]
    fn fsrs_again_on_review_cards_moves_them_to_relearning() {
        let now = Utc::now();
        let sr = SpacedRepetition {
            id: Uuid::new_v4(),
            example_id: Uuid::new_v4(),
            interval: 15,
            repetitions: 5,
            ease_factor: 2.5,
            next_review_at: now,
            last_reviewed_at: Some(now - Duration::days(15)),
            stability: Some(15.0),
            difficulty: Some(6.5),
            state: Some(REVIEW_STATE_REVIEW),
            scheduled_days: Some(15),
            learning_steps: Some(0),
            reps: Some(5),
            lapses: Some(1),
            created_at: now,
            updated_at: now,
        };

        let current = review_state_from_existing(Some(&sr)).unwrap();
        let update = next_fsrs_state(current, 0, now).unwrap();

        assert_eq!(update.state, REVIEW_STATE_RELEARNING);
        assert_eq!(update.reps, 6);
        assert_eq!(update.lapses, 2);
        assert!(update.next_review_at > now);
        assert!(update.memory_state.stability.is_finite());
        assert!(update.memory_state.difficulty.is_finite());
    }
}
