import Dexie, { type EntityTable } from "dexie";
import type { Example, Language, SpacedRepetition, Text, Word } from "../types";

type LocalLanguage = Language;
type LocalText = Text;
type LocalWord = Word;
type LocalExample = Example;
type LocalSpacedRepetition = SpacedRepetition;

interface SyncRecord {
  id: string; // compound: "table:record_id"
  table: string;
  record_id: string;
  status: "clean" | "dirty" | "deleted";
  modified_at: number;
}

interface LocalTextState {
  text_id: string;
  last_opened_at?: number;
  last_synced_at?: number;
  is_pinned: boolean;
}

const db = new Dexie("lwt-db") as Dexie & {
  languages: EntityTable<LocalLanguage, "id">;
  texts: EntityTable<LocalText, "id">;
  words: EntityTable<LocalWord, "id">;
  examples: EntityTable<LocalExample, "id">;
  spacedRepetition: EntityTable<LocalSpacedRepetition, "id">;
  sync: EntityTable<SyncRecord, "id">;
  textState: EntityTable<LocalTextState, "text_id">;
};

db.version(1).stores({
  languages: "id, code",
  texts: "id, user_id, language_id, updated_at",
  words: "id, user_id, language_id, text_id, level, updated_at",
  examples: "id, word_id, updated_at",
  spacedRepetition: "id, example_id, next_review_at",
  sync: "id, status, modified_at",
});

db.version(2).stores({
  languages: "id, code",
  texts: "id, user_id, language_id, updated_at",
  words: "id, user_id, language_id, text_id, level, updated_at",
  examples: "id, word_id, updated_at",
  spacedRepetition: "id, example_id, next_review_at",
  sync: "id, status, modified_at",
  textState: "text_id, last_opened_at, last_synced_at, is_pinned",
});

export { db };
export type { LocalTextState, SyncRecord };
