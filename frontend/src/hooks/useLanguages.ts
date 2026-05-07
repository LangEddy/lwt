import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Language } from "../types";

const LANGUAGES_KEY = ["languages"] as const;

export function useLanguages() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: LANGUAGES_KEY,
    queryFn: () => api.get<Language[]>("/api/languages"),
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: ({
      languageId,
      isFavorite,
    }: {
      languageId: string;
      isFavorite: boolean;
    }) =>
      api.put(`/api/languages/${languageId}/settings`, {
        is_favorite: isFavorite,
      }),
    onSuccess: (_data, { languageId, isFavorite }) => {
      queryClient.setQueryData<Language[]>(LANGUAGES_KEY, (prev) =>
        prev?.map((l) =>
          l.id === languageId ? { ...l, is_favorite: isFavorite } : l,
        ),
      );
    },
  });

  return {
    languages: query.data ?? [],
    loading: query.isPending,
    error: query.error?.message ?? null,
    toggleFavorite: (languageId: string, isFavorite: boolean) =>
      toggleFavoriteMutation.mutateAsync({ languageId, isFavorite }),
  };
}
