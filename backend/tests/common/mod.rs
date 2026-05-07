#![allow(dead_code)]
//! Shared test harness for integration tests.
//!
//! Each integration test file in `tests/` includes this with `mod common;`.
//! It builds an `AppState` whose JWKS is backed by an RSA keypair generated
//! once for the test run, so the real auth middleware can be exercised
//! end-to-end without contacting Supabase.

use axum::Router;
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
use rsa::{
    RsaPrivateKey, RsaPublicKey, pkcs1::EncodeRsaPrivateKey, traits::PublicKeyParts,
};
use serde_json::json;
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use std::sync::OnceLock;

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
    mint_token_with(user_id, 3600, TEST_KID, &format!("{TEST_SUPABASE_URL}/auth/v1"))
}

pub fn mint_expired_token(user_id: &str) -> String {
    // Well past jsonwebtoken's default 60s leeway.
    mint_token_with(user_id, -3600, TEST_KID, &format!("{TEST_SUPABASE_URL}/auth/v1"))
}

pub fn mint_token_with_kid(user_id: &str, kid: &str) -> String {
    mint_token_with(user_id, 3600, kid, &format!("{TEST_SUPABASE_URL}/auth/v1"))
}

pub fn mint_token_with_issuer(user_id: &str, issuer: &str) -> String {
    mint_token_with(user_id, 3600, TEST_KID, issuer)
}

fn mint_token_with(user_id: &str, ttl_secs: i64, kid: &str, issuer: &str) -> String {
    let mut header = Header::new(Algorithm::RS256);
    header.kid = Some(kid.to_string());
    let now = chrono::Utc::now().timestamp();
    let claims = json!({
        "sub": user_id,
        "email": "test@example.com",
        "role": "authenticated",
        "iss": issuer,
        "aud": "authenticated",
        "iat": now,
        "exp": now + ttl_secs,
    });
    encode(&header, &claims, &keys().encoding).expect("encode jwt")
}
