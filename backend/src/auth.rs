use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{DecodingKey, Validation, decode, decode_header};
use serde::{Deserialize, Serialize};

use crate::{error::AppError, state::AppState};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub email: Option<String>,
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

    // Decode header to discover kid and alg without verifying yet
    let header = decode_header(token).map_err(|e| {
        tracing::warn!("JWT header decode error: {e}");
        AppError::Unauthorized
    })?;

    let kid = header.kid.ok_or_else(|| {
        tracing::warn!("JWT missing kid");
        AppError::Unauthorized
    })?;

    // Find the matching public key in the cached JWKS
    let jwk = state.jwks.find(&kid).ok_or_else(|| {
        tracing::warn!("No JWK found for kid: {kid}");
        AppError::Unauthorized
    })?;

    let decoding_key = DecodingKey::from_jwk(jwk).map_err(|e| {
        tracing::warn!("Failed to build decoding key from JWK: {e}");
        AppError::Unauthorized
    })?;

    let mut validation = Validation::new(header.alg);
    validation.set_issuer(&[format!("{}/auth/v1", state.supabase_url)]);
    validation.set_audience(&["authenticated"]);

    let token_data = decode::<Claims>(token, &decoding_key, &validation).map_err(|e| {
        tracing::warn!("JWT validation error: {e}");
        AppError::Unauthorized
    })?;

    request.extensions_mut().insert(token_data.claims);
    Ok(next.run(request).await)
}

/// Extract claims from request extensions
pub fn get_claims(req: &Request) -> Option<Claims> {
    req.extensions().get::<Claims>().cloned()
}
