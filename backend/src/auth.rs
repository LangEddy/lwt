use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

use crate::{error::AppError, state::AppState};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub exp: usize,
    pub role: Option<String>,
}

pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let auth_header = request
        .headers()
        .get("authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or(AppError::Unauthorized)?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or(AppError::Unauthorized)?;

    // Try dev auth first (for local development)
    if let Some(dev_token) = &state.dev_auth_token {
        if token == dev_token.as_str() {
            request.extensions_mut().insert(Claims {
                sub: "00000000-0000-0000-0000-000000000000".to_string(),
                email: "dev@example.com".to_string(),
                exp: usize::MAX,
                role: Some("admin".to_string()),
            });
            return Ok(next.run(request).await);
        }
    }

    // Try Supabase JWT validation
    let validation = Validation::new(Algorithm::HS256);
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
        &validation,
    )
    .map_err(|e| {
        tracing::warn!("JWT decode error: {}", e);
        AppError::Unauthorized
    })?;

    request.extensions_mut().insert(token_data.claims);
    Ok(next.run(request).await)
}

/// Extract claims from request extensions
pub fn get_claims(req: &Request) -> Option<Claims> {
    req.extensions().get::<Claims>().cloned()
}
