use axum::{
    Extension, Json,
    extract::{Path, State},
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{auth::Claims, error::AppError, state::AppState};

#[derive(Debug, FromRow, Serialize)]
pub struct Language {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub direction: String,
    pub is_platform: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, FromRow, Serialize)]
pub struct LanguageWithFavorite {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub direction: String,
    pub is_platform: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub is_favorite: bool,
}

#[derive(Debug, FromRow, Serialize)]
pub struct UserLanguageSetting {
    pub user_id: Uuid,
    pub language_id: Uuid,
    pub tts_voice: Option<String>,
    pub dictionary_url: Option<String>,
    pub is_favorite: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSettingsRequest {
    pub tts_voice: Option<String>,
    pub dictionary_url: Option<String>,
    pub is_favorite: Option<bool>,
}

fn validate_tts_voice(value: &str) -> Result<(), AppError> {
    if value.trim().is_empty() {
        return Ok(());
    }
    if value.len() > 255 {
        return Err(AppError::Validation(
            "TTS voice is too long (max 255 chars)".into(),
        ));
    }
    if value.chars().any(|c| c.is_control()) {
        return Err(AppError::Validation(
            "TTS voice contains invalid characters".into(),
        ));
    }

    Ok(())
}

fn validate_dictionary_url(value: &str) -> Result<(), AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(());
    }
    if trimmed.len() > 2048 {
        return Err(AppError::Validation(
            "Dictionary template is too long (max 2048 chars)".into(),
        ));
    }
    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err(AppError::Validation(
            "Dictionary template must start with http:// or https://".into(),
        ));
    }
    if !trimmed.contains("{word}") {
        return Err(AppError::Validation(
            "Dictionary template must include {word} placeholder".into(),
        ));
    }

    let resolved = trimmed.replace("{word}", "example");
    if reqwest::Url::parse(&resolved).is_err() {
        return Err(AppError::Validation(
            "Dictionary template is not a valid URL".into(),
        ));
    }

    Ok(())
}

pub async fn list_languages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<LanguageWithFavorite>>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let languages = sqlx::query_as::<_, LanguageWithFavorite>(
        r#"
        SELECT
            l.id,
            l.code,
            l.name,
            l.direction,
            l.is_platform,
            l.created_at,
            COALESCE(uls.is_favorite, false) as is_favorite
        FROM languages l
        LEFT JOIN user_language_settings uls ON uls.language_id = l.id AND uls.user_id = $1
        ORDER BY COALESCE(uls.is_favorite, false) DESC, l.name ASC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(languages))
}

pub async fn get_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(language_id): Path<Uuid>,
) -> Result<Json<UserLanguageSetting>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let settings = sqlx::query_as::<_, UserLanguageSetting>(
        "SELECT user_id, language_id, tts_voice, dictionary_url, is_favorite, created_at, updated_at FROM user_language_settings WHERE user_id = $1 AND language_id = $2"
    )
    .bind(user_id)
    .bind(language_id)
    .fetch_optional(&state.pool)
    .await?;

    match settings {
        Some(s) => Ok(Json(s)),
        None => Ok(Json(UserLanguageSetting {
            user_id,
            language_id,
            tts_voice: None,
            dictionary_url: None,
            is_favorite: false,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })),
    }
}

pub async fn update_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(language_id): Path<Uuid>,
    Json(body): Json<UpdateSettingsRequest>,
) -> Result<Json<UserLanguageSetting>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    if let Some(tts_voice) = &body.tts_voice {
        validate_tts_voice(tts_voice)?;
    }
    if let Some(dictionary_url) = &body.dictionary_url {
        validate_dictionary_url(dictionary_url)?;
    }

    let tts_voice_provided = body.tts_voice.is_some();
    let dictionary_url_provided = body.dictionary_url.is_some();

    let tts_voice = body
        .tts_voice
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let dictionary_url = body
        .dictionary_url
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    let existing = sqlx::query_as::<_, UserLanguageSetting>(
        "SELECT user_id, language_id, tts_voice, dictionary_url, is_favorite, created_at, updated_at FROM user_language_settings WHERE user_id = $1 AND language_id = $2"
    )
    .bind(user_id)
    .bind(language_id)
    .fetch_optional(&state.pool)
    .await?;

    let settings = if let Some(_existing) = existing {
        sqlx::query_as::<_, UserLanguageSetting>(
            "UPDATE user_language_settings SET tts_voice = CASE WHEN $1 THEN $2 ELSE tts_voice END, dictionary_url = CASE WHEN $3 THEN $4 ELSE dictionary_url END, is_favorite = COALESCE($5, is_favorite), updated_at = NOW() WHERE user_id = $6 AND language_id = $7 RETURNING user_id, language_id, tts_voice, dictionary_url, is_favorite, created_at, updated_at"
        )
        .bind(tts_voice_provided)
        .bind(tts_voice)
        .bind(dictionary_url_provided)
        .bind(dictionary_url)
        .bind(body.is_favorite)
        .bind(user_id)
        .bind(language_id)
        .fetch_one(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, UserLanguageSetting>(
            "INSERT INTO user_language_settings (user_id, language_id, tts_voice, dictionary_url, is_favorite) VALUES ($1, $2, $3, $4, $5) RETURNING user_id, language_id, tts_voice, dictionary_url, is_favorite, created_at, updated_at"
        )
        .bind(user_id)
        .bind(language_id)
        .bind(tts_voice)
        .bind(dictionary_url)
        .bind(body.is_favorite.unwrap_or(false))
        .fetch_one(&state.pool)
        .await?
    };

    Ok(Json(settings))
}
