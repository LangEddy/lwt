use axum::{
    extract::{Path, State},
    Extension, Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{auth::Claims, error::AppError, state::AppState};

#[derive(Debug, FromRow, Serialize)]
pub struct Text {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub language_id: Uuid,
    pub language_code: String,
    pub title: String,
    pub content: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTextRequest {
    pub language_id: Uuid,
    pub title: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTextRequest {
    pub language_id: Option<Uuid>,
    pub title: Option<String>,
    pub content: Option<String>,
}

pub async fn get_text(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Text>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let text = sqlx::query_as::<_, Text>(
        "SELECT t.id, t.user_id, t.language_id, l.code as language_code, t.title, t.content, t.created_at, t.updated_at FROM texts t JOIN languages l ON t.language_id = l.id WHERE t.id = $1 AND (t.user_id = $2 OR t.user_id IS NULL)"
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(text))
}

pub async fn list_texts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Text>>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let texts = sqlx::query_as::<_, Text>(
        "SELECT t.id, t.user_id, t.language_id, l.code as language_code, t.title, t.content, t.created_at, t.updated_at FROM texts t JOIN languages l ON t.language_id = l.id WHERE t.user_id = $1 OR t.user_id IS NULL ORDER BY t.created_at DESC"
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(texts))
}

pub async fn create_text(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTextRequest>,
) -> Result<Json<Text>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let text = sqlx::query_as::<_, Text>(
        "INSERT INTO texts (user_id, language_id, title, content) VALUES ($1, $2, $3, $4) RETURNING id, user_id, language_id, (SELECT code FROM languages WHERE id = $2) as language_code, title, content, created_at, updated_at"
    )
    .bind(user_id)
    .bind(body.language_id)
    .bind(body.title)
    .bind(body.content)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(text))
}

pub async fn update_text(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTextRequest>,
) -> Result<Json<Text>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    // Verify ownership
    let existing = sqlx::query_as::<_, Text>(
        "SELECT t.id, t.user_id, t.language_id, l.code as language_code, t.title, t.content, t.created_at, t.updated_at FROM texts t JOIN languages l ON t.language_id = l.id WHERE t.id = $1"
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    if existing.user_id != Some(user_id) {
        return Err(AppError::Forbidden);
    }

    let text = sqlx::query_as::<_, Text>(
        "UPDATE texts SET language_id = COALESCE($1, language_id), title = COALESCE($2, title), content = COALESCE($3, content), updated_at = $4 WHERE id = $5 RETURNING id, user_id, language_id, (SELECT code FROM languages WHERE id = language_id) as language_code, title, content, created_at, updated_at"
    )
    .bind(body.language_id)
    .bind(body.title)
    .bind(body.content)
    .bind(Utc::now())
    .bind(id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(text))
}

pub async fn delete_text(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let existing = sqlx::query_as::<_, Text>(
        "SELECT t.id, t.user_id, t.language_id, l.code as language_code, t.title, t.content, t.created_at, t.updated_at FROM texts t JOIN languages l ON t.language_id = l.id WHERE t.id = $1"
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    if existing.user_id != Some(user_id) {
        return Err(AppError::Forbidden);
    }

    sqlx::query("DELETE FROM texts WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}
