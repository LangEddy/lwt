use axum::Router;
use lwt_backend::{router::create_router, state::AppState};
use sqlx::Connection;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use std::net::SocketAddr;
use std::str::FromStr;
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

    let mut connect_options = PgConnectOptions::from_str(&database_url)?;

    let disable_statement_cache = std::env::var("SQLX_DISABLE_STATEMENT_CACHE")
        .ok()
        .map(|value| {
            let value = value.trim().to_ascii_lowercase();
            matches!(value.as_str(), "1" | "true" | "yes" | "on")
        })
        .unwrap_or_else(|| {
            database_url.contains("pooler.supabase.com")
                || database_url.contains("pgbouncer")
                || database_url.contains(":6543")
        });

    if disable_statement_cache {
        tracing::warn!(
            "Disabling SQLx statement cache for pooler-compatible PostgreSQL connections"
        );
        connect_options = connect_options.statement_cache_capacity(0);
    }

    let pool = PgPoolOptions::new().connect_with(connect_options).await?;

    // Migrations must run on a direct (non-pooler) connection because SQLx uses
    // prepared statements internally and transaction-mode poolers (PgBouncer /
    // Supabase pooler) cannot share prepared statements across backend connections.
    // DATABASE_MIGRATE_URL should point to the direct Postgres connection
    // (port 5432). Falls back to DATABASE_URL when not set (fine for local dev).
    let migrate_url = std::env::var("DATABASE_MIGRATE_URL").unwrap_or_else(|_| {
        tracing::warn!("DATABASE_MIGRATE_URL not set; using DATABASE_URL for migrations (may fail through a pooler)");
        database_url.clone()
    });
    let mut migrate_conn = sqlx::postgres::PgConnection::connect(&migrate_url).await?;
    sqlx::migrate!("./migrations")
        .run(&mut migrate_conn)
        .await?;

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
