//! Integration tests for /api/words.
//!
//! Skipped when DATABASE_URL is unset; in CI it's set to the postgres
//! service container declared in .github/workflows/ci.yml.

mod common;

use axum::http::StatusCode;
use serde_json::json;
use uuid::Uuid;

use common::{
    cleanup_user, language_id_by_code, new_test_user, req_delete, req_get, req_post, req_put,
    seed_word, send, test_router,
};

macro_rules! require_db {
    () => {
        match common::db_pool().await {
            Some(pool) => pool,
            None => {
                eprintln!("DATABASE_URL not set; skipping");
                return;
            }
        }
    };
}

#[tokio::test]
async fn create_word_happy_path() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());

    let (status, body) = send(
        &app,
        req_post(
            "/api/words",
            &user.token,
            json!({
                "language_id": lang,
                "text_id": null,
                "word": "ephemeral",
                "is_phrase": false,
                "level": 2,
                "note": "fancy word",
            }),
        ),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["word"], "ephemeral");
    assert_eq!(body["level"], 2);
    assert_eq!(body["user_id"], user.id.to_string());

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn create_word_with_invalid_level_returns_400() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());

    for bad in [0i16, 6, -1, 99] {
        let (status, _) = send(
            &app,
            req_post(
                "/api/words",
                &user.token,
                json!({
                    "language_id": lang,
                    "text_id": null,
                    "word": format!("word-{bad}"),
                    "is_phrase": false,
                    "level": bad,
                    "note": null,
                }),
            ),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "level={bad}");
    }

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn create_word_upserts_on_unique_conflict() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());

    let (s1, first) = send(
        &app,
        req_post(
            "/api/words",
            &user.token,
            json!({
                "language_id": lang,
                "text_id": null,
                "word": "Hello",
                "is_phrase": false,
                "level": 1,
                "note": "initial",
            }),
        ),
    )
    .await;
    assert_eq!(s1, StatusCode::OK);

    // Same lemma (case-insensitive) → should update existing row, not insert.
    let (s2, second) = send(
        &app,
        req_post(
            "/api/words",
            &user.token,
            json!({
                "language_id": lang,
                "text_id": null,
                "word": "hello",
                "is_phrase": false,
                "level": 4,
                "note": null,
            }),
        ),
    )
    .await;
    assert_eq!(s2, StatusCode::OK);
    assert_eq!(first["id"], second["id"]);
    assert_eq!(second["level"], 4);
    // COALESCE on note keeps prior value when new note is null.
    assert_eq!(second["note"], "initial");

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn list_words_filters_by_language_and_level() {
    let pool = require_db!();
    let user = new_test_user();
    let en = language_id_by_code(&pool, "en").await;
    let de = language_id_by_code(&pool, "de").await;
    let app = test_router(pool.clone());

    seed_word(&pool, user.id, en, "alpha", 1).await;
    seed_word(&pool, user.id, en, "beta", 3).await;
    seed_word(&pool, user.id, de, "gamma", 3).await;

    let (_, all) = send(&app, req_get("/api/words", &user.token)).await;
    assert_eq!(all.as_array().unwrap().len(), 3);

    let (_, en_only) = send(
        &app,
        req_get(&format!("/api/words?language_id={en}"), &user.token),
    )
    .await;
    assert_eq!(en_only.as_array().unwrap().len(), 2);

    let (_, level3) = send(&app, req_get("/api/words?level=3", &user.token)).await;
    assert_eq!(level3.as_array().unwrap().len(), 2);

    let (_, en_level3) = send(
        &app,
        req_get(&format!("/api/words?language_id={en}&level=3"), &user.token),
    )
    .await;
    let arr = en_level3.as_array().unwrap();
    assert_eq!(arr.len(), 1);
    assert_eq!(arr[0]["word"], "beta");

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn list_words_search_is_case_insensitive_substring() {
    let pool = require_db!();
    let user = new_test_user();
    let en = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());

    seed_word(&pool, user.id, en, "Photograph", 1).await;
    seed_word(&pool, user.id, en, "phone", 1).await;
    seed_word(&pool, user.id, en, "diagram", 1).await;

    let (_, hits) = send(&app, req_get("/api/words?search=PHO", &user.token)).await;
    let words: Vec<String> = hits
        .as_array()
        .unwrap()
        .iter()
        .map(|w| w["word"].as_str().unwrap().to_string())
        .collect();
    assert_eq!(words.len(), 2);
    assert!(words.iter().any(|w| w == "Photograph"));
    assert!(words.iter().any(|w| w == "phone"));

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn list_words_only_returns_calling_users_rows() {
    let pool = require_db!();
    let alice = new_test_user();
    let bob = new_test_user();
    let en = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());

    seed_word(&pool, alice.id, en, "alice-word", 1).await;
    seed_word(&pool, bob.id, en, "bob-word", 1).await;

    let (_, alice_list) = send(&app, req_get("/api/words", &alice.token)).await;
    let words: Vec<&str> = alice_list
        .as_array()
        .unwrap()
        .iter()
        .map(|w| w["word"].as_str().unwrap())
        .collect();
    assert_eq!(words, vec!["alice-word"]);

    cleanup_user(&pool, alice.id).await;
    cleanup_user(&pool, bob.id).await;
}

#[tokio::test]
async fn update_word_other_users_word_returns_403() {
    let pool = require_db!();
    let alice = new_test_user();
    let bob = new_test_user();
    let en = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());

    let alice_word = seed_word(&pool, alice.id, en, "secret", 1).await;

    let (status, _) = send(
        &app,
        req_put(
            &format!("/api/words/{alice_word}"),
            &bob.token,
            json!({ "level": 5, "note": "hacked" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    cleanup_user(&pool, alice.id).await;
    cleanup_user(&pool, bob.id).await;
}

#[tokio::test]
async fn update_word_invalid_level_returns_400() {
    let pool = require_db!();
    let user = new_test_user();
    let en = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let id = seed_word(&pool, user.id, en, "tame", 1).await;

    let (status, _) = send(
        &app,
        req_put(
            &format!("/api/words/{id}"),
            &user.token,
            json!({ "level": 9 }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn update_word_missing_returns_404() {
    let pool = require_db!();
    let user = new_test_user();
    let app = test_router(pool.clone());

    let (status, _) = send(
        &app,
        req_put(
            &format!("/api/words/{}", Uuid::new_v4()),
            &user.token,
            json!({ "level": 3 }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn delete_word_own_succeeds() {
    let pool = require_db!();
    let user = new_test_user();
    let en = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let id = seed_word(&pool, user.id, en, "doomed", 1).await;

    let (status, body) = send(&app, req_delete(&format!("/api/words/{id}"), &user.token)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["deleted"], true);

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn delete_other_users_word_returns_403() {
    let pool = require_db!();
    let alice = new_test_user();
    let bob = new_test_user();
    let en = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let alice_word = seed_word(&pool, alice.id, en, "mine", 1).await;

    let (status, _) = send(
        &app,
        req_delete(&format!("/api/words/{alice_word}"), &bob.token),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    cleanup_user(&pool, alice.id).await;
    cleanup_user(&pool, bob.id).await;
}
