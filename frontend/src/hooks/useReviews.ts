import { useCallback, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { SpacedRepetition } from "../types";

export interface DueReview {
  sr_id?: string;
  example_id: string;
  sentence: string;
  translation?: string;
  example_note?: string;
  word_id: string;
  word: string;
  word_level: number;
  word_note?: string;
  language_code: string;
  language_direction: string;
  interval?: number;
  repetitions?: number;
  ease_factor?: number;
}

export interface AnswerResponse {
  sr: SpacedRepetition;
  interval: number;
  repetitions: number;
  ease_factor: number;
}

interface ExampleResponse {
  translation?: string | null;
}

interface DeleteExampleResponse {
  deleted: boolean;
}

export function useReviews() {
  const [due, setDue] = useState<DueReview[]>([]);
  const [relearnQueue, setRelearnQueue] = useState<DueReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCards = useMemo(
    () => [...due, ...relearnQueue],
    [due, relearnQueue],
  );
  const totalCards = due.length + relearnQueue.length;

  const fetchDue = useCallback(() => {
    setLoading(true);
    api
      .get<DueReview[]>("/api/reviews/due")
      .then((data) => {
        setDue(data);
        setRelearnQueue([]);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const submitAnswer = useCallback(
    async (exampleId: string, rating: number): Promise<AnswerResponse> => {
      const res = await api.post<AnswerResponse>(
        `/api/reviews/${exampleId}/answer`,
        { rating },
      );

      // Remove from due if present; if Again, add to relearn queue
      setDue((prev) => {
        const card = prev.find((r) => r.example_id === exampleId);
        if (card && rating === 0) {
          setRelearnQueue((qPrev) => {
            if (qPrev.some((r) => r.example_id === exampleId)) return qPrev;
            return [...qPrev, card];
          });
        }
        return prev.filter((r) => r.example_id !== exampleId);
      });

      // Handle relearn queue: Again → move to end; Hard/Good/Easy → remove
      setRelearnQueue((prev) => {
        const inQueue = prev.some((r) => r.example_id === exampleId);
        if (!inQueue) return prev;
        if (rating === 0) {
          const card = prev.find((r) => r.example_id === exampleId)!;
          return [...prev.filter((r) => r.example_id !== exampleId), card];
        }
        return prev.filter((r) => r.example_id !== exampleId);
      });

      return res;
    },
    [],
  );

  const updateCardTranslation = useCallback(
    async (exampleId: string, translation: string) => {
      const updated = await api.put<ExampleResponse>(
        `/api/examples/${exampleId}`,
        {
          translation,
        },
      );

      const nextTranslation = updated.translation?.trim() || undefined;
      const applyTranslation = (cards: DueReview[]) =>
        cards.map((card) =>
          card.example_id === exampleId
            ? { ...card, translation: nextTranslation }
            : card,
        );

      setDue((prev) => applyTranslation(prev));
      setRelearnQueue((prev) => applyTranslation(prev));

      return nextTranslation;
    },
    [],
  );

  const removeCardExample = useCallback(async (exampleId: string) => {
    await api.delete<DeleteExampleResponse>(`/api/examples/${exampleId}`);

    const withoutExample = (cards: DueReview[]) =>
      cards.filter((card) => card.example_id !== exampleId);

    setDue((prev) => withoutExample(prev));
    setRelearnQueue((prev) => withoutExample(prev));
  }, []);

  return {
    due,
    relearnQueue,
    activeCards,
    totalCards,
    loading,
    error,
    fetchDue,
    submitAnswer,
    updateCardTranslation,
    removeCardExample,
  };
}
