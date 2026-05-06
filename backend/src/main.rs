use axum::Router;
use lwt_backend::{router::create_router, state::AppState};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "lwt_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let supabase_url = std::env::var("SUPABASE_URL").expect("SUPABASE_URL must be set");

    // Fetch JWKS from Supabase at startup (cached for the lifetime of the process)
    let jwks_url = format!("{supabase_url}/auth/v1/.well-known/jwks.json");
    tracing::info!("Fetching JWKS from {jwks_url}");
    let jwks = reqwest::get(&jwks_url)
        .await?
        .error_for_status()?
        .json::<jsonwebtoken::jwk::JwkSet>()
        .await?;
    tracing::info!("Loaded {} JWK(s)", jwks.keys.len());

    let pool = sqlx::PgPool::connect(&database_url).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;

    let state = AppState::new(pool, jwks, supabase_url);
    let app: Router = create_router(state);

    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".into())
        .parse::<u16>()?;
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = TcpListener::bind(addr).await?;

    tracing::info!("Server listening on {}", addr);
    axum::serve(listener, app).await?;

    Ok(())
}
