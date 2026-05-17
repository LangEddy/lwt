use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{auth::Claims, error::AppError, state::AppState};

const REVIEW_STATE_LEARNING: i16 = 1;
const REVIEW_STATE_REVIEW: i16 = 2;

#[derive(Debug, FromRow, Serialize)]
pub struct Example {
    pub id: Uuid,
    pub word_id: Uuid,
    pub sentence: String,
    pub translation: Option<String>,
    pub note: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, FromRow, Serialize)]
pub struct SentenceItem {
    pub id: Uuid,
    pub word_id: Uuid,
    pub word: String,
    pub language_id: Uuid,
    pub language_code: String,
    pub sentence: String,
    pub translation: Option<String>,
    pub note: Option<String>,
    pub next_review_at: Option<chrono::DateTime<chrono::Utc>>,
    pub last_reviewed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub state: Option<i16>,
    pub scheduled_days: Option<i32>,
    pub learning_steps: Option<i32>,
    pub reps: Option<i32>,
    pub lapses: Option<i32>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, FromRow)]
struct LegacySentenceItemRow {
    pub id: Uuid,
    pub word_id: Uuid,
    pub word: String,
    pub language_id: Uuid,
    pub language_code: String,
    pub sentence: String,
    pub translation: Option<String>,
    pub note: Option<String>,
    pub next_review_at: Option<chrono::DateTime<chrono::Utc>>,
    pub last_reviewed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub interval: Option<i32>,
    pub repetitions: Option<i32>,
    pub ease_factor: Option<f32>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ListSentencesQuery {
    pub language_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateExampleRequest {
    pub sentence: String,
    pub translation: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateExampleRequest {
    pub sentence: Option<String>,
    pub translation: Option<String>,
    pub note: Option<String>,
}

fn is_undefined_column_error(err: &sqlx::Error) -> bool {
    matches!(
        err,
        sqlx::Error::Database(db_err) if db_err.code().as_deref() == Some("42703")
    )
}

impl TryFrom<LegacySentenceItemRow> for SentenceItem {
    type Error = AppError;

    fn try_from(row: LegacySentenceItemRow) -> Result<Self, Self::Error> {
        let has_review = row.interval.is_some()
            || row.repetitions.is_some()
            || row.ease_factor.is_some()
            || row.next_review_at.is_some()
            || row.last_reviewed_at.is_some();

        let reps = row.repetitions.map(|repetitions| repetitions.max(0));
        let state = if has_review {
            Some(if reps.unwrap_or_default() > 0 {
                REVIEW_STATE_REVIEW
            } else {
                REVIEW_STATE_LEARNING
            })
        } else {
            None
        };

        Ok(SentenceItem {
            id: row.id,
            word_id: row.word_id,
            word: row.word,
            language_id: row.language_id,
            language_code: row.language_code,
            sentence: row.sentence,
            translation: row.translation,
            note: row.note,
            next_review_at: row.next_review_at,
            last_reviewed_at: row.last_reviewed_at,
            state,
            scheduled_days: row.interval.map(|interval| interval.max(1)),
            learning_steps: state.map(|state| if state == REVIEW_STATE_REVIEW { 0 } else { 1 }),
            reps,
            lapses: state.map(|_| 0),
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }
}

pub async fn list_examples(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(word_id): Path<Uuid>,
) -> Result<Json<Vec<Example>>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    // Verify word ownership
    let word_owner: Option<(Uuid,)> = sqlx::query_as("SELECT user_id FROM words WHERE id = $1")
        .bind(word_id)
        .fetch_optional(&state.pool)
        .await?;

    match word_owner {
        Some((owner_id,)) if owner_id == user_id => {}
        _ => return Err(AppError::Forbidden),
    }

    let examples = sqlx::query_as::<_, Example>(
        "SELECT id, word_id, sentence, translation, note, created_at, updated_at FROM examples WHERE word_id = $1 ORDER BY created_at DESC"
    )
    .bind(word_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(examples))
}

pub async fn list_sentences(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListSentencesQuery>,
) -> Result<Json<Vec<SentenceItem>>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let items = if let Some(language_id) = query.language_id {
        match sqlx::query_as::<_, SentenceItem>(
            r#"
            SELECT
                e.id,
                e.word_id,
                w.word,
                w.language_id,
                l.code AS language_code,
                e.sentence,
                e.translation,
                e.note,
                sr.next_review_at,
                sr.last_reviewed_at,
                COALESCE(
                    sr.state,
                    CASE
                        WHEN sr.example_id IS NULL THEN NULL
                        WHEN COALESCE(sr.reps, sr.repetitions, 0) > 0 THEN 2::SMALLINT
                        ELSE 1::SMALLINT
                    END
                ) AS state,
                COALESCE(sr.scheduled_days, sr.interval) AS scheduled_days,
                sr.learning_steps,
                COALESCE(sr.reps, sr.repetitions) AS reps,
                sr.lapses,
                e.created_at,
                e.updated_at
            FROM examples e
            JOIN words w ON e.word_id = w.id
            JOIN languages l ON w.language_id = l.id
            LEFT JOIN spaced_repetition sr ON sr.example_id = e.id
            WHERE w.user_id = $1
              AND w.language_id = $2
            ORDER BY e.updated_at DESC, e.created_at DESC
            "#,
        )
        .bind(user_id)
        .bind(language_id)
        .fetch_all(&state.pool)
        .await
        {
            Ok(items) => items,
            Err(err) if is_undefined_column_error(&err) => {
                sqlx::query_as::<_, LegacySentenceItemRow>(
                    r#"
                SELECT
                    e.id,
                    e.word_id,
                    w.word,
                    w.language_id,
                    l.code AS language_code,
                    e.sentence,
                    e.translation,
                    e.note,
                    sr.next_review_at,
                    sr.last_reviewed_at,
                    sr.interval,
                    sr.repetitions,
                    sr.ease_factor,
                    e.created_at,
                    e.updated_at
                FROM examples e
                JOIN words w ON e.word_id = w.id
                JOIN languages l ON w.language_id = l.id
                LEFT JOIN spaced_repetition sr ON sr.example_id = e.id
                WHERE w.user_id = $1
                  AND w.language_id = $2
                ORDER BY e.updated_at DESC, e.created_at DESC
                "#,
                )
                .bind(user_id)
                .bind(language_id)
                .fetch_all(&state.pool)
                .await?
                .into_iter()
                .map(SentenceItem::try_from)
                .collect::<Result<Vec<_>, _>>()?
            }
            Err(err) => return Err(err.into()),
        }
    } else {
        match sqlx::query_as::<_, SentenceItem>(
            r#"
            SELECT
                e.id,
                e.word_id,
                w.word,
                w.language_id,
                l.code AS language_code,
                e.sentence,
                e.translation,
                e.note,
                sr.next_review_at,
                sr.last_reviewed_at,
                COALESCE(
                    sr.state,
                    CASE
                        WHEN sr.example_id IS NULL THEN NULL
                        WHEN COALESCE(sr.reps, sr.repetitions, 0) > 0 THEN 2::SMALLINT
                        ELSE 1::SMALLINT
                    END
                ) AS state,
                COALESCE(sr.scheduled_days, sr.interval) AS scheduled_days,
                sr.learning_steps,
                COALESCE(sr.reps, sr.repetitions) AS reps,
                sr.lapses,
                e.created_at,
                e.updated_at
            FROM examples e
            JOIN words w ON e.word_id = w.id
            JOIN languages l ON w.language_id = l.id
            LEFT JOIN spaced_repetition sr ON sr.example_id = e.id
            WHERE w.user_id = $1
            ORDER BY e.updated_at DESC, e.created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&state.pool)
        .await
        {
            Ok(items) => items,
            Err(err) if is_undefined_column_error(&err) => {
                sqlx::query_as::<_, LegacySentenceItemRow>(
                    r#"
                SELECT
                    e.id,
                    e.word_id,
                    w.word,
                    w.language_id,
                    l.code AS language_code,
                    e.sentence,
                    e.translation,
                    e.note,
                    sr.next_review_at,
                    sr.last_reviewed_at,
                    sr.interval,
                    sr.repetitions,
                    sr.ease_factor,
                    e.created_at,
                    e.updated_at
                FROM examples e
                JOIN words w ON e.word_id = w.id
                JOIN languages l ON w.language_id = l.id
                LEFT JOIN spaced_repetition sr ON sr.example_id = e.id
                WHERE w.user_id = $1
                ORDER BY e.updated_at DESC, e.created_at DESC
                "#,
                )
                .bind(user_id)
                .fetch_all(&state.pool)
                .await?
                .into_iter()
                .map(SentenceItem::try_from)
                .collect::<Result<Vec<_>, _>>()?
            }
            Err(err) => return Err(err.into()),
        }
    };

    Ok(Json(items))
}

pub async fn create_example(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(word_id): Path<Uuid>,
    Json(body): Json<CreateExampleRequest>,
) -> Result<Json<Example>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let word_owner: Option<(Uuid,)> = sqlx::query_as("SELECT user_id FROM words WHERE id = $1")
        .bind(word_id)
        .fetch_optional(&state.pool)
        .await?;

    match word_owner {
        Some((owner_id,)) if owner_id == user_id => {}
        _ => return Err(AppError::Forbidden),
    }

    let example = sqlx::query_as::<_, Example>(
        "INSERT INTO examples (word_id, sentence, translation, note) VALUES ($1, $2, $3, $4) RETURNING id, word_id, sentence, translation, note, created_at, updated_at"
    )
    .bind(word_id)
    .bind(body.sentence)
    .bind(body.translation)
    .bind(body.note)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(example))
}

pub async fn update_example(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateExampleRequest>,
) -> Result<Json<Example>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let word_owner: Option<(Uuid,)> = sqlx::query_as(
        "SELECT w.user_id FROM examples e JOIN words w ON e.word_id = w.id WHERE e.id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?;

    match word_owner {
        Some((owner_id,)) if owner_id == user_id => {}
        _ => return Err(AppError::Forbidden),
    }

    let example = sqlx::query_as::<_, Example>(
        "UPDATE examples SET sentence = COALESCE($1, sentence), translation = COALESCE($2, translation), note = COALESCE($3, note), updated_at = $4 WHERE id = $5 RETURNING id, word_id, sentence, translation, note, created_at, updated_at"
    )
    .bind(body.sentence)
    .bind(body.translation)
    .bind(body.note)
    .bind(Utc::now())
    .bind(id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(example))
}

pub async fn delete_example(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let word_owner: Option<(Uuid,)> = sqlx::query_as(
        "SELECT w.user_id FROM examples e JOIN words w ON e.word_id = w.id WHERE e.id = $1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?;

    match word_owner {
        Some((owner_id,)) if owner_id == user_id => {}
        _ => return Err(AppError::Forbidden),
    }

    sqlx::query("DELETE FROM examples WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}
