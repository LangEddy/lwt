import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  listCachedLanguages,
  replaceCachedLanguages,
  updateCachedLanguage,
} from "../db/languages";
import { api } from "../lib/api";
import { updateLanguageFavoriteOfflineFirst } from "../lib/offlineSync";
import type { Language } from "../types";

const LANGUAGES_KEY = ["languages"] as const;

export function useLanguages() {
  const queryClient = useQueryClient();
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({
    queryKey: LANGUAGES_KEY,
    queryFn: listCachedLanguages,
  });

  useEffect(() => {
    let cancelled = false;

    const refreshLanguages = async () => {
      setRefreshing(true);

      try {
        const languages = await api.get<Language[]>("/api/languages");
        const cached = await replaceCachedLanguages(languages);
        if (cancelled) return;
        queryClient.setQueryData(LANGUAGES_KEY, cached);
        setRefreshError(null);
      } catch (err) {
        if (cancelled) return;
        const cached = await listCachedLanguages();
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
      void refreshLanguages();
    };

    void refreshLanguages();
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
    };
  }, [queryClient]);

  const toggleFavoriteMutation = useMutation({
    mutationFn: ({
      languageId,
      isFavorite,
    }: {
      languageId: string;
      isFavorite: boolean;
    }) => updateLanguageFavoriteOfflineFirst(languageId, isFavorite),
    onSuccess: async (updated, { languageId, isFavorite }) => {
      if (!updated) {
        await updateCachedLanguage(languageId, { is_favorite: isFavorite });
      }

      queryClient.setQueryData<Language[]>(LANGUAGES_KEY, (prev) =>
        prev?.map((l) =>
          l.id === languageId
            ? { ...l, is_favorite: updated?.is_favorite ?? isFavorite }
            : l,
        ),
      );
    },
  });

  return {
    languages: query.data ?? [],
    loading: query.isPending || (refreshing && (query.data?.length ?? 0) === 0),
    error: query.error?.message ?? refreshError,
    toggleFavorite: (languageId: string, isFavorite: boolean) =>
      toggleFavoriteMutation.mutateAsync({ languageId, isFavorite }),
  };
}
