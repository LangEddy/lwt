import type { Language } from "../types";
import { db } from "./localDb";

function sortLanguages(items: Language[]) {
  return [...items].sort((a, b) => {
    if (a.is_favorite !== b.is_favorite) {
      return a.is_favorite ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });
}

export async function listCachedLanguages() {
  return sortLanguages(await db.languages.toArray());
}

export async function replaceCachedLanguages(languages: Language[]) {
  const incomingIds = new Set(languages.map((language) => language.id));

  await db.transaction("rw", db.languages, async () => {
    const existingLanguages = await db.languages.toArray();
    const staleIds = existingLanguages
      .map((language) => language.id)
      .filter((languageId) => !incomingIds.has(languageId));

    await db.languages.bulkPut(languages);

    if (staleIds.length > 0) {
      await db.languages.bulkDelete(staleIds);
    }
  });

  return sortLanguages(languages);
}

export async function cacheLanguage(language: Language) {
  await db.languages.put(language);
  return language;
}

export async function updateCachedLanguage(
  languageId: string,
  updates: Partial<Language>,
) {
  const existing = await db.languages.get(languageId);
  if (!existing) return null;

  const next = { ...existing, ...updates };
  await db.languages.put(next);
  return next;
}
