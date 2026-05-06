use axum::{
    extract::{Path, State},
    Extension, Json,
};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{auth::Claims, error::AppError, state::AppState};

#[derive(Debug, FromRow, Serialize)]
pub struct SpacedRepetition {
    pub id: Uuid,
    pub example_id: Uuid,
    pub interval: i32,
    pub repetitions: i32,
    pub ease_factor: f32,
    pub next_review_at: chrono::DateTime<chrono::Utc>,
    pub last_reviewed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, FromRow, Serialize)]
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
    pub interval: Option<i32>,
    pub repetitions: Option<i32>,
    pub ease_factor: Option<f32>,
}

#[derive(Debug, Deserialize)]
pub struct AnswerRequest {
    pub rating: i32, // 0=again, 1=hard, 2=good, 3=easy
}

#[derive(Debug, Serialize)]
pub struct AnswerResponse {
    pub sr: SpacedRepetition,
    pub interval: i32,
    pub repetitions: i32,
    pub ease_factor: f32,
}

/// SM-2 algorithm.
/// Rating: 0=again, 1=hard, 2=good, 3=easy
/// Maps to SM-2 quality: 0→1, 1→3, 2→4, 3→5
fn sm2(interval: i32, repetitions: i32, ease_factor: f32, rating: i32) -> (i32, i32, f32) {
    let q = match rating {
        0 => 1, // Again
        1 => 3, // Hard
        2 => 4, // Good
        3 => 5, // Easy
        _ => 4,
    };

    // Update ease factor using SM-2 formula
    let new_ef = ease_factor + (0.1 - (5 - q) as f32 * (0.08 + (5 - q) as f32 * 0.02));
    let new_ef = new_ef.max(1.3);

    let (new_interval, new_repetitions) = if q < 3 {
        // Failed: reset to 1 day
        (1, 0)
    } else {
        let new_interval = if repetitions == 0 {
            1
        } else if repetitions == 1 {
            6
        } else {
            (interval as f32 * ease_factor).round() as i32
        };
        (new_interval, repetitions + 1)
    };

    (new_interval, new_repetitions, new_ef)
}

pub async fn list_due(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DueReview>>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let reviews = sqlx::query_as::<_, DueReview>(
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
            sr.ease_factor
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
        "#
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await?;

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

    // Verify example ownership
    let word_owner: Option<(Uuid,)> = sqlx::query_as(
        "SELECT w.user_id FROM examples e JOIN words w ON e.word_id = w.id WHERE e.id = $1"
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
        "SELECT id, example_id, interval, repetitions, ease_factor, next_review_at, last_reviewed_at, created_at, updated_at FROM spaced_repetition WHERE example_id = $1"
    )
    .bind(example_id)
    .fetch_optional(&state.pool)
    .await?;

    let (old_interval, old_repetitions, old_ef) = match &existing {
        Some(sr) => (sr.interval, sr.repetitions, sr.ease_factor),
        None => (1, 0, 2.5),
    };

    let (new_interval, new_repetitions, new_ef) =
        sm2(old_interval, old_repetitions, old_ef, body.rating);

    // Again (rating 0) gets a short 10-minute delay so it reappears in the
    // same session. Everything else uses the SM-2 interval in days.
    let next_review_at = if body.rating == 0 {
        Utc::now() + Duration::minutes(10)
    } else {
        Utc::now() + Duration::days(new_interval as i64)
    };

    let sr = if let Some(existing_sr) = existing {
        sqlx::query_as::<_, SpacedRepetition>(
            "UPDATE spaced_repetition SET interval = $1, repetitions = $2, ease_factor = $3, next_review_at = $4, last_reviewed_at = $5, updated_at = $5 WHERE id = $6 RETURNING id, example_id, interval, repetitions, ease_factor, next_review_at, last_reviewed_at, created_at, updated_at"
        )
        .bind(new_interval)
        .bind(new_repetitions)
        .bind(new_ef)
        .bind(next_review_at)
        .bind(Utc::now())
        .bind(existing_sr.id)
        .fetch_one(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, SpacedRepetition>(
            "INSERT INTO spaced_repetition (example_id, interval, repetitions, ease_factor, next_review_at, last_reviewed_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, example_id, interval, repetitions, ease_factor, next_review_at, last_reviewed_at, created_at, updated_at"
        )
        .bind(example_id)
        .bind(new_interval)
        .bind(new_repetitions)
        .bind(new_ef)
        .bind(next_review_at)
        .bind(Utc::now())
        .fetch_one(&state.pool)
        .await?
    };

    Ok(Json(AnswerResponse {
        interval: new_interval,
        repetitions: new_repetitions,
        ease_factor: new_ef,
        sr,
    }))
}
