use icu_segmenter::WordSegmenter;
use serde::Serialize;
use wasm_bindgen::prelude::*;

#[derive(Serialize)]
pub struct Token {
    #[serde(rename = "type")]
    pub token_type: &'static str,
    pub value: String,
    pub index: usize,
}

#[wasm_bindgen]
pub fn tokenize(text: &str) -> JsValue {
    let segmenter = WordSegmenter::new_auto(Default::default());
    let breakpoints: Vec<usize> = segmenter.segment_str(text).collect();

    let mut tokens: Vec<Token> = Vec::new();
    let mut index: usize = 0;

    for window in breakpoints.windows(2) {
        let start = window[0];
        let end = window[1];
        let segment = &text[start..end];

        let token_type = if segment
            .chars()
            .next()
            .map(|c| c.is_alphabetic())
            .unwrap_or(false)
        {
            "word"
        } else {
            "separator"
        };

        tokens.push(Token {
            token_type,
            value: segment.to_string(),
            index,
        });
        index += 1;
    }

    serde_wasm_bindgen::to_value(&tokens).unwrap_or(JsValue::NULL)
}
