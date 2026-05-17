import type { Text } from "../types";
import { db } from "./localDb";

function compareTextsByUpdatedAt(a: Text, b: Text) {
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

function sortTexts(items: Text[]) {
  return [...items].sort(compareTextsByUpdatedAt);
}

async function upsertTextState(textIds: string[], lastSyncedAt: number) {
  if (textIds.length === 0) return;

  const existingStates = await db.textState.bulkGet(textIds);
  await db.textState.bulkPut(
    textIds.map((textId, index) => ({
      text_id: textId,
      last_opened_at: existingStates[index]?.last_opened_at,
      last_synced_at: lastSyncedAt,
      is_pinned: existingStates[index]?.is_pinned ?? false,
    })),
  );
}

export async function listCachedTexts() {
  return sortTexts(await db.texts.toArray());
}

export async function getCachedText(textId: string) {
  return db.texts.get(textId);
}

export async function replaceCachedTexts(texts: Text[]) {
  const syncedAt = Date.now();
  const incomingIds = new Set(texts.map((text) => text.id));

  await db.transaction("rw", db.texts, db.textState, async () => {
    const existingTexts = await db.texts.toArray();
    const staleIds = existingTexts
      .map((text) => text.id)
      .filter((textId) => !incomingIds.has(textId));

    await db.texts.bulkPut(texts);

    if (staleIds.length > 0) {
      await db.texts.bulkDelete(staleIds);
      await db.textState.bulkDelete(staleIds);
    }

    await upsertTextState(
      texts.map((text) => text.id),
      syncedAt,
    );
  });

  return sortTexts(texts);
}

export async function cacheText(text: Text) {
  await db.transaction("rw", db.texts, db.textState, async () => {
    await db.texts.put(text);
    await upsertTextState([text.id], Date.now());
  });

  return text;
}

export async function removeCachedText(textId: string) {
  await db.transaction("rw", db.texts, db.textState, async () => {
    await db.texts.delete(textId);
    await db.textState.delete(textId);
  });
}

export async function markTextOpened(textId: string) {
  const existing = await db.textState.get(textId);
  await db.textState.put({
    text_id: textId,
    last_opened_at: Date.now(),
    last_synced_at: existing?.last_synced_at,
    is_pinned: existing?.is_pinned ?? false,
  });
}
