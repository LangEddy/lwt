import type {
  DueReview,
  ReviewMetadata,
  SentenceItem,
  SpacedRepetition,
} from "../types";
import { db } from "./localDb";

function sortDueReviews(items: DueReview[]) {
  return [...items].sort((a, b) => {
    const aNext = a.next_review_at
      ? new Date(a.next_review_at).getTime()
      : Number.NEGATIVE_INFINITY;
    const bNext = b.next_review_at
      ? new Date(b.next_review_at).getTime()
      : Number.NEGATIVE_INFINITY;

    if (aNext !== bNext) {
      return aNext - bNext;
    }

    return a.example_id.localeCompare(b.example_id);
  });
}

function hasReviewMetadata(review: ReviewMetadata) {
  return (
    review.next_review_at != null ||
    review.last_reviewed_at != null ||
    review.stability != null ||
    review.difficulty != null ||
    review.state != null ||
    review.scheduled_days != null ||
    review.learning_steps != null ||
    review.reps != null ||
    review.lapses != null
  );
}

function clampEaseFactor(value: number) {
  return Math.min(10, Math.max(1.3, value));
}

function defaultReviewId(exampleId: string) {
  return `review:${exampleId}`;
}

function buildStoredReview(
  exampleId: string,
  review: ReviewMetadata,
  reviewId?: string | null,
): SpacedRepetition {
  const scheduledDays = Math.max(review.scheduled_days ?? 1, 1);
  const repetitions = Math.max(review.reps ?? 0, 0);
  const easeFactor =
    review.stability != null && scheduledDays > 0
      ? clampEaseFactor(review.stability / scheduledDays)
      : 2.5;

  return {
    id: reviewId ?? defaultReviewId(exampleId),
    example_id: exampleId,
    interval: scheduledDays,
    repetitions,
    ease_factor: easeFactor,
    next_review_at: review.next_review_at ?? new Date().toISOString(),
    last_reviewed_at: review.last_reviewed_at ?? null,
    stability: review.stability ?? null,
    difficulty: review.difficulty ?? null,
    state: review.state ?? null,
    scheduled_days: review.scheduled_days ?? null,
    learning_steps: review.learning_steps ?? null,
    reps: review.reps ?? repetitions,
    lapses: review.lapses ?? 0,
  };
}

async function replaceReviewRow(next: SpacedRepetition) {
  const existing = await db.spacedRepetition
    .where("example_id")
    .equals(next.example_id)
    .toArray();
  const staleIds = existing
    .map((review) => review.id)
    .filter((id) => id !== next.id);

  await db.spacedRepetition.put(next);

  if (staleIds.length > 0) {
    await db.spacedRepetition.bulkDelete(staleIds);
  }

  return next;
}

function reviewMetadataFromStored(
  review?: SpacedRepetition,
): ReviewMetadata | undefined {
  if (!review) return undefined;

  return {
    next_review_at: review.next_review_at,
    last_reviewed_at: review.last_reviewed_at ?? null,
    stability: review.stability ?? null,
    difficulty: review.difficulty ?? null,
    state: review.state ?? null,
    scheduled_days: review.scheduled_days ?? null,
    learning_steps: review.learning_steps ?? null,
    reps: review.reps ?? null,
    lapses: review.lapses ?? null,
  };
}

export async function getCachedReview(exampleId: string) {
  return db.spacedRepetition.where("example_id").equals(exampleId).first();
}

export async function cacheReviewMetadata(
  exampleId: string,
  review: ReviewMetadata,
  reviewId?: string | null,
) {
  if (!hasReviewMetadata(review) || !review.next_review_at) {
    await db.spacedRepetition.where("example_id").equals(exampleId).delete();
    return null;
  }

  const existing = await getCachedReview(exampleId);
  const next = buildStoredReview(exampleId, review, reviewId ?? existing?.id);
  return replaceReviewRow(next);
}

export async function cacheSentenceReviewStates(items: SentenceItem[]) {
  for (const item of items) {
    if (!hasReviewMetadata(item) || !item.next_review_at) {
      continue;
    }

    await cacheReviewMetadata(item.id, item, item.sr_id);
  }
}

export async function cacheDueReviews(reviews: DueReview[]) {
  for (const review of reviews) {
    if (!hasReviewMetadata(review) || !review.next_review_at) {
      await db.spacedRepetition
        .where("example_id")
        .equals(review.example_id)
        .delete();
      continue;
    }

    await cacheReviewMetadata(review.example_id, review, review.sr_id);
  }

  return listCachedDueReviews();
}

export async function listCachedDueReviews() {
  const [examples, words, languages, reviews] = await Promise.all([
    db.examples.toArray(),
    db.words.toArray(),
    db.languages.toArray(),
    db.spacedRepetition.toArray(),
  ]);

  const now = Date.now();
  const wordById = new Map(words.map((word) => [word.id, word]));
  const languageById = new Map(
    languages.map((language) => [language.id, language]),
  );
  const reviewByExampleId = new Map(
    reviews.map((review) => [review.example_id, review]),
  );

  const dueCards = examples.flatMap<DueReview>((example) => {
    const word = wordById.get(example.word_id);
    if (!word) return [];

    const review = reviewByExampleId.get(example.id);
    if (review?.next_review_at) {
      const nextReviewAt = new Date(review.next_review_at).getTime();
      if (!Number.isNaN(nextReviewAt) && nextReviewAt > now) {
        return [];
      }
    }

    const language = languageById.get(word.language_id);
    const metadata = reviewMetadataFromStored(review);

    return [
      {
        sr_id: review?.id,
        example_id: example.id,
        sentence: example.sentence,
        translation: example.translation,
        example_note: example.note,
        word_id: word.id,
        word: word.word,
        word_level: word.level,
        word_note: word.note,
        language_code: language?.code ?? "",
        language_direction: language?.direction ?? "ltr",
        next_review_at: metadata?.next_review_at ?? null,
        last_reviewed_at: metadata?.last_reviewed_at ?? null,
        stability: metadata?.stability ?? null,
        difficulty: metadata?.difficulty ?? null,
        state: metadata?.state ?? null,
        scheduled_days: metadata?.scheduled_days ?? null,
        learning_steps: metadata?.learning_steps ?? null,
        reps: metadata?.reps ?? null,
        lapses: metadata?.lapses ?? null,
      },
    ];
  });

  return sortDueReviews(dueCards);
}
