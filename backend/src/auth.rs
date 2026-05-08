use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{DecodingKey, Validation, decode, decode_header};
use serde::{Deserialize, Serialize};

use crate::{error::AppError, state::AppState};

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum AppRole {
    User,
    Moderator,
    Admin,
}

impl AppRole {
    pub fn from_claim(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "user" => Some(Self::User),
            "moderator" => Some(Self::Moderator),
            "admin" => Some(Self::Admin),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::User => "user",
            Self::Moderator => "moderator",
            Self::Admin => "admin",
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub email: Option<String>,
    pub exp: usize,
    pub role: Option<String>,
    pub user_role: Option<String>,
    pub app_role: Option<String>,
}

impl Claims {
    pub fn app_role(&self) -> Option<AppRole> {
        self.app_role
            .as_deref()
            .and_then(AppRole::from_claim)
            .or_else(|| self.user_role.as_deref().and_then(AppRole::from_claim))
    }
}

pub fn require_minimum_role(actual: AppRole, required: AppRole) -> Result<(), AppError> {
    if actual >= required {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_role_from_claim_handles_known_values() {
        assert_eq!(AppRole::from_claim("user"), Some(AppRole::User));
        assert_eq!(AppRole::from_claim("moderator"), Some(AppRole::Moderator));
        assert_eq!(AppRole::from_claim("ADMIN"), Some(AppRole::Admin));
    }

    #[test]
    fn app_role_from_claim_rejects_unknown_values() {
        assert_eq!(AppRole::from_claim(""), None);
        assert_eq!(AppRole::from_claim("owner"), None);
    }

    #[test]
    fn claim_app_role_parses_when_present() {
        let claims = Claims {
            sub: "00000000-0000-0000-0000-000000000001".into(),
            email: Some("test@example.com".into()),
            exp: 1,
            role: Some("authenticated".into()),
            user_role: None,
            app_role: Some("moderator".into()),
        };

        assert_eq!(claims.app_role(), Some(AppRole::Moderator));
    }

    #[test]
    fn claim_app_role_falls_back_to_user_role() {
        let claims = Claims {
            sub: "00000000-0000-0000-0000-000000000001".into(),
            email: Some("test@example.com".into()),
            exp: 1,
            role: Some("authenticated".into()),
            user_role: Some("admin".into()),
            app_role: None,
        };

        assert_eq!(claims.app_role(), Some(AppRole::Admin));
    }

    #[test]
    fn require_minimum_role_enforces_hierarchy() {
        assert!(require_minimum_role(AppRole::Admin, AppRole::Moderator).is_ok());
        assert!(require_minimum_role(AppRole::Moderator, AppRole::Moderator).is_ok());
        assert!(require_minimum_role(AppRole::User, AppRole::Moderator).is_err());
    }
}
