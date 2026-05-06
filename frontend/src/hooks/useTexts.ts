import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Text } from "../types";

export function useTexts() {
  const [texts, setTexts] = useState<Text[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTexts = useCallback(() => {
    setLoading(true);
    api
      .get<Text[]>("/api/texts")
      .then((data) => {
        setTexts(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTexts();
  }, [fetchTexts]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        fetchTexts();
      }
    };

    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [fetchTexts]);

  const createText = useCallback(
    async (text: { language_id: string; title: string; content: string }) => {
      const newText = await api.post<Text>("/api/texts", text);
      setTexts((prev) => [newText, ...prev]);
      return newText;
    },
    [],
  );

  const updateText = useCallback(
    async (
      id: string,
      text: Partial<{ language_id: string; title: string; content: string }>,
    ) => {
      const updated = await api.put<Text>(`/api/texts/${id}`, text);
      setTexts((prev) => prev.map((t) => (t.id === id ? updated : t)));
      return updated;
    },
    [],
  );

  const deleteText = useCallback(async (id: string) => {
    await api.delete(`/api/texts/${id}`);
    setTexts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    texts,
    loading,
    error,
    fetchTexts,
    createText,
    updateText,
    deleteText,
  };
}
