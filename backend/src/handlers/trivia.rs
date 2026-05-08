use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{auth::Claims, error::AppError, state::AppState};

const ALLOWED_CEFR_LEVELS: [&str; 6] = ["A1", "A2", "B1", "B2", "C1", "C2"];

#[derive(Debug, FromRow, Serialize)]
pub struct Trivia {
    pub id: Uuid,
    pub language_id: Uuid,
    pub language_code: String,
    pub title: String,
    pub subtitle: Option<String>,
    pub content: String,
    pub content_type: String,
    pub category: String,
    pub category_name: String,
    pub category_icon_svg: String,
    pub category_color: String,
    pub category_bg_color: String,
    pub cefr_level: String,
    pub direction: String,
    pub is_published: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, FromRow, Serialize)]
pub struct TriviaCategory {
    pub id: Uuid,
    pub slug: String,
    pub name: String,
    pub icon_svg: String,
    pub color: String,
    pub bg_color: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ListTriviasQuery {
    pub search: Option<String>,
    pub language_ids: Option<String>,
    pub levels: Option<String>,
    pub categories: Option<String>,
    pub for_me_only: Option<bool>,
}

fn parse_csv(input: Option<&str>) -> Vec<String> {
    input
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string)
        .collect()
}

fn parse_uuid_csv(input: Option<&str>) -> Result<Vec<Uuid>, AppError> {
    let mut ids = Vec::new();
    for value in parse_csv(input) {
        let id = Uuid::parse_str(&value)
            .map_err(|_| AppError::Validation(format!("invalid UUID in language_ids: {value}")))?;
        ids.push(id);
    }
    Ok(ids)
}

fn normalize_levels(values: &[String]) -> Result<Vec<String>, AppError> {
    let mut normalized = Vec::new();

    for value in values {
        let level = value.trim().to_uppercase();
        if !ALLOWED_CEFR_LEVELS.contains(&level.as_str()) {
            return Err(AppError::Validation(format!(
                "invalid CEFR level: {level}; allowed: A1, A2, B1, B2, C1, C2"
            )));
        }
        if !normalized.iter().any(|v| v == &level) {
            normalized.push(level);
        }
    }

    Ok(normalized)
}

fn normalize_categories(values: &[String]) -> Vec<String> {
    let mut normalized = Vec::new();

    for value in values {
        let category = value.trim().to_lowercase();
        if !category.is_empty() && !normalized.iter().any(|v| v == &category) {
            normalized.push(category);
        }
    }

    normalized
}

pub async fn list_trivias(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListTriviasQuery>,
) -> Result<Json<Vec<Trivia>>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let language_ids = parse_uuid_csv(query.language_ids.as_deref())?;
    let levels = normalize_levels(&parse_csv(query.levels.as_deref()))?;
    let categories = normalize_categories(&parse_csv(query.categories.as_deref()));
    let for_me_only = query.for_me_only.unwrap_or(false);
    let search = query
        .search
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string);

    let language_ids = if language_ids.is_empty() {
        None
    } else {
        Some(language_ids)
    };
    let levels = if levels.is_empty() {
        None
    } else {
        Some(levels)
    };
    let categories = if categories.is_empty() {
        None
    } else {
        Some(categories)
    };

    let trivias = sqlx::query_as::<_, Trivia>(
        r#"
        SELECT
            t.id,
            t.language_id,
            l.code AS language_code,
            t.title,
            t.subtitle,
            t.content,
            t.content_type,
                        c.slug AS category,
                        c.name AS category_name,
                        c.icon_svg AS category_icon_svg,
                        c.color AS category_color,
                        c.bg_color AS category_bg_color,
            t.cefr_level,
            t.direction,
            t.is_published,
            t.created_at,
            t.updated_at
        FROM trivias t
        JOIN languages l ON l.id = t.language_id
                JOIN trivia_categories c ON c.id = t.category_id
        LEFT JOIN user_language_settings uls ON uls.language_id = t.language_id AND uls.user_id = $1
        WHERE t.is_published = true
          AND ($2::uuid[] IS NULL OR t.language_id = ANY($2))
          AND ($3::text[] IS NULL OR t.cefr_level = ANY($3))
                    AND ($4::text[] IS NULL OR c.slug = ANY($4))
          AND (
              $5 = false
              OR (
                  COALESCE(uls.is_favorite, false) = true
                  AND (
                      COALESCE(array_length(uls.target_cefr_levels, 1), 0) = 0
                      OR t.cefr_level = ANY(uls.target_cefr_levels)
                  )
              )
          )
          AND (
              $6::text IS NULL
              OR t.title ILIKE ('%' || $6 || '%')
              OR COALESCE(t.subtitle, '') ILIKE ('%' || $6 || '%')
              OR t.content ILIKE ('%' || $6 || '%')
          )
        ORDER BY t.created_at DESC
        "#,
    )
    .bind(user_id)
    .bind(language_ids)
    .bind(levels)
    .bind(categories)
    .bind(for_me_only)
    .bind(search)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(trivias))
}

pub async fn list_categories(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
) -> Result<Json<Vec<TriviaCategory>>, AppError> {
    let categories = sqlx::query_as::<_, TriviaCategory>(
        r#"
        SELECT
            id,
            slug,
            name,
            icon_svg,
            color,
            bg_color,
            created_at,
            updated_at
        FROM trivia_categories
        ORDER BY name ASC
        "#,
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(categories))
}

pub async fn get_trivia(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Trivia>, AppError> {
    let trivia = sqlx::query_as::<_, Trivia>(
        r#"
        SELECT
            t.id,
            t.language_id,
            l.code AS language_code,
            t.title,
            t.subtitle,
            t.content,
            t.content_type,
                        c.slug AS category,
                        c.name AS category_name,
                        c.icon_svg AS category_icon_svg,
                        c.color AS category_color,
                        c.bg_color AS category_bg_color,
            t.cefr_level,
            t.direction,
            t.is_published,
            t.created_at,
            t.updated_at
        FROM trivias t
        JOIN languages l ON l.id = t.language_id
                JOIN trivia_categories c ON c.id = t.category_id
        WHERE t.id = $1
          AND t.is_published = true
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(trivia))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_levels_accepts_valid_values() {
        let values = vec!["a2".to_string(), "B1".to_string()];
        let levels = normalize_levels(&values).expect("valid levels");
        assert_eq!(levels, vec!["A2".to_string(), "B1".to_string()]);
    }

    #[test]
    fn normalize_levels_rejects_invalid_values() {
        let values = vec!["L9".to_string()];
        assert!(matches!(
            normalize_levels(&values),
            Err(AppError::Validation(_))
        ));
    }

    #[test]
    fn normalize_categories_normalizes_and_deduplicates_values() {
        let values = vec![
            " Science ".to_string(),
            "science".to_string(),
            "GEOGRAPHY".to_string(),
            "".to_string(),
        ];
        let categories = normalize_categories(&values);
        assert_eq!(
            categories,
            vec!["science".to_string(), "geography".to_string()]
        );
    }
}
