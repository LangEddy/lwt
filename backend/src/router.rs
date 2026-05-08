use axum::{
    Router, middleware,
    routing::{delete, get, post, put},
};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use crate::{
    auth::auth_middleware,
    handlers::{examples, health::health_check, languages, reviews, roles, texts, trivia, words},
    state::AppState,
};

pub fn create_router(state: AppState) -> Router {
    let public_routes = Router::new().route("/health", get(health_check));

    let protected_routes = Router::new()
        .route("/api/languages", get(languages::list_languages))
        .route("/api/languages/{id}/settings", get(languages::get_settings))
        .route(
            "/api/languages/{id}/settings",
            put(languages::update_settings),
        )
        .route("/api/me/role", get(roles::get_my_role))
        .route("/api/users/{id}/role", get(roles::get_user_role))
        .route("/api/users/{id}/role", put(roles::upsert_user_role))
        .route("/api/texts", get(texts::list_texts))
        .route("/api/texts", post(texts::create_text))
        .route("/api/texts/{id}", get(texts::get_text))
        .route("/api/texts/{id}", put(texts::update_text))
        .route("/api/texts/{id}", delete(texts::delete_text))
        .route("/api/trivia", get(trivia::list_trivias))
        .route("/api/trivia/categories", get(trivia::list_categories))
        .route("/api/trivia/{id}", get(trivia::get_trivia))
        .route("/api/words", get(words::list_words))
        .route("/api/words", post(words::create_word))
        .route("/api/words/{id}", put(words::update_word))
        .route("/api/words/{id}", delete(words::delete_word))
        .route("/api/words/{id}/examples", get(examples::list_examples))
        .route("/api/words/{id}/examples", post(examples::create_example))
        .route("/api/examples", get(examples::list_sentences))
        .route("/api/examples/{id}", put(examples::update_example))
        .route("/api/examples/{id}", delete(examples::delete_example))
        .route("/api/reviews/due", get(reviews::list_due))
        .route(
            "/api/reviews/{example_id}/answer",
            post(reviews::submit_answer),
        )
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ));

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
