import { useCallback, useState } from "react";
import { api } from "../lib/api";
import type { Example } from "../types";

export function useExamples(wordId?: string) {
  const [examples, setExamples] = useState<Example[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExamples = useCallback(() => {
    if (!wordId) return;
    setLoading(true);
    api
      .get<Example[]>(`/api/words/${wordId}/examples`)
      .then((data) => {
        setExamples(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [wordId]);

  const createExample = useCallback(
    async (example: {
      sentence: string;
      translation?: string;
      note?: string;
    }) => {
      if (!wordId) throw new Error("No word selected");
      const newExample = await api.post<Example>(
        `/api/words/${wordId}/examples`,
        example,
      );
      setExamples((prev) => [newExample, ...prev]);
      return newExample;
    },
    [wordId],
  );

  const updateExample = useCallback(
    async (
      id: string,
      updates: {
        sentence?: string;
        translation?: string;
        note?: string;
      },
    ) => {
      const updated = await api.put<Example>(`/api/examples/${id}`, updates);
      setExamples((prev) => prev.map((e) => (e.id === id ? updated : e)));
      return updated;
    },
    [],
  );

  const deleteExample = useCallback(async (id: string) => {
    await api.delete(`/api/examples/${id}`);
    setExamples((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return {
    examples,
    loading,
    error,
    fetchExamples,
    createExample,
    updateExample,
    deleteExample,
  };
}
