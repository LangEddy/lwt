//! Integration tests for /api/texts.

mod common;

use axum::http::StatusCode;
use serde_json::json;
use uuid::Uuid;

use common::{
    cleanup_user, language_id_by_code, new_test_user, req_delete, req_get, req_post, req_put,
    seed_text, send, test_router,
};

macro_rules! require_db {
    () => {
        match common::db_pool().await {
            Some(pool) => pool,
            None => return,
        }
    };
}

#[tokio::test]
async fn create_text_happy_path() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());

    let (status, body) = send(
        &app,
        req_post(
            "/api/texts",
            &user.token,
            json!({
                "language_id": lang,
                "title": "My Story",
                "content": "Once upon a time...",
            }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["title"], "My Story");
    assert_eq!(body["language_code"], "en");
    assert_eq!(body["user_id"], user.id.to_string());

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn list_texts_returns_own_and_platform_texts() {
    let pool = require_db!();
    let user = new_test_user();
    let other = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());

    let mine = seed_text(&pool, Some(user.id), lang, "Mine", "x").await;
    let _theirs = seed_text(&pool, Some(other.id), lang, "Theirs", "y").await;
    let platform = seed_text(&pool, None, lang, "Platform", "z").await;

    let (_, body) = send(&app, req_get("/api/texts", &user.token)).await;
    let ids: Vec<String> = body
        .as_array()
        .unwrap()
        .iter()
        .map(|t| t["id"].as_str().unwrap().to_string())
        .collect();

    assert!(ids.contains(&mine.to_string()));
    assert!(ids.contains(&platform.to_string()));
    assert!(!ids.iter().any(|id| id == &_theirs.to_string()));

    // Cleanup — also remove platform text and the other user's text.
    let _ = sqlx::query("DELETE FROM texts WHERE id = $1")
        .bind(platform)
        .execute(&pool)
        .await;
    cleanup_user(&pool, user.id).await;
    cleanup_user(&pool, other.id).await;
}

#[tokio::test]
async fn get_text_other_users_returns_404() {
    let pool = require_db!();
    let alice = new_test_user();
    let bob = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let alice_text = seed_text(&pool, Some(alice.id), lang, "Secret", "...").await;

    let (status, _) = send(
        &app,
        req_get(&format!("/api/texts/{alice_text}"), &bob.token),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    cleanup_user(&pool, alice.id).await;
    cleanup_user(&pool, bob.id).await;
}

#[tokio::test]
async fn get_platform_text_visible_to_any_user() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let pid = seed_text(&pool, None, lang, "Public", "shared").await;

    let (status, body) = send(&app, req_get(&format!("/api/texts/{pid}"), &user.token)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["title"], "Public");

    let _ = sqlx::query("DELETE FROM texts WHERE id = $1")
        .bind(pid)
        .execute(&pool)
        .await;
    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn update_text_other_users_returns_403() {
    let pool = require_db!();
    let alice = new_test_user();
    let bob = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let id = seed_text(&pool, Some(alice.id), lang, "Title", "Body").await;

    let (status, _) = send(
        &app,
        req_put(
            &format!("/api/texts/{id}"),
            &bob.token,
            json!({ "title": "Hijacked" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    cleanup_user(&pool, alice.id).await;
    cleanup_user(&pool, bob.id).await;
}

#[tokio::test]
async fn update_platform_text_returns_403() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let id = seed_text(&pool, None, lang, "Locked", "Body").await;

    let (status, _) = send(
        &app,
        req_put(
            &format!("/api/texts/{id}"),
            &user.token,
            json!({ "title": "Cannot edit" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    let _ = sqlx::query("DELETE FROM texts WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await;
    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn update_text_partial_keeps_unchanged_fields() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let id = seed_text(&pool, Some(user.id), lang, "Original", "BodyText").await;

    let (status, body) = send(
        &app,
        req_put(
            &format!("/api/texts/{id}"),
            &user.token,
            json!({ "title": "Renamed" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["title"], "Renamed");
    assert_eq!(body["content"], "BodyText");

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn delete_text_own_succeeds() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let id = seed_text(&pool, Some(user.id), lang, "T", "B").await;

    let (status, body) = send(&app, req_delete(&format!("/api/texts/{id}"), &user.token)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["deleted"], true);

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn delete_missing_text_returns_404() {
    let pool = require_db!();
    let user = new_test_user();
    let app = test_router(pool.clone());

    let (status, _) = send(
        &app,
        req_delete(&format!("/api/texts/{}", Uuid::new_v4()), &user.token),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    cleanup_user(&pool, user.id).await;
}
