import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  cacheText,
  listCachedTexts,
  removeCachedText,
  replaceCachedTexts,
} from "../db/texts";
import { api } from "../lib/api";
import type { Text, TextContentType } from "../types";

const TEXTS_KEY = ["texts"] as const;

interface TextInput {
  language_id: string;
  title: string;
  content: string;
  content_type?: TextContentType;
}

export function useTexts() {
  const queryClient = useQueryClient();
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({
    queryKey: TEXTS_KEY,
    queryFn: listCachedTexts,
  });

  useEffect(() => {
    let cancelled = false;

    const refreshTexts = async () => {
      setRefreshing(true);
      try {
        const texts = await api.get<Text[]>("/api/texts");
        const cachedTexts = await replaceCachedTexts(texts);
        if (cancelled) return;
        queryClient.setQueryData<Text[]>(TEXTS_KEY, cachedTexts);
        setRefreshError(null);
      } catch (err) {
        if (cancelled) return;
        const cachedTexts = await listCachedTexts();
        setRefreshError(
          cachedTexts.length === 0 && err instanceof Error ? err.message : null,
        );
      } finally {
        if (!cancelled) {
          setRefreshing(false);
        }
      }
    };

    const handleOnline = () => {
      void refreshTexts();
    };

    void refreshTexts();
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
    };
  }, [queryClient]);

  const createText = useMutation({
    mutationFn: (text: TextInput) => api.post<Text>("/api/texts", text),
    onSuccess: async (newText) => {
      await cacheText(newText);
      queryClient.setQueryData<Text[]>(TEXTS_KEY, (prev) => {
        const next = prev?.filter((text) => text.id !== newText.id) ?? [];
        return [newText, ...next];
      });
    },
  }).mutateAsync;

  const updateText = useMutation({
    mutationFn: ({ id, text }: { id: string; text: Partial<TextInput> }) =>
      api.put<Text>(`/api/texts/${id}`, text),
    onSuccess: async (updated) => {
      await cacheText(updated);
      queryClient.setQueryData<Text[]>(TEXTS_KEY, (prev) =>
        prev?.map((t) => (t.id === updated.id ? updated : t)),
      );
    },
  }).mutateAsync;

  const deleteText = useMutation({
    mutationFn: (id: string) => api.delete(`/api/texts/${id}`),
    onSuccess: async (_data, id) => {
      await removeCachedText(id);
      queryClient.setQueryData<Text[]>(TEXTS_KEY, (prev) =>
        prev?.filter((t) => t.id !== id),
      );
    },
  }).mutateAsync;

  return {
    texts: query.data ?? [],
    loading: query.isPending || (refreshing && (query.data?.length ?? 0) === 0),
    error: query.error?.message ?? refreshError,
    createText: (text: TextInput) => createText(text),
    updateText: (id: string, text: Partial<TextInput>) =>
      updateText({ id, text }),
    deleteText,
  };
}
