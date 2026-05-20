import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import {
  cacheExample,
  listCachedExamples,
  removeCachedExample,
  replaceCachedExamples,
} from "../db/examples";
import { api } from "../lib/api";
import {
  createExampleOfflineFirst,
  deleteExampleOfflineFirst,
  type ExampleInput,
  type ExampleUpdates,
  isLocalRecordId,
  updateExampleOfflineFirst,
} from "../lib/offlineSync";
import type { Example } from "../types";

const examplesKey = (wordId?: string) => ["examples", wordId ?? null] as const;

export function useExamples(wordId?: string) {
  const queryClient = useQueryClient();
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({
    queryKey: examplesKey(wordId),
    queryFn: () => listCachedExamples(wordId),
    enabled: Boolean(wordId),
  });

  const fetchExamples = useCallback(async () => {
    if (!wordId || isLocalRecordId(wordId)) return;

    setRefreshing(true);
    try {
      const data = await api.get<Example[]>(`/api/words/${wordId}/examples`);
      const cached = await replaceCachedExamples(wordId, data);
      queryClient.setQueryData(examplesKey(wordId), cached);
      setRefreshError(null);
    } catch (err) {
      const cached = await listCachedExamples(wordId);
      setRefreshError(
        cached.length === 0 && err instanceof Error ? err.message : null,
      );
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, wordId]);

  useEffect(() => {
    if (!wordId) return;

    void fetchExamples();

    if (isLocalRecordId(wordId)) {
      return;
    }

    const handleOnline = () => {
      void fetchExamples();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [fetchExamples, wordId]);

  const createMutation = useMutation({
    mutationFn: (example: ExampleInput) => {
      if (!wordId) throw new Error("No word selected");
      return createExampleOfflineFirst(wordId, example);
    },
    onSuccess: async (newExample) => {
      await cacheExample(newExample);
      queryClient.setQueryData<Example[]>(examplesKey(wordId), (prev) => {
        const next =
          prev?.filter((example) => example.id !== newExample.id) ?? [];
        return [newExample, ...next];
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: ExampleUpdates }) =>
      updateExampleOfflineFirst(id, updates),
    onSuccess: async (updated) => {
      await cacheExample(updated);
      queryClient.setQueryData<Example[]>(examplesKey(wordId), (prev) =>
        prev?.map((example) => (example.id === updated.id ? updated : example)),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteExampleOfflineFirst,
    onSuccess: async (_data, id) => {
      await removeCachedExample(id);
      queryClient.setQueryData<Example[]>(examplesKey(wordId), (prev) =>
        prev?.filter((example) => example.id !== id),
      );
    },
  });

  return {
    examples: query.data ?? [],
    loading:
      Boolean(wordId) &&
      (query.isPending || (refreshing && (query.data?.length ?? 0) === 0)),
    error: query.error?.message ?? refreshError,
    fetchExamples,
    createExample: (example: ExampleInput) =>
      createMutation.mutateAsync(example),
    updateExample: (id: string, updates: ExampleUpdates) =>
      updateMutation.mutateAsync({ id, updates }),
    deleteExample: (id: string) => deleteMutation.mutateAsync(id),
  };
}
