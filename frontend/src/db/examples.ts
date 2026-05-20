import type { Example, SentenceItem } from "../types";
import { db } from "./localDb";

function sortExamples(items: Example[]) {
  return [...items].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

function sortSentenceItems(items: SentenceItem[]) {
  return [...items].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export async function listCachedExamples(wordId?: string) {
  if (!wordId) return [];

  const examples = await db.examples.where("word_id").equals(wordId).toArray();
  return sortExamples(examples);
}

export async function replaceCachedExamples(
  wordId: string,
  examples: Example[],
) {
  const incomingIds = new Set(examples.map((example) => example.id));

  await db.transaction("rw", db.examples, async () => {
    const scopedExamples = await db.examples
      .where("word_id")
      .equals(wordId)
      .toArray();
    const staleIds = scopedExamples
      .map((example) => example.id)
      .filter((exampleId) => !incomingIds.has(exampleId));

    await db.examples.bulkPut(examples);

    if (staleIds.length > 0) {
      await db.examples.bulkDelete(staleIds);
    }
  });

  return sortExamples(examples);
}

export async function cacheExample(example: Example) {
  await db.examples.put(example);
  return example;
}

export async function cacheExamples(examples: Example[]) {
  if (examples.length === 0) return [];

  await db.examples.bulkPut(examples);
  return sortExamples(examples);
}

export async function removeCachedExample(exampleId: string) {
  await db.examples.delete(exampleId);
}

export async function listCachedSentenceItems(languageId?: string | null) {
  const [examples, words, languages, spacedRepetition] = await Promise.all([
    db.examples.toArray(),
    languageId
      ? db.words.where("language_id").equals(languageId).toArray()
      : db.words.toArray(),
    db.languages.toArray(),
    db.spacedRepetition.toArray(),
  ]);

  const wordById = new Map(words.map((word) => [word.id, word]));
  const languageById = new Map(
    languages.map((language) => [language.id, language]),
  );
  const reviewByExampleId = new Map(
    spacedRepetition.map((review) => [review.example_id, review]),
  );

  const items = examples.flatMap<SentenceItem>((example) => {
    const word = wordById.get(example.word_id);
    if (!word) return [];

    const language = languageById.get(word.language_id);
    const review = reviewByExampleId.get(example.id);

    return [
      {
        sr_id: review?.id,
        id: example.id,
        word_id: word.id,
        word: word.word,
        language_id: word.language_id,
        language_code: language?.code ?? "",
        sentence: example.sentence,
        translation: example.translation,
        note: example.note,
        next_review_at: review?.next_review_at ?? null,
        last_reviewed_at: review?.last_reviewed_at ?? null,
        stability: review?.stability ?? null,
        difficulty: review?.difficulty ?? null,
        state: review?.state ?? null,
        scheduled_days: review?.scheduled_days ?? null,
        learning_steps: review?.learning_steps ?? null,
        reps: review?.reps ?? null,
        lapses: review?.lapses ?? null,
        created_at: example.created_at,
        updated_at: example.updated_at,
      },
    ];
  });

  return sortSentenceItems(items);
}
