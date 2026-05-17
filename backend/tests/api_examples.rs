//! Integration tests for /api/words/{id}/examples and /api/examples.

mod common;

use axum::http::StatusCode;
use chrono::{Duration, Utc};
use serde_json::json;
use uuid::Uuid;

use common::{
    cleanup_user, language_id_by_code, new_test_user, req_delete, req_get, req_post, req_put,
    seed_example, seed_word, send, test_router,
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
async fn create_example_under_owned_word() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let word_id = seed_word(&pool, user.id, lang, "rendezvous", 2).await;

    let (status, body) = send(
        &app,
        req_post(
            &format!("/api/words/{word_id}/examples"),
            &user.token,
            json!({
                "sentence": "Let's meet at the rendezvous point.",
                "translation": "Spotkajmy się w punkcie zbiórki.",
                "note": null,
            }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["sentence"], "Let's meet at the rendezvous point.");
    assert_eq!(body["word_id"], word_id.to_string());

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn create_example_under_other_users_word_returns_403() {
    let pool = require_db!();
    let alice = new_test_user();
    let bob = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let alice_word = seed_word(&pool, alice.id, lang, "private", 1).await;

    let (status, _) = send(
        &app,
        req_post(
            &format!("/api/words/{alice_word}/examples"),
            &bob.token,
            json!({ "sentence": "x", "translation": null, "note": null }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    cleanup_user(&pool, alice.id).await;
    cleanup_user(&pool, bob.id).await;
}

#[tokio::test]
async fn create_example_under_nonexistent_word_returns_403() {
    let pool = require_db!();
    let user = new_test_user();
    let app = test_router(pool.clone());

    let (status, _) = send(
        &app,
        req_post(
            &format!("/api/words/{}/examples", Uuid::new_v4()),
            &user.token,
            json!({ "sentence": "x", "translation": null, "note": null }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn list_examples_under_owned_word() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let word_id = seed_word(&pool, user.id, lang, "ample", 1).await;
    seed_example(&pool, word_id, "first").await;
    seed_example(&pool, word_id, "second").await;

    let (status, body) = send(
        &app,
        req_get(&format!("/api/words/{word_id}/examples"), &user.token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body.as_array().unwrap().len(), 2);

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn list_examples_under_other_users_word_returns_403() {
    let pool = require_db!();
    let alice = new_test_user();
    let bob = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let alice_word = seed_word(&pool, alice.id, lang, "secret", 1).await;

    let (status, _) = send(
        &app,
        req_get(&format!("/api/words/{alice_word}/examples"), &bob.token),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    cleanup_user(&pool, alice.id).await;
    cleanup_user(&pool, bob.id).await;
}

#[tokio::test]
async fn list_sentences_filters_by_language() {
    let pool = require_db!();
    let user = new_test_user();
    let en = language_id_by_code(&pool, "en").await;
    let de = language_id_by_code(&pool, "de").await;
    let app = test_router(pool.clone());

    let en_word = seed_word(&pool, user.id, en, "english", 1).await;
    let de_word = seed_word(&pool, user.id, de, "deutsch", 1).await;
    seed_example(&pool, en_word, "an english sentence").await;
    seed_example(&pool, de_word, "ein deutscher satz").await;

    let (status, all) = send(&app, req_get("/api/examples", &user.token)).await;
    assert_eq!(status, StatusCode::OK, "body={all}");
    assert_eq!(all.as_array().unwrap().len(), 2);

    let (status, only_en) = send(
        &app,
        req_get(&format!("/api/examples?language_id={en}"), &user.token),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "body={only_en}");
    let arr = only_en.as_array().unwrap();
    assert_eq!(arr.len(), 1);
    assert_eq!(arr[0]["language_code"], "en");

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn list_sentences_only_returns_calling_users_rows() {
    let pool = require_db!();
    let alice = new_test_user();
    let bob = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());

    let alice_word = seed_word(&pool, alice.id, lang, "alice-word", 1).await;
    let bob_word = seed_word(&pool, bob.id, lang, "bob-word", 1).await;
    seed_example(&pool, alice_word, "alice-sentence").await;
    seed_example(&pool, bob_word, "bob-sentence").await;

    let (status, body) = send(&app, req_get("/api/examples", &alice.token)).await;
    assert_eq!(status, StatusCode::OK, "body={body}");
    let sentences: Vec<&str> = body
        .as_array()
        .unwrap()
        .iter()
        .map(|e| e["sentence"].as_str().unwrap())
        .collect();
    assert_eq!(sentences, vec!["alice-sentence"]);

    cleanup_user(&pool, alice.id).await;
    cleanup_user(&pool, bob.id).await;
}

#[tokio::test]
async fn list_sentences_projects_fsrs_native_review_metadata() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());

    let word_id = seed_word(&pool, user.id, lang, "native-review", 1).await;
    let example_id = seed_example(&pool, word_id, "native review sentence").await;

    sqlx::query(
        "INSERT INTO spaced_repetition (example_id, interval, repetitions, ease_factor, next_review_at, last_reviewed_at) VALUES ($1, 4, 2, 2.5, $2, $3)",
    )
    .bind(example_id)
    .bind(Utc::now() + Duration::days(4))
    .bind(Utc::now() - Duration::days(2))
    .execute(&pool)
    .await
    .unwrap();

    let (status, body) = send(&app, req_get("/api/examples", &user.token)).await;
    assert_eq!(status, StatusCode::OK);

    let sentence = body
        .as_array()
        .unwrap()
        .iter()
        .find(|item| item["id"].as_str() == Some(&example_id.to_string()))
        .unwrap();

    assert_eq!(sentence["state"], 2);
    assert_eq!(sentence["scheduled_days"], 4);
    assert_eq!(sentence["reps"], 2);
    assert!(sentence["next_review_at"].as_str().is_some());
    assert!(sentence.get("repetitions").is_none());

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn update_example_other_users_returns_403() {
    let pool = require_db!();
    let alice = new_test_user();
    let bob = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let alice_word = seed_word(&pool, alice.id, lang, "owned", 1).await;
    let example_id = seed_example(&pool, alice_word, "alice's sentence").await;

    let (status, _) = send(
        &app,
        req_put(
            &format!("/api/examples/{example_id}"),
            &bob.token,
            json!({ "sentence": "hijacked" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    cleanup_user(&pool, alice.id).await;
    cleanup_user(&pool, bob.id).await;
}

#[tokio::test]
async fn delete_example_own_succeeds() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let word_id = seed_word(&pool, user.id, lang, "word", 1).await;
    let example_id = seed_example(&pool, word_id, "to delete").await;

    let (status, body) = send(
        &app,
        req_delete(&format!("/api/examples/{example_id}"), &user.token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["deleted"], true);

    cleanup_user(&pool, user.id).await;
}
