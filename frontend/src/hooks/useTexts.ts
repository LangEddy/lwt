import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Text } from "../types";

const TEXTS_KEY = ["texts"] as const;

export function useTexts() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: TEXTS_KEY,
    queryFn: () => api.get<Text[]>("/api/texts"),
  });

  const createText = useMutation({
    mutationFn: (text: { language_id: string; title: string; content: string }) =>
      api.post<Text>("/api/texts", text),
    onSuccess: (newText) => {
      queryClient.setQueryData<Text[]>(TEXTS_KEY, (prev) =>
        prev ? [newText, ...prev] : [newText],
      );
    },
  }).mutateAsync;

  const updateText = useMutation({
    mutationFn: ({
      id,
      text,
    }: {
      id: string;
      text: Partial<{ language_id: string; title: string; content: string }>;
    }) => api.put<Text>(`/api/texts/${id}`, text),
    onSuccess: (updated) => {
      queryClient.setQueryData<Text[]>(TEXTS_KEY, (prev) =>
        prev?.map((t) => (t.id === updated.id ? updated : t)),
      );
    },
  }).mutateAsync;

  const deleteText = useMutation({
    mutationFn: (id: string) => api.delete(`/api/texts/${id}`),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Text[]>(TEXTS_KEY, (prev) =>
        prev?.filter((t) => t.id !== id),
      );
    },
  }).mutateAsync;

  return {
    texts: query.data ?? [],
    loading: query.isPending,
    error: query.error?.message ?? null,
    createText: (text: { language_id: string; title: string; content: string }) =>
      createText(text),
    updateText: (
      id: string,
      text: Partial<{ language_id: string; title: string; content: string }>,
    ) => updateText({ id, text }),
    deleteText,
  };
}
