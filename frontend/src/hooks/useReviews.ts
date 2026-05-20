import { useCallback, useEffect, useMemo, useState } from "react";
import { cacheDueReviews, listCachedDueReviews } from "../db/reviews";
import { api } from "../lib/api";
import {
  deleteExampleOfflineFirst,
  submitReviewAnswerOfflineFirst,
  updateExampleOfflineFirst,
} from "../lib/offlineSync";
import type { DueReview, ReviewMetadata } from "../types";

export type { DueReview } from "../types";

function isCardDue(card: DueReview, now: number) {
  if (!card.next_review_at) return true;

  const nextReviewAt = new Date(card.next_review_at).getTime();
  return Number.isNaN(nextReviewAt) || nextReviewAt <= now;
}

function byNextReview(a: DueReview, b: DueReview) {
  const aTs = a.next_review_at ? new Date(a.next_review_at).getTime() : 0;
  const bTs = b.next_review_at ? new Date(b.next_review_at).getTime() : 0;
  return aTs - bTs;
}

function mergeAnsweredCard(
  card: DueReview,
  response: AnswerResponse,
): DueReview {
  return {
    ...card,
    next_review_at: response.review.next_review_at ?? undefined,
    last_reviewed_at: response.review.last_reviewed_at ?? undefined,
    stability: response.review.stability ?? undefined,
    difficulty: response.review.difficulty ?? undefined,
    state: response.review.state ?? undefined,
    scheduled_days: response.review.scheduled_days ?? undefined,
    learning_steps: response.review.learning_steps ?? undefined,
    reps: response.review.reps ?? undefined,
    lapses: response.review.lapses ?? undefined,
  };
}

export interface AnswerResponse {
  review: ReviewMetadata;
}

export function useReviews() {
  const [due, setDue] = useState<DueReview[]>([]);
  const [relearnQueue, setRelearnQueue] = useState<DueReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const activeCards = useMemo(
    () =>
      [...due, ...relearnQueue.filter((card) => isCardDue(card, now))].sort(
        byNextReview,
      ),
    [due, relearnQueue, now],
  );
  const totalCards = activeCards.length;

  const fetchDue = useCallback(async () => {
    setLoading(true);

    try {
      const cached = await listCachedDueReviews();
      setDue(cached);
      setRelearnQueue([]);
      setError(null);

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return;
      }

      const data = await api.get<DueReview[]>("/api/reviews/due");
      const nextDue = await cacheDueReviews(data);
      setDue(nextDue);
      setRelearnQueue([]);
      setError(null);
    } catch (err) {
      const cached = await listCachedDueReviews();
      setDue(cached);
      setRelearnQueue([]);
      setError(
        cached.length === 0 && err instanceof Error ? err.message : null,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDue();

    const handleOnline = () => {
      void fetchDue();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [fetchDue]);

  const submitAnswer = useCallback(
    async (card: DueReview, rating: number): Promise<AnswerResponse> => {
      const res = await submitReviewAnswerOfflineFirst(card, rating);
      const nextCard = mergeAnsweredCard(card, res);
      setNow(Date.now());

      setDue((prev) => prev.filter((r) => r.example_id !== card.example_id));

      setRelearnQueue((prev) => {
        const filtered = prev.filter((r) => r.example_id !== card.example_id);
        if (rating === 0) {
          return [...filtered, nextCard].sort(byNextReview);
        }
        return filtered;
      });

      return res;
    },
    [],
  );

  const updateCardTranslation = useCallback(
    async (exampleId: string, translation: string) => {
      const updated = await updateExampleOfflineFirst(exampleId, {
        translation,
      });

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
    await deleteExampleOfflineFirst(exampleId);

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
