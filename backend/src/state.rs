use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub jwt_secret: Arc<String>,
    pub dev_auth_token: Option<Arc<String>>,
}

impl AppState {
    pub fn new(pool: PgPool, jwt_secret: String) -> Self {
        let dev_auth_token = std::env::var("DEV_AUTH_TOKEN").ok().map(Arc::new);
        Self {
            pool,
            jwt_secret: Arc::new(jwt_secret),
            dev_auth_token,
        }
    }
}
