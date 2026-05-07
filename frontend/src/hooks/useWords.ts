import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
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

  const query = useQuery({
    queryKey: wordsKey(languageId),
    queryFn: () => {
      const params = new URLSearchParams();
      if (languageId) params.set("language_id", languageId);
      const q = params.toString();
      const path = q ? `/api/words?${q}` : "/api/words";
      return api.get<Word[]>(path);
    },
    enabled: languageId !== undefined,
    select: dedupeWords,
  });

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
    onSuccess: (newWord) => {
      queryClient.setQueryData<Word[]>(wordsKey(languageId), (prev) =>
        prev ? [...prev, newWord] : [newWord],
      );
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
    onSuccess: (updated) => {
      queryClient.setQueryData<Word[]>(wordsKey(languageId), (prev) =>
        prev?.map((w) => (w.id === updated.id ? updated : w)),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/words/${id}`),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Word[]>(wordsKey(languageId), (prev) =>
        prev?.filter((w) => w.id !== id),
      );
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
    loading: query.isPending && languageId !== undefined,
    error: query.error?.message ?? null,
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
