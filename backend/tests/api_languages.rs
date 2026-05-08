//! Integration tests for /api/languages and language settings.

mod common;

use axum::http::StatusCode;
use serde_json::json;

use common::{
    cleanup_user, language_id_by_code, new_test_user, req_get, req_put, send, test_router,
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
async fn list_languages_returns_seeded_set_with_favorite_flag() {
    let pool = require_db!();
    let user = new_test_user();
    let app = test_router(pool.clone());

    let (status, body) = send(&app, req_get("/api/languages", &user.token)).await;
    assert_eq!(status, StatusCode::OK);

    let langs = body.as_array().unwrap();
    // 15 platform languages are seeded by migration.
    assert_eq!(langs.len(), 15);
    // No favorites set yet → all false.
    assert!(langs.iter().all(|l| l["is_favorite"] == false));
    // No CEFR preferences set yet.
    assert!(langs.iter().all(|l| {
        l["target_cefr_levels"]
            .as_array()
            .is_some_and(|arr| arr.is_empty())
    }));

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn get_settings_returns_defaults_without_inserting() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "fr").await;
    let app = test_router(pool.clone());

    let (status, body) = send(
        &app,
        req_get(&format!("/api/languages/{lang}/settings"), &user.token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["tts_voice"], serde_json::Value::Null);
    assert_eq!(body["dictionary_url"], serde_json::Value::Null);
    assert_eq!(body["is_favorite"], false);
    assert_eq!(body["target_cefr_levels"], json!([]));

    // Confirm no row was inserted.
    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM user_language_settings WHERE user_id = $1 AND language_id = $2",
    )
    .bind(user.id)
    .bind(lang)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count.0, 0);

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn update_settings_inserts_then_updates() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "es").await;
    let app = test_router(pool.clone());

    let (status, body) = send(
        &app,
        req_put(
            &format!("/api/languages/{lang}/settings"),
            &user.token,
            json!({
                "tts_voice": "es-ES-Standard-A",
                "dictionary_url": "https://dict.example.com/?q={word}",
                "is_favorite": true,
                "target_cefr_levels": ["A2", "B1"],
            }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["tts_voice"], "es-ES-Standard-A");
    assert_eq!(body["is_favorite"], true);
    assert_eq!(body["target_cefr_levels"], json!(["A2", "B1"]));

    // Update only is_favorite — others should be preserved.
    let (status, body) = send(
        &app,
        req_put(
            &format!("/api/languages/{lang}/settings"),
            &user.token,
            json!({ "is_favorite": false }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["is_favorite"], false);
    assert_eq!(body["tts_voice"], "es-ES-Standard-A");
    assert_eq!(body["dictionary_url"], "https://dict.example.com/?q={word}");
    assert_eq!(body["target_cefr_levels"], json!(["A2", "B1"]));

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn update_settings_empty_string_clears_value() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "it").await;
    let app = test_router(pool.clone());

    send(
        &app,
        req_put(
            &format!("/api/languages/{lang}/settings"),
            &user.token,
            json!({ "tts_voice": "some-voice" }),
        ),
    )
    .await;

    let (status, body) = send(
        &app,
        req_put(
            &format!("/api/languages/{lang}/settings"),
            &user.token,
            json!({ "tts_voice": "" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["tts_voice"], serde_json::Value::Null);

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn update_settings_rejects_invalid_dictionary_url() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "ja").await;
    let app = test_router(pool.clone());

    let (status, _) = send(
        &app,
        req_put(
            &format!("/api/languages/{lang}/settings"),
            &user.token,
            json!({ "dictionary_url": "https://dict.example.com/no-placeholder" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn update_settings_rejects_invalid_target_cefr_levels() {
    let pool = require_db!();
    let user = new_test_user();
    let lang = language_id_by_code(&pool, "ja").await;
    let app = test_router(pool.clone());

    let (status, _) = send(
        &app,
        req_put(
            &format!("/api/languages/{lang}/settings"),
            &user.token,
            json!({ "target_cefr_levels": ["Z9"] }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn favorite_language_floats_to_top_of_list() {
    let pool = require_db!();
    let user = new_test_user();
    let zh = language_id_by_code(&pool, "zh").await;
    let app = test_router(pool.clone());

    send(
        &app,
        req_put(
            &format!("/api/languages/{zh}/settings"),
            &user.token,
            json!({ "is_favorite": true }),
        ),
    )
    .await;

    let (_, body) = send(&app, req_get("/api/languages", &user.token)).await;
    let langs = body.as_array().unwrap();
    assert_eq!(langs[0]["code"], "zh");
    assert_eq!(langs[0]["is_favorite"], true);

    cleanup_user(&pool, user.id).await;
}
