import { useCallback } from "react";

export function useDictionary(template?: string) {
  const buildUrl = useCallback(
    (word: string) => {
      if (!template) return null;
      const cleaned = template.trim();
      if (!cleaned || !cleaned.includes("{word}")) return null;

      const resolved = cleaned.replaceAll("{word}", encodeURIComponent(word));
      try {
        const url = new URL(resolved);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          return null;
        }
        return url.toString();
      } catch {
        return null;
      }
    },
    [template],
  );

  return { buildUrl };
}
