//! Sanity checks for the integration test harness.
//!
//! These exercise the real router + auth middleware but never touch the
//! database, so they run anywhere `cargo test` runs.

mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

fn get(uri: &str) -> Request<Body> {
    Request::builder().uri(uri).body(Body::empty()).unwrap()
}

fn get_with_auth(uri: &str, token: &str) -> Request<Body> {
    Request::builder()
        .uri(uri)
        .header("authorization", format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap()
}

#[tokio::test]
async fn health_endpoint_is_unauthenticated_and_returns_200() {
    let app = common::test_router(common::lazy_pool());
    let resp = app.oneshot(get("/health")).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
}

#[tokio::test]
async fn protected_route_without_token_returns_401() {
    let app = common::test_router(common::lazy_pool());
    let resp = app.oneshot(get("/api/languages")).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn protected_route_with_malformed_authorization_returns_401() {
    let app = common::test_router(common::lazy_pool());
    let req = Request::builder()
        .uri("/api/languages")
        .header("authorization", "NotBearer something")
        .body(Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn protected_route_with_garbage_token_returns_401() {
    let app = common::test_router(common::lazy_pool());
    let resp = app
        .oneshot(get_with_auth("/api/languages", "not-a-jwt"))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn token_with_unknown_kid_is_rejected() {
    let app = common::test_router(common::lazy_pool());
    let token = common::mint_token_with_kid(
        "00000000-0000-0000-0000-000000000001",
        "nonexistent-kid",
    );
    let resp = app
        .oneshot(get_with_auth("/api/languages", &token))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn token_with_wrong_issuer_is_rejected() {
    let app = common::test_router(common::lazy_pool());
    let token = common::mint_token_with_issuer(
        "00000000-0000-0000-0000-000000000001",
        "https://attacker.example.com/auth/v1",
    );
    let resp = app
        .oneshot(get_with_auth("/api/languages", &token))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn expired_token_is_rejected() {
    let app = common::test_router(common::lazy_pool());
    let token = common::mint_expired_token("00000000-0000-0000-0000-000000000001");
    let resp = app
        .oneshot(get_with_auth("/api/languages", &token))
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
}
