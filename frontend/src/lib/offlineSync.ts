import { type Card, createEmptyCard, fsrs, Rating, State } from "ts-fsrs";
import { cacheExample } from "../db/examples";
import { updateCachedLanguage } from "../db/languages";
import { db, type SyncEntity, type SyncRecord } from "../db/localDb";
import { cacheReviewMetadata, getCachedReview } from "../db/reviews";
import { cacheText, removeCachedText } from "../db/texts";
import { cacheWord } from "../db/words";
import { useAuthStore } from "../stores/authStore";
import type {
  DueReview,
  Example,
  Language,
  ReviewMetadata,
  Text,
  TextContentType,
  Word,
  WordLevel,
} from "../types";
import { api, ApiError } from "./api";

export interface TextInput {
  language_id: string;
  title: string;
  content: string;
  content_type?: TextContentType;
}

export interface WordInput {
  language_id: string;
  text_id?: string;
  word: string;
  is_phrase: boolean;
  level: WordLevel;
  note?: string;
}

export interface WordUpdates {
  level?: WordLevel;
  note?: string;
}

export interface ExampleInput {
  sentence: string;
  translation?: string;
  note?: string;
}

export interface ExampleUpdates {
  sentence?: string;
  translation?: string;
  note?: string;
}

const LOCAL_ID_PREFIX = "local:";
const reviewScheduler = fsrs();

let syncInFlight: Promise<boolean> | null = null;

interface QueuedReviewAnswer {
  example_id: string;
  rating: number;
  answered_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergePayload(existing: unknown, next: unknown) {
  if (isRecord(existing) && isRecord(next)) {
    return { ...existing, ...next };
  }

  return next;
}

function isQueuedReviewAnswer(value: unknown): value is QueuedReviewAnswer {
  return (
    isRecord(value) &&
    typeof value.example_id === "string" &&
    typeof value.rating === "number" &&
    typeof value.answered_at === "string"
  );
}

function nowIso() {
  return new Date().toISOString();
}

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function syncKey(entity: SyncEntity, recordId: string) {
  return `${entity}:${recordId}`;
}

function localId(entity: SyncEntity) {
  return `${LOCAL_ID_PREFIX}${entity}:${crypto.randomUUID()}`;
}

export function isLocalRecordId(value?: string | null) {
  return Boolean(value?.startsWith(LOCAL_ID_PREFIX));
}

function shouldQueueWriteError(error: unknown) {
  if (!isOnline()) return true;
  return !(error instanceof ApiError);
}

function formatSyncError(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Failed to sync offline change";
}

async function languageCodeFor(languageId: string, fallback = "") {
  const language = await db.languages.get(languageId);
  return language?.code ?? fallback;
}

function currentUserId() {
  return useAuthStore.getState().user?.id ?? "offline-user";
}

async function queueCreate(
  entity: SyncEntity,
  recordId: string,
  payload: unknown,
  parentRecordId?: string,
) {
  const id = syncKey(entity, recordId);
  const existing = await db.sync.get(id);

  const next: SyncRecord = {
    id,
    entity,
    record_id: recordId,
    operation: "create",
    status: "pending",
    payload: mergePayload(existing?.payload, payload),
    parent_record_id: parentRecordId ?? existing?.parent_record_id,
    modified_at: Date.now(),
  };

  await db.sync.put(next);
  return next;
}

async function queueUpdate(
  entity: SyncEntity,
  recordId: string,
  payload: unknown,
) {
  const id = syncKey(entity, recordId);
  const existing = await db.sync.get(id);

  if (existing?.operation === "delete") {
    return existing;
  }

  const next: SyncRecord = {
    id,
    entity,
    record_id: recordId,
    operation: existing?.operation === "create" ? "create" : "update",
    status: "pending",
    payload: mergePayload(existing?.payload, payload),
    parent_record_id: existing?.parent_record_id,
    modified_at: Date.now(),
  };

  await db.sync.put(next);
  return next;
}

async function queueDelete(entity: SyncEntity, recordId: string) {
  const id = syncKey(entity, recordId);
  const existing = await db.sync.get(id);

  if (existing?.operation === "create") {
    await db.sync.delete(id);
    return null;
  }

  const next: SyncRecord = {
    id,
    entity,
    record_id: recordId,
    operation: "delete",
    status: "pending",
    modified_at: Date.now(),
  };

  await db.sync.put(next);
  return next;
}

async function clearQueuedWrite(entity: SyncEntity, recordId: string) {
  await db.sync.delete(syncKey(entity, recordId));
}

function rewritePayloadReferences(
  payload: unknown,
  oldId: string,
  newId: string,
) {
  if (!isRecord(payload)) return payload;

  let changed = false;
  const next: Record<string, unknown> = { ...payload };

  if (next.text_id === oldId) {
    next.text_id = newId;
    changed = true;
  }

  if (next.word_id === oldId) {
    next.word_id = newId;
    changed = true;
  }

  if (next.example_id === oldId) {
    next.example_id = newId;
    changed = true;
  }

  return changed ? next : payload;
}

function mapReviewRating(rating: number) {
  switch (rating) {
    case 0:
      return Rating.Again;
    case 1:
      return Rating.Hard;
    case 2:
      return Rating.Good;
    case 3:
      return Rating.Easy;
    default:
      return Rating.Good;
  }
}

function buildReviewCard(review?: ReviewMetadata): Card {
  if (
    !review ||
    review.stability == null ||
    review.difficulty == null ||
    review.state == null ||
    review.scheduled_days == null ||
    review.reps == null ||
    review.lapses == null
  ) {
    return createEmptyCard();
  }

  return {
    due: review.next_review_at ? new Date(review.next_review_at) : new Date(),
    stability: review.stability,
    difficulty: review.difficulty,
    elapsed_days: review.scheduled_days,
    scheduled_days: review.scheduled_days,
    learning_steps: review.learning_steps ?? 0,
    reps: review.reps,
    lapses: review.lapses,
    state: review.state as State,
    last_review: review.last_reviewed_at
      ? new Date(review.last_reviewed_at)
      : undefined,
  };
}

function metadataFromAnsweredCard(
  card: Card,
  answeredAt: Date,
): ReviewMetadata {
  return {
    next_review_at: card.due.toISOString(),
    last_reviewed_at: answeredAt.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    state: card.state,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
  };
}

async function clearQueuedReviewAnswers(exampleId: string) {
  const queuedAnswers = (
    await db.sync.where("entity").equals("review").toArray()
  )
    .filter((record) => {
      if (record.parent_record_id === exampleId) {
        return true;
      }

      return isQueuedReviewAnswer(record.payload)
        ? record.payload.example_id === exampleId
        : false;
    })
    .map((record) => record.id);

  if (queuedAnswers.length > 0) {
    await db.sync.bulkDelete(queuedAnswers);
  }
}

async function rewriteQueuedReferences(oldId: string, newId: string) {
  const records = await db.sync.toArray();

  for (const record of records) {
    const nextPayload = rewritePayloadReferences(record.payload, oldId, newId);
    const nextParentRecordId =
      record.parent_record_id === oldId ? newId : record.parent_record_id;

    if (
      nextPayload === record.payload &&
      nextParentRecordId === record.parent_record_id
    ) {
      continue;
    }

    await db.sync.put({
      ...record,
      payload: nextPayload,
      parent_record_id: nextParentRecordId,
    });
  }
}

async function removeLocalExampleOnly(exampleId: string) {
  await db.examples.delete(exampleId);
  await db.spacedRepetition.where("example_id").equals(exampleId).delete();
  await clearQueuedReviewAnswers(exampleId);
  await clearQueuedWrite("example", exampleId);
}

async function removeLocalWordCascade(wordId: string) {
  const examples = await db.examples.where("word_id").equals(wordId).toArray();

  for (const example of examples) {
    await removeLocalExampleOnly(example.id);
  }

  await db.words.delete(wordId);
  await clearQueuedWrite("word", wordId);
}

async function removeLocalTextCascade(textId: string) {
  const words = await db.words.where("text_id").equals(textId).toArray();

  for (const word of words) {
    await removeLocalWordCascade(word.id);
  }

  await removeCachedText(textId);
  await clearQueuedWrite("text", textId);
}

async function replaceLocalTextId(oldId: string, nextText: Text) {
  await db.transaction(
    "rw",
    db.texts,
    db.textState,
    db.words,
    db.sync,
    async () => {
      const existingState = await db.textState.get(oldId);
      const dependentWords = await db.words
        .where("text_id")
        .equals(oldId)
        .toArray();

      await db.texts.delete(oldId);
      await db.texts.put(nextText);

      if (existingState) {
        await db.textState.delete(oldId);
        await db.textState.put({ ...existingState, text_id: nextText.id });
      }

      if (dependentWords.length > 0) {
        await db.words.bulkPut(
          dependentWords.map((word) => ({ ...word, text_id: nextText.id })),
        );
      }

      await db.sync.delete(syncKey("text", oldId));
      await rewriteQueuedReferences(oldId, nextText.id);
    },
  );
}

async function replaceLocalWordId(oldId: string, nextWord: Word) {
  await db.transaction("rw", db.words, db.examples, db.sync, async () => {
    const dependentExamples = await db.examples
      .where("word_id")
      .equals(oldId)
      .toArray();

    await db.words.delete(oldId);
    await db.words.put(nextWord);

    if (dependentExamples.length > 0) {
      await db.examples.bulkPut(
        dependentExamples.map((example) => ({
          ...example,
          word_id: nextWord.id,
        })),
      );
    }

    await db.sync.delete(syncKey("word", oldId));
    await rewriteQueuedReferences(oldId, nextWord.id);
  });
}

async function replaceLocalExampleId(oldId: string, nextExample: Example) {
  await db.transaction(
    "rw",
    db.examples,
    db.spacedRepetition,
    db.sync,
    async () => {
      const reviewRows = await db.spacedRepetition
        .where("example_id")
        .equals(oldId)
        .toArray();

      await db.examples.delete(oldId);
      await db.examples.put(nextExample);

      if (reviewRows.length > 0) {
        await db.spacedRepetition.bulkPut(
          reviewRows.map((review) => ({
            ...review,
            example_id: nextExample.id,
          })),
        );
      }

      await db.sync.delete(syncKey("example", oldId));
      await rewriteQueuedReferences(oldId, nextExample.id);
    },
  );
}

async function buildLocalText(input: TextInput): Promise<Text> {
  const timestamp = nowIso();

  return {
    id: localId("text"),
    user_id: useAuthStore.getState().user?.id,
    language_id: input.language_id,
    language_code: await languageCodeFor(input.language_id),
    title: input.title || "Untitled",
    content: input.content,
    content_type: input.content_type ?? "plain",
    created_at: timestamp,
    updated_at: timestamp,
  };
}

async function buildUpdatedText(
  existing: Text,
  updates: Partial<TextInput>,
): Promise<Text> {
  const languageId = updates.language_id ?? existing.language_id;

  return {
    ...existing,
    ...updates,
    language_id: languageId,
    language_code: await languageCodeFor(languageId, existing.language_code),
    updated_at: nowIso(),
  };
}

function buildLocalWord(input: WordInput): Word {
  const timestamp = nowIso();

  return {
    id: localId("word"),
    user_id: currentUserId(),
    language_id: input.language_id,
    text_id: input.text_id,
    word: input.word,
    is_phrase: input.is_phrase,
    level: input.level,
    note: input.note,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function buildUpdatedWord(existing: Word, updates: WordUpdates): Word {
  return {
    ...existing,
    ...updates,
    updated_at: nowIso(),
  };
}

function buildLocalExample(wordId: string, input: ExampleInput): Example {
  const timestamp = nowIso();

  return {
    id: localId("example"),
    word_id: wordId,
    sentence: input.sentence,
    translation: input.translation,
    note: input.note,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function buildUpdatedExample(
  existing: Example,
  updates: ExampleUpdates,
): Example {
  return {
    ...existing,
    ...updates,
    updated_at: nowIso(),
  };
}

export async function updateLanguageFavoriteOfflineFirst(
  languageId: string,
  isFavorite: boolean,
) {
  if (isOnline()) {
    try {
      await api.put(`/api/languages/${languageId}/settings`, {
        is_favorite: isFavorite,
      });
      const updated = await updateCachedLanguage(languageId, {
        is_favorite: isFavorite,
      });
      await clearQueuedWrite("language", languageId);
      return updated;
    } catch (error) {
      if (!shouldQueueWriteError(error)) {
        throw error;
      }
    }
  }

  const updated = await updateCachedLanguage(languageId, {
    is_favorite: isFavorite,
  });
  await queueUpdate("language", languageId, { is_favorite: isFavorite });
  return updated;
}

export async function createTextOfflineFirst(input: TextInput) {
  if (isOnline()) {
    try {
      const created = await api.post<Text>("/api/texts", input);
      await cacheText(created);
      return created;
    } catch (error) {
      if (!shouldQueueWriteError(error)) {
        throw error;
      }
    }
  }

  const local = await buildLocalText(input);
  await cacheText(local);
  await queueCreate("text", local.id, input);
  return local;
}

export async function updateTextOfflineFirst(
  id: string,
  updates: Partial<TextInput>,
) {
  const existing = await db.texts.get(id);
  if (!existing) {
    throw new Error("Text not found");
  }

  if (!isLocalRecordId(id) && isOnline()) {
    try {
      const updated = await api.put<Text>(`/api/texts/${id}`, updates);
      await cacheText(updated);
      await clearQueuedWrite("text", id);
      return updated;
    } catch (error) {
      if (!shouldQueueWriteError(error)) {
        throw error;
      }
    }
  }

  const next = await buildUpdatedText(existing, updates);
  await cacheText(next);
  await queueUpdate("text", id, updates);
  return next;
}

export async function deleteTextOfflineFirst(id: string) {
  if (!isLocalRecordId(id) && isOnline()) {
    try {
      await api.delete(`/api/texts/${id}`);
      await removeLocalTextCascade(id);
      return;
    } catch (error) {
      if (!shouldQueueWriteError(error)) {
        throw error;
      }
    }
  }

  await removeLocalTextCascade(id);
  await queueDelete("text", id);
}

export async function createWordOfflineFirst(input: WordInput) {
  if (!isLocalRecordId(input.text_id) && isOnline()) {
    try {
      const created = await api.post<Word>("/api/words", input);
      await cacheWord(created);
      return created;
    } catch (error) {
      if (!shouldQueueWriteError(error)) {
        throw error;
      }
    }
  }

  const local = buildLocalWord(input);
  await cacheWord(local);
  await queueCreate("word", local.id, input, input.text_id);
  return local;
}

export async function updateWordOfflineFirst(id: string, updates: WordUpdates) {
  const existing = await db.words.get(id);
  if (!existing) {
    throw new Error("Word not found");
  }

  if (!isLocalRecordId(id) && isOnline()) {
    try {
      const updated = await api.put<Word>(`/api/words/${id}`, updates);
      await cacheWord(updated);
      await clearQueuedWrite("word", id);
      return updated;
    } catch (error) {
      if (!shouldQueueWriteError(error)) {
        throw error;
      }
    }
  }

  const next = buildUpdatedWord(existing, updates);
  await cacheWord(next);
  await queueUpdate("word", id, updates);
  return next;
}

export async function deleteWordOfflineFirst(id: string) {
  if (!isLocalRecordId(id) && isOnline()) {
    try {
      await api.delete(`/api/words/${id}`);
      await removeLocalWordCascade(id);
      return;
    } catch (error) {
      if (!shouldQueueWriteError(error)) {
        throw error;
      }
    }
  }

  await removeLocalWordCascade(id);
  await queueDelete("word", id);
}

export async function createExampleOfflineFirst(
  wordId: string,
  input: ExampleInput,
) {
  if (!isLocalRecordId(wordId) && isOnline()) {
    try {
      const created = await api.post<Example>(
        `/api/words/${wordId}/examples`,
        input,
      );
      await cacheExample(created);
      return created;
    } catch (error) {
      if (!shouldQueueWriteError(error)) {
        throw error;
      }
    }
  }

  const local = buildLocalExample(wordId, input);
  await cacheExample(local);
  await queueCreate("example", local.id, input, wordId);
  return local;
}

export async function updateExampleOfflineFirst(
  id: string,
  updates: ExampleUpdates,
) {
  const existing = await db.examples.get(id);
  if (!existing) {
    throw new Error("Example not found");
  }

  if (!isLocalRecordId(id) && isOnline()) {
    try {
      const updated = await api.put<Example>(`/api/examples/${id}`, updates);
      await cacheExample(updated);
      await clearQueuedWrite("example", id);
      return updated;
    } catch (error) {
      if (!shouldQueueWriteError(error)) {
        throw error;
      }
    }
  }

  const next = buildUpdatedExample(existing, updates);
  await cacheExample(next);
  await queueUpdate("example", id, updates);
  return next;
}

export async function deleteExampleOfflineFirst(id: string) {
  if (!isLocalRecordId(id) && isOnline()) {
    try {
      await api.delete(`/api/examples/${id}`);
      await removeLocalExampleOnly(id);
      return;
    } catch (error) {
      if (!shouldQueueWriteError(error)) {
        throw error;
      }
    }
  }

  await removeLocalExampleOnly(id);
  await queueDelete("example", id);
}

export async function submitReviewAnswerOfflineFirst(
  card: DueReview,
  rating: number,
) {
  if (!Number.isInteger(rating) || rating < 0 || rating > 3) {
    throw new Error("Rating must be between 0 and 3");
  }

  const answeredAt = nowIso();

  if (!isLocalRecordId(card.example_id) && isOnline()) {
    try {
      const response = await api.post<{ review: ReviewMetadata }>(
        `/api/reviews/${card.example_id}/answer`,
        {
          rating,
          answered_at: answeredAt,
        },
      );

      await cacheReviewMetadata(card.example_id, response.review, card.sr_id);
      return response;
    } catch (error) {
      if (!shouldQueueWriteError(error)) {
        throw error;
      }
    }
  }

  const answeredAtDate = new Date(answeredAt);
  const nextCard = reviewScheduler.repeat(
    buildReviewCard(card),
    answeredAtDate,
  )[mapReviewRating(rating)].card;
  const review = metadataFromAnsweredCard(nextCard, answeredAtDate);
  const existingReview = await getCachedReview(card.example_id);

  await cacheReviewMetadata(
    card.example_id,
    review,
    card.sr_id ?? existingReview?.id,
  );
  await queueCreate(
    "review",
    localId("review"),
    {
      example_id: card.example_id,
      rating,
      answered_at: answeredAt,
    },
    card.example_id,
  );

  return { review };
}

function hasUnresolvedLocalReference(record: SyncRecord) {
  if (record.parent_record_id && isLocalRecordId(record.parent_record_id)) {
    return true;
  }

  if (!isRecord(record.payload)) return false;

  return (
    (typeof record.payload.text_id === "string" &&
      isLocalRecordId(record.payload.text_id)) ||
    (typeof record.payload.word_id === "string" &&
      isLocalRecordId(record.payload.word_id)) ||
    (typeof record.payload.example_id === "string" &&
      isLocalRecordId(record.payload.example_id))
  );
}

async function syncDeleteRecord(record: SyncRecord) {
  try {
    switch (record.entity) {
      case "text":
        await api.delete(`/api/texts/${record.record_id}`);
        break;
      case "word":
        await api.delete(`/api/words/${record.record_id}`);
        break;
      case "example":
        await api.delete(`/api/examples/${record.record_id}`);
        break;
      case "language":
      case "review":
        break;
    }
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }
  }

  await db.sync.delete(record.id);
}

async function syncUpdateRecord(record: SyncRecord) {
  switch (record.entity) {
    case "text": {
      const updated = await api.put<Text>(
        `/api/texts/${record.record_id}`,
        record.payload ?? {},
      );
      await cacheText(updated);
      break;
    }
    case "word": {
      const updated = await api.put<Word>(
        `/api/words/${record.record_id}`,
        record.payload ?? {},
      );
      await cacheWord(updated);
      break;
    }
    case "example": {
      const updated = await api.put<Example>(
        `/api/examples/${record.record_id}`,
        record.payload ?? {},
      );
      await cacheExample(updated);
      break;
    }
    case "language": {
      await api.put(
        `/api/languages/${record.record_id}/settings`,
        record.payload ?? {},
      );
      if (
        isRecord(record.payload) &&
        typeof record.payload.is_favorite === "boolean"
      ) {
        await updateCachedLanguage(record.record_id, {
          is_favorite: record.payload.is_favorite,
        } as Partial<Language>);
      }
      break;
    }
    case "review":
      throw new Error("Queued review answers must use create operations");
  }

  await db.sync.delete(record.id);
}

async function syncCreateRecord(record: SyncRecord) {
  switch (record.entity) {
    case "text": {
      const created = await api.post<Text>("/api/texts", record.payload ?? {});
      await replaceLocalTextId(record.record_id, created);
      break;
    }
    case "word": {
      const created = await api.post<Word>("/api/words", record.payload ?? {});
      await replaceLocalWordId(record.record_id, created);
      break;
    }
    case "example": {
      if (!record.parent_record_id) {
        throw new Error("Missing parent word id for queued example");
      }

      const created = await api.post<Example>(
        `/api/words/${record.parent_record_id}/examples`,
        record.payload ?? {},
      );
      await replaceLocalExampleId(record.record_id, created);
      break;
    }
    case "language":
      throw new Error("Language records cannot be created offline");
    case "review": {
      if (!isQueuedReviewAnswer(record.payload)) {
        throw new Error("Invalid queued review answer payload");
      }

      const response = await api.post<{ review: ReviewMetadata }>(
        `/api/reviews/${record.payload.example_id}/answer`,
        {
          rating: record.payload.rating,
          answered_at: record.payload.answered_at,
        },
      );

      const existingReview = await getCachedReview(record.payload.example_id);
      await cacheReviewMetadata(
        record.payload.example_id,
        response.review,
        existingReview?.id,
      );
      await db.sync.delete(record.id);
      break;
    }
  }
}

async function syncRecord(record: SyncRecord) {
  await db.sync.update(record.id, {
    status: "syncing",
    error: undefined,
  });

  try {
    if (record.operation === "delete") {
      await syncDeleteRecord(record);
      return true;
    }

    if (record.operation === "update") {
      await syncUpdateRecord(record);
      return true;
    }

    await syncCreateRecord(record);
    return true;
  } catch (error) {
    await db.sync.update(record.id, {
      status: "failed",
      error: formatSyncError(error),
      modified_at: Date.now(),
    });
    return false;
  }
}

async function runPendingSync() {
  if (!isOnline()) return false;

  let syncedAny = false;

  while (true) {
    const pending = (await db.sync.orderBy("modified_at").toArray()).filter(
      (record) => record.status !== "syncing",
    );

    if (pending.length === 0) {
      return syncedAny;
    }

    let progressed = false;

    for (const record of pending) {
      if (hasUnresolvedLocalReference(record)) {
        continue;
      }

      progressed = true;
      syncedAny = (await syncRecord(record)) || syncedAny;
    }

    if (!progressed) {
      return syncedAny;
    }
  }
}

export function syncPendingWrites() {
  if (syncInFlight) {
    return syncInFlight;
  }

  syncInFlight = runPendingSync().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}
