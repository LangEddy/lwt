import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Word, WordLevel } from "../types";

function normalizeWordKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase().normalize("NFC");
}

function pickMoreRecentWord(a: Word, b: Word) {
  return new Date(b.updated_at).getTime() >= new Date(a.updated_at).getTime()
    ? b
    : a;
}

function dedupeWords(items: Word[]) {
  const byKey = new Map<string, Word>();

  for (const item of items) {
    const key = normalizeWordKey(item.word);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    byKey.set(key, pickMoreRecentWord(existing, item));
  }

  return Array.from(byKey.values());
}

// languageId:
//   undefined  — don't fetch yet (e.g. waiting for text to load)
//   null       — fetch all words for the current user (dashboard)
//   string     — fetch words filtered to that language
export function useWords(languageId?: string | null) {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWords = useCallback(() => {
    // Don't fetch until we have a language context — avoids cross-language word collisions
    if (languageId === undefined) {
      setWords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams();
    if (languageId) params.set("language_id", languageId);

    const query = params.toString();
    const path = query ? `/api/words?${query}` : "/api/words";

    api
      .get<Word[]>(path)
      .then((data) => {
        setWords(dedupeWords(data));
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [languageId]);

  useEffect(() => {
    fetchWords();
  }, [fetchWords]);

  const createWord = useCallback(
    async (word: {
      language_id: string;
      text_id?: string;
      word: string;
      is_phrase: boolean;
      level: WordLevel;
      note?: string;
    }) => {
      const newWord = await api.post<Word>("/api/words", word);
      setWords((prev) => dedupeWords([...prev, newWord]));
      return newWord;
    },
    [],
  );

  const updateWord = useCallback(
    async (
      id: string,
      updates: {
        level?: WordLevel;
        note?: string;
      },
    ) => {
      const updated = await api.put<Word>(`/api/words/${id}`, updates);
      setWords((prev) =>
        dedupeWords(prev.map((w) => (w.id === id ? updated : w))),
      );
      return updated;
    },
    [],
  );

  const deleteWord = useCallback(async (id: string) => {
    await api.delete(`/api/words/${id}`);
    setWords((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const getWordByText = useCallback(
    (text: string): Word | undefined => {
      const normalized = normalizeWordKey(text);
      return words.find((w) => normalizeWordKey(w.word) === normalized);
    },
    [words],
  );

  return {
    words,
    loading,
    error,
    fetchWords,
    createWord,
    updateWord,
    deleteWord,
    getWordByText,
  };
}
