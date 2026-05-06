export interface Language {
  id: string;
  code: string;
  name: string;
  direction: "ltr" | "rtl";
  is_platform: boolean;
  is_favorite: boolean;
  created_at: string;
}

export interface UserLanguageSettings {
  user_id: string;
  language_id: string;
  tts_voice?: string;
  dictionary_url?: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface Text {
  id: string;
  user_id?: string;
  language_id: string;
  language_code: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export type WordLevel = 1 | 2 | 3 | 4 | 5;

export interface Word {
  id: string;
  user_id: string;
  language_id: string;
  text_id?: string;
  word: string;
  is_phrase: boolean;
  level: WordLevel;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface Example {
  id: string;
  word_id: string;
  sentence: string;
  translation?: string;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface SpacedRepetition {
  id: string;
  example_id: string;
  interval: number;
  repetitions: number;
  ease_factor: number;
  next_review_at: string;
  last_reviewed_at?: string;
}
