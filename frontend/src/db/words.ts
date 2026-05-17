import type { Word } from "../types";
import { db } from "./localDb";

function sortWords(items: Word[]) {
  return [...items].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export async function listCachedWords(languageId?: string | null) {
  if (languageId === undefined) return [];

  const words = languageId
    ? await db.words.where("language_id").equals(languageId).toArray()
    : await db.words.toArray();

  return sortWords(words);
}

export async function replaceCachedWords(
  words: Word[],
  languageId?: string | null,
) {
  if (languageId === undefined) return [];

  const incomingIds = new Set(words.map((word) => word.id));

  await db.transaction("rw", db.words, async () => {
    const scopedWords = languageId
      ? await db.words.where("language_id").equals(languageId).toArray()
      : await db.words.toArray();

    const staleIds = scopedWords
      .map((word) => word.id)
      .filter((wordId) => !incomingIds.has(wordId));

    await db.words.bulkPut(words);

    if (staleIds.length > 0) {
      await db.words.bulkDelete(staleIds);
    }
  });

  return sortWords(words);
}

export async function cacheWord(word: Word) {
  await db.words.put(word);
  return word;
}

export async function removeCachedWord(wordId: string) {
  await db.words.delete(wordId);
}
