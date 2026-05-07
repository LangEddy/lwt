//! Integration tests for /api/reviews/due and /api/reviews/{id}/answer.

mod common;

use axum::http::StatusCode;
use chrono::{Duration, Utc};
use serde_json::json;
use uuid::Uuid;

use common::{
    cleanup_user, language_id_by_code, new_test_user, req_get, req_post, seed_example, seed_word,
    send, test_router,
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
async fn list_due_includes_examples_without_sr_row() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let word_id = seed_word(&pool, user.id, lang, "novel", 1).await;
    let example_id = seed_example(&pool, word_id, "Never reviewed yet.").await;

    let (status, body) = send(&app, req_get("/api/reviews/due", &user.token)).await;
    assert_eq!(status, StatusCode::OK);

    let arr = body.as_array().unwrap();
    assert_eq!(arr.len(), 1);
    assert_eq!(arr[0]["example_id"], example_id.to_string());
    assert_eq!(arr[0]["sr_id"], serde_json::Value::Null);

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn list_due_excludes_future_reviews_and_includes_past_due() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let word_id = seed_word(&pool, user.id, lang, "tense", 1).await;
    let due = seed_example(&pool, word_id, "due now").await;
    let later = seed_example(&pool, word_id, "due later").await;

    // Manually insert SR rows: one in the past, one in the future.
    sqlx::query(
        "INSERT INTO spaced_repetition (example_id, interval, repetitions, ease_factor, next_review_at) VALUES ($1, 1, 1, 2.5, $2)"
    )
    .bind(due)
    .bind(Utc::now() - Duration::days(1))
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO spaced_repetition (example_id, interval, repetitions, ease_factor, next_review_at) VALUES ($1, 6, 2, 2.5, $2)"
    )
    .bind(later)
    .bind(Utc::now() + Duration::days(5))
    .execute(&pool)
    .await
    .unwrap();

    let (_, body) = send(&app, req_get("/api/reviews/due", &user.token)).await;
    let ids: Vec<String> = body
        .as_array()
        .unwrap()
        .iter()
        .map(|e| e["example_id"].as_str().unwrap().to_string())
        .collect();
    assert!(ids.contains(&due.to_string()));
    assert!(!ids.contains(&later.to_string()));

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn list_due_is_scoped_to_calling_user() {
    let pool = require_db!();
    let alice = new_test_user();
    let bob = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let alice_word = seed_word(&pool, alice.id, lang, "alice", 1).await;
    seed_example(&pool, alice_word, "alice sentence").await;

    let (_, body) = send(&app, req_get("/api/reviews/due", &bob.token)).await;
    assert_eq!(body.as_array().unwrap().len(), 0);

    cleanup_user(&pool, alice.id).await;
    cleanup_user(&pool, bob.id).await;
}

#[tokio::test]
async fn submit_answer_creates_sr_row_on_first_review() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let word_id = seed_word(&pool, user.id, lang, "fresh", 1).await;
    let example_id = seed_example(&pool, word_id, "fresh sentence").await;

    let (status, body) = send(
        &app,
        req_post(
            &format!("/api/reviews/{example_id}/answer"),
            &user.token,
            json!({ "rating": 2 }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["repetitions"], 1);
    assert_eq!(body["interval"], 1);

    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM spaced_repetition WHERE example_id = $1",
    )
    .bind(example_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count.0, 1);

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn submit_answer_updates_existing_sr_row() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let word_id = seed_word(&pool, user.id, lang, "again", 1).await;
    let example_id = seed_example(&pool, word_id, "again sentence").await;

    // First answer creates the row.
    send(
        &app,
        req_post(
            &format!("/api/reviews/{example_id}/answer"),
            &user.token,
            json!({ "rating": 2 }),
        ),
    )
    .await;
    // Second answer should update, not duplicate.
    let (status, body) = send(
        &app,
        req_post(
            &format!("/api/reviews/{example_id}/answer"),
            &user.token,
            json!({ "rating": 2 }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["repetitions"], 2);
    assert_eq!(body["interval"], 6);

    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM spaced_repetition WHERE example_id = $1",
    )
    .bind(example_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count.0, 1);

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn submit_answer_again_schedules_within_minutes() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let word_id = seed_word(&pool, user.id, lang, "soon", 1).await;
    let example_id = seed_example(&pool, word_id, "again me").await;

    let (status, body) = send(
        &app,
        req_post(
            &format!("/api/reviews/{example_id}/answer"),
            &user.token,
            json!({ "rating": 0 }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let next: chrono::DateTime<Utc> =
        serde_json::from_value(body["sr"]["next_review_at"].clone()).unwrap();
    let delta = next - Utc::now();
    // 10 minutes ± slack for clock + DB round-trip.
    assert!(delta < Duration::minutes(15));
    assert!(delta > Duration::minutes(5));

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn submit_answer_with_invalid_rating_returns_400() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let word_id = seed_word(&pool, user.id, lang, "bound", 1).await;
    let example_id = seed_example(&pool, word_id, "x").await;

    for bad in [-1i32, 4, 99] {
        let (status, _) = send(
            &app,
            req_post(
                &format!("/api/reviews/{example_id}/answer"),
                &user.token,
                json!({ "rating": bad }),
            ),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "rating={bad}");
    }

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn submit_answer_for_other_users_example_returns_403() {
    let pool = require_db!();
    let alice = new_test_user();
    let bob = new_test_user();
    let lang = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());
    let alice_word = seed_word(&pool, alice.id, lang, "owned", 1).await;
    let alice_example = seed_example(&pool, alice_word, "alice's sentence").await;

    let (status, _) = send(
        &app,
        req_post(
            &format!("/api/reviews/{alice_example}/answer"),
            &bob.token,
            json!({ "rating": 2 }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    cleanup_user(&pool, alice.id).await;
    cleanup_user(&pool, bob.id).await;
}

#[tokio::test]
async fn submit_answer_for_missing_example_returns_403() {
    let pool = require_db!();
    let user = new_test_user();
    let app = test_router(pool.clone());

    let (status, _) = send(
        &app,
        req_post(
            &format!("/api/reviews/{}/answer", Uuid::new_v4()),
            &user.token,
            json!({ "rating": 2 }),
        ),
    )
    .await;
    // Handler treats missing-example as forbidden (no ownership info).
    assert_eq!(status, StatusCode::FORBIDDEN);

    cleanup_user(&pool, user.id).await;
}
