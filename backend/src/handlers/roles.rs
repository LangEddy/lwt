use axum::{
    Extension, Json,
    extract::{Path, State},
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    auth::{AppRole, Claims, require_minimum_role},
    error::AppError,
    state::AppState,
};

#[derive(Debug, Serialize)]
pub struct UserRoleResponse {
    pub user_id: Uuid,
    pub role: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserRoleRequest {
    pub role: AppRole,
}

fn claims_user_id(claims: &Claims) -> Result<Uuid, AppError> {
    Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)
}

async fn load_role_from_db(state: &AppState, user_id: Uuid) -> Result<Option<AppRole>, AppError> {
    let role =
        sqlx::query_scalar::<_, String>("SELECT role::text FROM user_roles WHERE user_id = $1")
            .bind(user_id)
            .fetch_optional(&state.pool)
            .await?;

    Ok(role.and_then(|value| AppRole::from_claim(&value)))
}

async fn resolve_current_role(state: &AppState, claims: &Claims) -> Result<AppRole, AppError> {
    let user_id = claims_user_id(claims)?;

    // Authoritative source is DB. JWT claim is used only as fallback when a
    // user has no role row yet.
    if let Some(role) = load_role_from_db(state, user_id).await? {
        return Ok(role);
    }

    Ok(claims.app_role().unwrap_or(AppRole::User))
}

fn as_role_response(user_id: Uuid, role: AppRole) -> UserRoleResponse {
    UserRoleResponse {
        user_id,
        role: role.as_str().to_string(),
    }
}

pub async fn get_my_role(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<UserRoleResponse>, AppError> {
    let user_id = claims_user_id(&claims)?;
    let role = resolve_current_role(&state, &claims).await?;

    Ok(Json(as_role_response(user_id, role)))
}

pub async fn get_user_role(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<UserRoleResponse>, AppError> {
    let current_user_id = claims_user_id(&claims)?;
    let current_role = resolve_current_role(&state, &claims).await?;

    if user_id != current_user_id {
        require_minimum_role(current_role, AppRole::Moderator)?;
    }

    let role = if user_id == current_user_id {
        current_role
    } else {
        load_role_from_db(&state, user_id)
            .await?
            .unwrap_or(AppRole::User)
    };

    Ok(Json(as_role_response(user_id, role)))
}

pub async fn upsert_user_role(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(user_id): Path<Uuid>,
    Json(body): Json<UpdateUserRoleRequest>,
) -> Result<Json<UserRoleResponse>, AppError> {
    let current_role = resolve_current_role(&state, &claims).await?;
    require_minimum_role(current_role, AppRole::Admin)?;

    let user_exists =
        sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = $1)")
            .bind(user_id)
            .fetch_one(&state.pool)
            .await?;

    if !user_exists {
        return Err(AppError::Validation("user does not exist".into()));
    }

    let role = sqlx::query_scalar::<_, String>(
        "INSERT INTO user_roles (user_id, role) VALUES ($1, $2::app_role) ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW() RETURNING role::text",
    )
    .bind(user_id)
    .bind(body.role.as_str())
    .fetch_one(&state.pool)
    .await?;

    let role = AppRole::from_claim(&role).unwrap_or(AppRole::User);

    Ok(Json(as_role_response(user_id, role)))
}
