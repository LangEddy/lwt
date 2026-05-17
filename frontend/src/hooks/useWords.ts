import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cacheWord,
  listCachedWords,
  removeCachedWord,
  replaceCachedWords,
} from "../db/words";
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

const wordsKey = (languageId?: string | null) =>
  ["words", languageId ?? null] as const;

// languageId:
//   undefined  — don't fetch yet (e.g. waiting for text to load)
//   null       — fetch all words for the current user (dashboard)
//   string     — fetch words filtered to that language
export function useWords(languageId?: string | null) {
  const queryClient = useQueryClient();
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({
    queryKey: wordsKey(languageId),
    queryFn: () => listCachedWords(languageId),
    enabled: languageId !== undefined,
    select: dedupeWords,
  });

  useEffect(() => {
    if (languageId === undefined) return;

    let cancelled = false;

    const refreshWords = async () => {
      setRefreshing(true);

      try {
        const params = new URLSearchParams();
        if (languageId) params.set("language_id", languageId);
        const q = params.toString();
        const path = q ? `/api/words?${q}` : "/api/words";
        const words = await api.get<Word[]>(path);

        await replaceCachedWords(words, languageId);
        if (cancelled) return;
        setRefreshError(null);
        await queryClient.invalidateQueries({ queryKey: ["words"] });
      } catch (err) {
        if (cancelled) return;
        const cachedWords = await listCachedWords(languageId);
        setRefreshError(
          cachedWords.length === 0 && err instanceof Error ? err.message : null,
        );
      } finally {
        if (!cancelled) {
          setRefreshing(false);
        }
      }
    };

    const handleOnline = () => {
      void refreshWords();
    };

    void refreshWords();
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
    };
  }, [languageId, queryClient]);

  const words = useMemo(() => query.data ?? [], [query.data]);

  const createMutation = useMutation({
    mutationFn: (word: {
      language_id: string;
      text_id?: string;
      word: string;
      is_phrase: boolean;
      level: WordLevel;
      note?: string;
    }) => api.post<Word>("/api/words", word),
    onSuccess: async (newWord) => {
      await cacheWord(newWord);
      await queryClient.invalidateQueries({ queryKey: ["words"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: { level?: WordLevel; note?: string };
    }) => api.put<Word>(`/api/words/${id}`, updates),
    onSuccess: async (updated) => {
      await cacheWord(updated);
      await queryClient.invalidateQueries({ queryKey: ["words"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/words/${id}`),
    onSuccess: async (_data, id) => {
      await removeCachedWord(id);
      await queryClient.invalidateQueries({ queryKey: ["words"] });
    },
  });

  const getWordByText = useCallback(
    (text: string): Word | undefined => {
      const normalized = normalizeWordKey(text);
      return words.find((w) => normalizeWordKey(w.word) === normalized);
    },
    [words],
  );

  return {
    words,
    loading:
      languageId !== undefined &&
      (query.isPending || (refreshing && (query.data?.length ?? 0) === 0)),
    error: query.error?.message ?? refreshError,
    createWord: (word: {
      language_id: string;
      text_id?: string;
      word: string;
      is_phrase: boolean;
      level: WordLevel;
      note?: string;
    }) => createMutation.mutateAsync(word),
    updateWord: (id: string, updates: { level?: WordLevel; note?: string }) =>
      updateMutation.mutateAsync({ id, updates }),
    deleteWord: (id: string) => deleteMutation.mutateAsync(id),
    getWordByText,
  };
}
