import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { UserLanguageSettings } from "../types";

interface UpdateLanguageSettingsPayload {
  tts_voice?: string;
  dictionary_url?: string;
  is_favorite?: boolean;
}

export function useLanguageSettings(languageId?: string) {
  const [settings, setSettings] = useState<UserLanguageSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!languageId) {
      setSettings(null);
      return;
    }

    setLoading(true);
    try {
      const data = await api.get<UserLanguageSettings>(
        `/api/languages/${languageId}/settings`,
      );
      setSettings(data);
      setError(null);
      return data;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [languageId]);

  useEffect(() => {
    fetchSettings().catch(() => undefined);
  }, [fetchSettings]);

  const updateSettings = useCallback(
    async (payload: UpdateLanguageSettingsPayload) => {
      if (!languageId) {
        throw new Error("No language selected");
      }
      const next = await api.put<UserLanguageSettings>(
        `/api/languages/${languageId}/settings`,
        payload,
      );
      setSettings(next);
      setError(null);
      return next;
    },
    [languageId],
  );

  return { settings, loading, error, fetchSettings, updateSettings };
}
