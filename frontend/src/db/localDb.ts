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

const db = new Dexie("lwt-db") as Dexie & {
  languages: EntityTable<LocalLanguage, "id">;
  texts: EntityTable<LocalText, "id">;
  words: EntityTable<LocalWord, "id">;
  examples: EntityTable<LocalExample, "id">;
  spacedRepetition: EntityTable<LocalSpacedRepetition, "id">;
  sync: EntityTable<SyncRecord, "id">;
};

db.version(1).stores({
  languages: "id, code",
  texts: "id, user_id, language_id, updated_at",
  words: "id, user_id, language_id, text_id, level, updated_at",
  examples: "id, word_id, updated_at",
  spacedRepetition: "id, example_id, next_review_at",
  sync: "id, status, modified_at",
});

export { db };
export type { SyncRecord };
