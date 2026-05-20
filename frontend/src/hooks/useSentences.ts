import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { cacheExamples, listCachedSentenceItems } from "../db/examples";
import { cacheSentenceReviewStates } from "../db/reviews";
import { api } from "../lib/api";
import {
  deleteExampleOfflineFirst,
  type ExampleUpdates,
  updateExampleOfflineFirst,
} from "../lib/offlineSync";
import type { SentenceItem } from "../types";

interface UpdateSentenceRequest {
  translation?: string;
  note?: string;
}

const sentencesKey = (languageId?: string | null) =>
  ["sentences", languageId ?? null] as const;

export function useSentences(languageId?: string | null) {
  const queryClient = useQueryClient();
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({
    queryKey: sentencesKey(languageId),
    queryFn: () => listCachedSentenceItems(languageId),
  });

  useEffect(() => {
    let cancelled = false;

    const refreshSentences = async () => {
      setRefreshing(true);

      try {
        const params = new URLSearchParams();
        if (languageId) params.set("language_id", languageId);
        const queryString = params.toString();
        const path = queryString
          ? `/api/examples?${queryString}`
          : "/api/examples";
        const data = await api.get<SentenceItem[]>(path);

        await cacheExamples(
          data.map((item) => ({
            id: item.id,
            word_id: item.word_id,
            sentence: item.sentence,
            translation: item.translation,
            note: item.note,
            created_at: item.created_at,
            updated_at: item.updated_at,
          })),
        );
        await cacheSentenceReviewStates(data);

        if (cancelled) return;
        queryClient.setQueryData(sentencesKey(languageId), data);
        setRefreshError(null);
      } catch (err) {
        if (cancelled) return;
        const cached = await listCachedSentenceItems(languageId);
        setRefreshError(
          cached.length === 0 && err instanceof Error ? err.message : null,
        );
      } finally {
        if (!cancelled) {
          setRefreshing(false);
        }
      }
    };

    const handleOnline = () => {
      void refreshSentences();
    };

    void refreshSentences();
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
    };
  }, [languageId, queryClient]);

  const updateSentenceMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdateSentenceRequest;
    }) => updateExampleOfflineFirst(id, updates as ExampleUpdates),
    onSuccess: (updated, { id }) => {
      queryClient.setQueryData<SentenceItem[]>(
        sentencesKey(languageId),
        (prev) =>
          prev?.map((sentence) =>
            sentence.id === id ? { ...sentence, ...updated } : sentence,
          ),
      );
    },
  });

  const deleteSentenceMutation = useMutation({
    mutationFn: deleteExampleOfflineFirst,
    onSuccess: (_data, id) => {
      queryClient.setQueryData<SentenceItem[]>(
        sentencesKey(languageId),
        (prev) => prev?.filter((sentence) => sentence.id !== id),
      );
    },
  });

  return {
    sentences: query.data ?? [],
    loading: query.isPending || (refreshing && (query.data?.length ?? 0) === 0),
    error: query.error?.message ?? refreshError,
    updateSentence: (id: string, updates: UpdateSentenceRequest) =>
      updateSentenceMutation.mutateAsync({ id, updates }),
    deleteSentence: (id: string) => deleteSentenceMutation.mutateAsync(id),
  };
}
