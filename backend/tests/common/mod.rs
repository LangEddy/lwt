#![allow(dead_code)]
//! Shared test harness for integration tests.
//!
//! Each integration test file in `tests/` includes this with `mod common;`.
//! It builds an `AppState` whose JWKS is backed by an RSA keypair generated
//! once for the test run, so the real auth middleware can be exercised
//! end-to-end without contacting Supabase.

use axum::Router;
use axum::body::{Body, to_bytes};
use axum::http::{Request, Response, StatusCode};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use jsonwebtoken::{
    Algorithm, EncodingKey, Header, encode,
    jwk::{
        AlgorithmParameters, CommonParameters, Jwk, JwkSet, KeyAlgorithm, PublicKeyUse,
        RSAKeyParameters, RSAKeyType,
    },
};
use lwt_backend::{router::create_router, state::AppState};
use rsa::{RsaPrivateKey, RsaPublicKey, pkcs1::EncodeRsaPrivateKey, traits::PublicKeyParts};
use serde_json::{Value, json};
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use std::sync::OnceLock;
use tower::ServiceExt;
use uuid::Uuid;

pub const TEST_SUPABASE_URL: &str = "https://test.supabase.co";
pub const TEST_KID: &str = "test-key";

struct TestKeys {
    encoding: EncodingKey,
    jwks: JwkSet,
}

static KEYS: OnceLock<TestKeys> = OnceLock::new();

fn keys() -> &'static TestKeys {
    KEYS.get_or_init(|| {
        let mut rng = rand::thread_rng();
        let private_key = RsaPrivateKey::new(&mut rng, 2048).expect("rsa keygen");
        let public_key = RsaPublicKey::from(&private_key);
        let pem = private_key
            .to_pkcs1_pem(rsa::pkcs1::LineEnding::LF)
            .expect("pem encode");
        let encoding = EncodingKey::from_rsa_pem(pem.as_bytes()).expect("encoding key");

        let n = URL_SAFE_NO_PAD.encode(public_key.n().to_bytes_be());
        let e = URL_SAFE_NO_PAD.encode(public_key.e().to_bytes_be());

        let jwk = Jwk {
            common: CommonParameters {
                public_key_use: Some(PublicKeyUse::Signature),
                key_algorithm: Some(KeyAlgorithm::RS256),
                key_id: Some(TEST_KID.to_string()),
                ..Default::default()
            },
            algorithm: AlgorithmParameters::RSA(RSAKeyParameters {
                key_type: RSAKeyType::RSA,
                n,
                e,
            }),
        };
        TestKeys {
            encoding,
            jwks: JwkSet { keys: vec![jwk] },
        }
    })
}

/// Build the real router with a test JWKS in `AppState`.
pub fn test_router(pool: PgPool) -> Router {
    let state = AppState::new(pool, keys().jwks.clone(), TEST_SUPABASE_URL.to_string());
    create_router(state)
}

/// Pool that defers connecting to the database. Useful for routes that don't
/// touch the DB (e.g. /health, or auth-rejection paths).
pub fn lazy_pool() -> PgPool {
    PgPoolOptions::new()
        .connect_lazy("postgres://lazy:lazy@127.0.0.1/lazy")
        .expect("lazy pool")
}

/// Pool that actually connects, using `DATABASE_URL`. Returns `None` if the
/// env var is unset so DB-dependent tests can be skipped.
pub async fn db_pool() -> Option<PgPool> {
    let url = std::env::var("DATABASE_URL").ok()?;
    PgPoolOptions::new()
        .max_connections(2)
        .connect(&url)
        .await
        .ok()
}

/// Mint a valid token for `user_id` with default 1-hour TTL.
pub fn mint_token(user_id: &str) -> String {
    mint_token_with(
        user_id,
        3600,
        TEST_KID,
        &format!("{TEST_SUPABASE_URL}/auth/v1"),
    )
}

pub fn mint_expired_token(user_id: &str) -> String {
    // Well past jsonwebtoken's default 60s leeway.
    mint_token_with(
        user_id,
        -3600,
        TEST_KID,
        &format!("{TEST_SUPABASE_URL}/auth/v1"),
    )
}

pub fn mint_token_with_kid(user_id: &str, kid: &str) -> String {
    mint_token_with(user_id, 3600, kid, &format!("{TEST_SUPABASE_URL}/auth/v1"))
}

pub fn mint_token_with_issuer(user_id: &str, issuer: &str) -> String {
    mint_token_with(user_id, 3600, TEST_KID, issuer)
}

// ---------------------------------------------------------------------------
// Request / response helpers
// ---------------------------------------------------------------------------

/// Send a request through the router and return (status, parsed JSON body).
/// JSON parse failures yield `Value::Null` so tests can still assert on status.
pub async fn send(app: &Router, req: Request<Body>) -> (StatusCode, Value) {
    let resp = app.clone().oneshot(req).await.expect("router oneshot");
    let status = resp.status();
    let body = read_body(resp).await;
    (status, body)
}

pub async fn read_body(resp: Response<Body>) -> Value {
    let bytes = to_bytes(resp.into_body(), 2_000_000)
        .await
        .expect("read body");
    if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap_or(Value::Null)
    }
}

fn auth_header(token: &str) -> String {
    format!("Bearer {token}")
}

pub fn req_get(uri: &str, token: &str) -> Request<Body> {
    Request::builder()
        .method("GET")
        .uri(uri)
        .header("authorization", auth_header(token))
        .body(Body::empty())
        .unwrap()
}

pub fn req_post(uri: &str, token: &str, body: Value) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri(uri)
        .header("authorization", auth_header(token))
        .header("content-type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap()
}

pub fn req_put(uri: &str, token: &str, body: Value) -> Request<Body> {
    Request::builder()
        .method("PUT")
        .uri(uri)
        .header("authorization", auth_header(token))
        .header("content-type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap()
}

pub fn req_delete(uri: &str, token: &str) -> Request<Body> {
    Request::builder()
        .method("DELETE")
        .uri(uri)
        .header("authorization", auth_header(token))
        .body(Body::empty())
        .unwrap()
}

// ---------------------------------------------------------------------------
// DB fixtures
// ---------------------------------------------------------------------------

/// Wrapper around a unique test user. Each test gets its own UUID + token so
/// parallel tests don't collide.
pub struct TestUser {
    pub id: Uuid,
    pub token: String,
}

pub fn new_test_user() -> TestUser {
    let id = Uuid::new_v4();
    let token = mint_token(&id.to_string());
    TestUser { id, token }
}

/// Look up a seeded language by ISO code (`en`, `de`, ...). Panics if missing.
pub async fn language_id_by_code(pool: &PgPool, code: &str) -> Uuid {
    let (id,): (Uuid,) = sqlx::query_as("SELECT id FROM languages WHERE code = $1")
        .bind(code)
        .fetch_one(pool)
        .await
        .expect("language lookup");
    id
}

pub async fn seed_word(
    pool: &PgPool,
    user_id: Uuid,
    language_id: Uuid,
    word: &str,
    level: i16,
) -> Uuid {
    let (id,): (Uuid,) = sqlx::query_as(
        "INSERT INTO words (user_id, language_id, word, level) VALUES ($1, $2, $3, $4) RETURNING id"
    )
    .bind(user_id)
    .bind(language_id)
    .bind(word)
    .bind(level)
    .fetch_one(pool)
    .await
    .expect("seed word");
    id
}

pub async fn seed_example(pool: &PgPool, word_id: Uuid, sentence: &str) -> Uuid {
    let (id,): (Uuid,) =
        sqlx::query_as("INSERT INTO examples (word_id, sentence) VALUES ($1, $2) RETURNING id")
            .bind(word_id)
            .bind(sentence)
            .fetch_one(pool)
            .await
            .expect("seed example");
    id
}

/// Best-effort cleanup of all data for a test user. Cascades remove
/// dependent rows (examples → spaced_repetition).
pub async fn cleanup_user(pool: &PgPool, user_id: Uuid) {
    let _ = sqlx::query("DELETE FROM words WHERE user_id = $1")
        .bind(user_id)
        .execute(pool)
        .await;
    let _ = sqlx::query("DELETE FROM texts WHERE user_id = $1")
        .bind(user_id)
        .execute(pool)
        .await;
    let _ = sqlx::query("DELETE FROM user_language_settings WHERE user_id = $1")
        .bind(user_id)
        .execute(pool)
        .await;
    let _ = sqlx::query("DELETE FROM sync_state WHERE user_id = $1")
        .bind(user_id)
        .execute(pool)
        .await;
}

pub async fn seed_text(
    pool: &PgPool,
    user_id: Option<Uuid>,
    language_id: Uuid,
    title: &str,
    content: &str,
) -> Uuid {
    let (id,): (Uuid,) = sqlx::query_as(
        "INSERT INTO texts (user_id, language_id, title, content) VALUES ($1, $2, $3, $4) RETURNING id"
    )
    .bind(user_id)
    .bind(language_id)
    .bind(title)
    .bind(content)
    .fetch_one(pool)
    .await
    .expect("seed text");
    id
}

pub async fn seed_trivia(
    pool: &PgPool,
    language_id: Uuid,
    title: &str,
    subtitle: Option<&str>,
    content: &str,
    category: &str,
    cefr_level: &str,
    direction: &str,
    is_published: bool,
) -> Uuid {
    let (id,): (Uuid,) = sqlx::query_as(
        "INSERT INTO trivias (language_id, category_id, title, subtitle, content, cefr_level, direction, is_published) VALUES ($1, (SELECT id FROM trivia_categories WHERE slug = $2), $3, $4, $5, $6, $7, $8) RETURNING id",
    )
    .bind(language_id)
    .bind(category)
    .bind(title)
    .bind(subtitle)
    .bind(content)
    .bind(cefr_level)
    .bind(direction)
    .bind(is_published)
    .fetch_one(pool)
    .await
    .expect("seed trivia");
    id
}

pub async fn cleanup_trivias(pool: &PgPool, ids: &[Uuid]) {
    if ids.is_empty() {
        return;
    }

    let _ = sqlx::query("DELETE FROM trivias WHERE id = ANY($1)")
        .bind(ids.to_vec())
        .execute(pool)
        .await;
}

fn mint_token_with(user_id: &str, ttl_secs: i64, kid: &str, issuer: &str) -> String {
    let mut header = Header::new(Algorithm::RS256);
    header.kid = Some(kid.to_string());
    let now = chrono::Utc::now().timestamp();
    let claims = json!({
        "sub": user_id,
        "email": "test@example.com",
        "role": "authenticated",
        "user_role": "user",
        "app_role": "user",
        "iss": issuer,
        "aud": "authenticated",
        "iat": now,
        "exp": now + ttl_secs,
    });
    encode(&header, &claims, &keys().encoding).expect("encode jwt")
}
