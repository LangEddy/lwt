use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{auth::Claims, error::AppError, state::AppState};

#[derive(Debug, FromRow, Serialize)]
pub struct Word {
    pub id: Uuid,
    pub user_id: Uuid,
    pub language_id: Uuid,
    pub text_id: Option<Uuid>,
    pub word: String,
    pub is_phrase: bool,
    pub level: i16,
    pub note: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateWordRequest {
    pub language_id: Uuid,
    pub text_id: Option<Uuid>,
    pub word: String,
    pub is_phrase: bool,
    pub level: i16,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWordRequest {
    pub level: Option<i16>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListWordsQuery {
    pub language_id: Option<Uuid>,
    pub level: Option<i16>,
    pub search: Option<String>,
}

pub async fn list_words(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListWordsQuery>,
) -> Result<Json<Vec<Word>>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let words = match (query.language_id, query.level) {
        (Some(lang), Some(lvl)) => {
            sqlx::query_as::<_, Word>(
                "SELECT id, user_id, language_id, text_id, word, is_phrase, level, note, created_at, updated_at FROM words WHERE user_id = $1 AND language_id = $2 AND level = $3 ORDER BY word"
            )
            .bind(user_id)
            .bind(lang)
            .bind(lvl)
            .fetch_all(&state.pool)
            .await?
        }
        (Some(lang), None) => {
            sqlx::query_as::<_, Word>(
                "SELECT id, user_id, language_id, text_id, word, is_phrase, level, note, created_at, updated_at FROM words WHERE user_id = $1 AND language_id = $2 ORDER BY word"
            )
            .bind(user_id)
            .bind(lang)
            .fetch_all(&state.pool)
            .await?
        }
        (None, Some(lvl)) => {
            sqlx::query_as::<_, Word>(
                "SELECT id, user_id, language_id, text_id, word, is_phrase, level, note, created_at, updated_at FROM words WHERE user_id = $1 AND level = $2 ORDER BY word"
            )
            .bind(user_id)
            .bind(lvl)
            .fetch_all(&state.pool)
            .await?
        }
        (None, None) => {
            sqlx::query_as::<_, Word>(
                "SELECT id, user_id, language_id, text_id, word, is_phrase, level, note, created_at, updated_at FROM words WHERE user_id = $1 ORDER BY word"
            )
            .bind(user_id)
            .fetch_all(&state.pool)
            .await?
        }
    };

    if let Some(search) = query.search {
        let s = search.to_lowercase();
        let filtered: Vec<Word> = words
            .into_iter()
            .filter(|w| w.word.to_lowercase().contains(&s))
            .collect();
        return Ok(Json(filtered));
    }

    Ok(Json(words))
}

pub async fn create_word(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateWordRequest>,
) -> Result<Json<Word>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    if body.level < 1 || body.level > 5 {
        return Err(AppError::Validation("level must be between 1 and 5".into()));
    }

    let word = sqlx::query_as::<_, Word>(
        "INSERT INTO words (user_id, language_id, text_id, word, is_phrase, level, note) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         ON CONFLICT (user_id, language_id, LOWER(word)) \
         DO UPDATE SET level = EXCLUDED.level, \
                       note = COALESCE(EXCLUDED.note, words.note), \
                       updated_at = NOW() \
         RETURNING id, user_id, language_id, text_id, word, is_phrase, level, note, created_at, updated_at"
    )
    .bind(user_id)
    .bind(body.language_id)
    .bind(body.text_id)
    .bind(body.word)
    .bind(body.is_phrase)
    .bind(body.level)
    .bind(body.note)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(word))
}

pub async fn update_word(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateWordRequest>,
) -> Result<Json<Word>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let existing = sqlx::query_as::<_, Word>(
        "SELECT id, user_id, language_id, text_id, word, is_phrase, level, note, created_at, updated_at FROM words WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    if existing.user_id != user_id {
        return Err(AppError::Forbidden);
    }

    if let Some(level) = body.level {
        if level < 1 || level > 5 {
            return Err(AppError::Validation("level must be between 1 and 5".into()));
        }
    }

    let word = sqlx::query_as::<_, Word>(
        "UPDATE words SET level = COALESCE($1, level), note = COALESCE($2, note), updated_at = $3 WHERE id = $4 RETURNING id, user_id, language_id, text_id, word, is_phrase, level, note, created_at, updated_at"
    )
    .bind(body.level)
    .bind(body.note)
    .bind(Utc::now())
    .bind(id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(word))
}

pub async fn delete_word(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let existing = sqlx::query_as::<_, Word>(
        "SELECT id, user_id, language_id, text_id, word, is_phrase, level, note, created_at, updated_at FROM words WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    if existing.user_id != user_id {
        return Err(AppError::Forbidden);
    }

    sqlx::query("DELETE FROM words WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}
