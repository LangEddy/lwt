import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Example, SentenceItem } from "../types";

interface UpdateSentenceRequest {
  translation?: string;
  note?: string;
}

const sentencesKey = (languageId?: string | null) =>
  ["sentences", languageId ?? null] as const;

export function useSentences(languageId?: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: sentencesKey(languageId),
    queryFn: () => {
      const params = new URLSearchParams();
      if (languageId) params.set("language_id", languageId);
      const query = params.toString();
      const path = query ? `/api/examples?${query}` : "/api/examples";
      return api.get<SentenceItem[]>(path);
    },
  });

  const updateSentenceMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdateSentenceRequest;
    }) => api.put<Example>(`/api/examples/${id}`, updates),
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
    mutationFn: (id: string) => api.delete(`/api/examples/${id}`),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<SentenceItem[]>(
        sentencesKey(languageId),
        (prev) => prev?.filter((sentence) => sentence.id !== id),
      );
    },
  });

  return {
    sentences: query.data ?? [],
    loading: query.isPending,
    error: query.error?.message ?? null,
    updateSentence: (id: string, updates: UpdateSentenceRequest) =>
      updateSentenceMutation.mutateAsync({ id, updates }),
    deleteSentence: (id: string) => deleteSentenceMutation.mutateAsync(id),
  };
}
