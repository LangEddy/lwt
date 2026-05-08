//! Integration tests for /api/trivia endpoints.

mod common;

use axum::http::StatusCode;

use common::{
    cleanup_trivias, cleanup_user, language_id_by_code, new_test_user, req_get, seed_trivia, send,
    test_router,
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
async fn list_trivias_returns_only_published_rows() {
    let pool = require_db!();
    let user = new_test_user();
    let en = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());

    let visible = seed_trivia(
        &pool,
        en,
        "Visible trivia",
        Some("subtitle"),
        "public content",
        "science",
        "A2",
        "ltr",
        true,
    )
    .await;
    let hidden = seed_trivia(
        &pool,
        en,
        "Hidden trivia",
        None,
        "private content",
        "science",
        "A2",
        "ltr",
        false,
    )
    .await;

    let (status, body) = send(&app, req_get("/api/trivia", &user.token)).await;
    assert_eq!(status, StatusCode::OK);

    let ids: Vec<String> = body
        .as_array()
        .unwrap()
        .iter()
        .map(|row| row["id"].as_str().unwrap().to_string())
        .collect();

    assert!(ids.contains(&visible.to_string()));
    assert!(!ids.contains(&hidden.to_string()));

    cleanup_trivias(&pool, &[visible, hidden]).await;
    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn list_trivias_filters_by_language_level_category_and_search() {
    let pool = require_db!();
    let user = new_test_user();
    let en = language_id_by_code(&pool, "en").await;
    let es = language_id_by_code(&pool, "es").await;
    let app = test_router(pool.clone());

    let t1 = seed_trivia(
        &pool,
        en,
        "Blue Light",
        Some("Science notes"),
        "The sky looks blue because light scatters.",
        "science",
        "B1",
        "ltr",
        true,
    )
    .await;
    let t2 = seed_trivia(
        &pool,
        en,
        "Animal facts",
        None,
        "Cats sleep a lot.",
        "animals",
        "B1",
        "ltr",
        true,
    )
    .await;
    let t3 = seed_trivia(
        &pool,
        es,
        "Cielo azul",
        None,
        "La luz azul se dispersa.",
        "science",
        "B1",
        "ltr",
        true,
    )
    .await;

    let path = format!("/api/trivia?language_ids={en}&levels=B1&categories=science&search=blue");
    let (status, body) = send(&app, req_get(&path, &user.token)).await;
    assert_eq!(status, StatusCode::OK);

    let rows = body.as_array().unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0]["id"], t1.to_string());
    assert_eq!(rows[0]["category"], "science");
    assert_eq!(rows[0]["category_name"], "Science");
    assert!(
        rows[0]["category_icon_svg"]
            .as_str()
            .is_some_and(|svg| svg.starts_with("<svg"))
    );

    cleanup_trivias(&pool, &[t1, t2, t3]).await;
    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn list_trivia_categories_returns_seeded_rows() {
    let pool = require_db!();
    let user = new_test_user();
    let app = test_router(pool.clone());

    let (status, body) = send(&app, req_get("/api/trivia/categories", &user.token)).await;
    assert_eq!(status, StatusCode::OK);

    let rows = body.as_array().unwrap();
    assert!(rows.iter().any(|row| row["slug"] == "geography"));
    assert!(rows.iter().all(|row| {
        row["icon_svg"]
            .as_str()
            .is_some_and(|svg| svg.starts_with("<svg"))
    }));

    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn list_trivias_for_me_only_uses_favorites_and_target_levels() {
    let pool = require_db!();
    let user = new_test_user();
    let en = language_id_by_code(&pool, "en").await;
    let es = language_id_by_code(&pool, "es").await;
    let app = test_router(pool.clone());

    // Favorite EN with preferred level A2.
    sqlx::query(
        "INSERT INTO user_language_settings (user_id, language_id, is_favorite, target_cefr_levels) VALUES ($1, $2, true, $3)",
    )
    .bind(user.id)
    .bind(en)
    .bind(vec!["A2"])
    .execute(&pool)
    .await
    .unwrap();

    let match_id = seed_trivia(
        &pool,
        en,
        "EN A2 match",
        None,
        "content",
        "science",
        "A2",
        "ltr",
        true,
    )
    .await;
    let wrong_level = seed_trivia(
        &pool,
        en,
        "EN B1 mismatch",
        None,
        "content",
        "science",
        "B1",
        "ltr",
        true,
    )
    .await;
    let wrong_lang = seed_trivia(
        &pool,
        es,
        "ES A2 mismatch",
        None,
        "content",
        "science",
        "A2",
        "ltr",
        true,
    )
    .await;

    let (status, body) = send(&app, req_get("/api/trivia?for_me_only=true", &user.token)).await;
    assert_eq!(status, StatusCode::OK);

    let ids: Vec<String> = body
        .as_array()
        .unwrap()
        .iter()
        .map(|row| row["id"].as_str().unwrap().to_string())
        .collect();

    assert!(ids.contains(&match_id.to_string()));
    assert!(!ids.contains(&wrong_level.to_string()));
    assert!(!ids.contains(&wrong_lang.to_string()));

    cleanup_trivias(&pool, &[match_id, wrong_level, wrong_lang]).await;
    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn get_trivia_returns_404_for_unpublished_row() {
    let pool = require_db!();
    let user = new_test_user();
    let en = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());

    let hidden = seed_trivia(
        &pool, en, "Hidden", None, "content", "science", "A2", "ltr", false,
    )
    .await;

    let (status, _) = send(&app, req_get(&format!("/api/trivia/{hidden}"), &user.token)).await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    cleanup_trivias(&pool, &[hidden]).await;
    cleanup_user(&pool, user.id).await;
}

#[tokio::test]
async fn get_trivia_returns_published_row() {
    let pool = require_db!();
    let user = new_test_user();
    let en = language_id_by_code(&pool, "en").await;
    let app = test_router(pool.clone());

    let visible = seed_trivia(
        &pool,
        en,
        "Visible",
        Some("subtitle"),
        "content",
        "science",
        "A2",
        "ltr",
        true,
    )
    .await;

    let (status, body) = send(
        &app,
        req_get(&format!("/api/trivia/{visible}"), &user.token),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["id"], visible.to_string());
    assert_eq!(body["title"], "Visible");

    cleanup_trivias(&pool, &[visible]).await;
    cleanup_user(&pool, user.id).await;
}
