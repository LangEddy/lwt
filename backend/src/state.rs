use jsonwebtoken::jwk::JwkSet;
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub jwks: Arc<JwkSet>,
    pub supabase_url: Arc<String>,
}

impl AppState {
    pub fn new(pool: PgPool, jwks: JwkSet, supabase_url: String) -> Self {
        Self {
            pool,
            jwks: Arc::new(jwks),
            supabase_url: Arc::new(supabase_url),
        }
    }
}
