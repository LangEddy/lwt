import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { UserLanguageSettings } from "../types";

interface UpdateLanguageSettingsPayload {
  tts_voice?: string;
  dictionary_url?: string;
  is_favorite?: boolean;
}

const settingsKey = (languageId?: string) =>
  ["language-settings", languageId ?? null] as const;

export function useLanguageSettings(languageId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: settingsKey(languageId),
    queryFn: () =>
      api.get<UserLanguageSettings>(`/api/languages/${languageId}/settings`),
    enabled: Boolean(languageId),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateLanguageSettingsPayload) => {
      if (!languageId) {
        throw new Error("No language selected");
      }
      return api.put<UserLanguageSettings>(
        `/api/languages/${languageId}/settings`,
        payload,
      );
    },
    onSuccess: (next) => {
      queryClient.setQueryData(settingsKey(languageId), next);
    },
  });

  return {
    settings: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    updateSettings: (payload: UpdateLanguageSettingsPayload) =>
      updateMutation.mutateAsync(payload),
  };
}
