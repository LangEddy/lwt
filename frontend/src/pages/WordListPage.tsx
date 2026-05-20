import { Filter, MessageSquare, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import WordPopup from "../components/WordPopup";
import { useLanguages } from "../hooks/useLanguages";
import { useWords } from "../hooks/useWords";
import { createExampleOfflineFirst } from "../lib/offlineSync";
import type { Word, WordLevel } from "../types";

const LEVEL_FILTER: { value: WordLevel | null; label: string }[] = [
  { value: null, label: "All" },
  { value: 2, label: "Seen" },
  { value: 3, label: "Ok-ish" },
  { value: 4, label: "Good" },
  { value: 5, label: "Known" },
];

export default function WordListPage() {
  const [search, setSearch] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState<WordLevel[]>([]);
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);

  const { words, loading, updateWord, deleteWord } = useWords(
    languageFilter || null,
  );
  const { languages } = useLanguages();

  const languageMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const lang of languages) {
      map.set(lang.id, lang.name);
    }
    return map;
  }, [languages]);

  const languageCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const lang of languages) {
      map.set(lang.id, lang.code);
    }
    return map;
  }, [languages]);

  const filteredWords = useMemo(() => {
    let result = words;
    if (levelFilter.length > 0) {
      result = result.filter((w) => levelFilter.includes(w.level));
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(
        (w) =>
          w.word.toLowerCase().includes(s) ||
          (w.note?.toLowerCase().includes(s) ?? false),
      );
    }
    return result;
  }, [words, levelFilter, search]);

  const handleSave = async (
    level: WordLevel,
    note: string,
    _isPhrase: boolean,
    pendingExample?: {
      sentence: string;
      translation?: string;
      note?: string;
    },
  ) => {
    if (!selectedWord) return;
    await updateWord(selectedWord.id, { level, note });

    const sentence = pendingExample?.sentence?.trim();
    if (sentence) {
      await createExampleOfflineFirst(selectedWord.id, {
        sentence,
        translation: pendingExample?.translation?.trim() || undefined,
        note: pendingExample?.note?.trim() || undefined,
      });
    }

    setSelectedWord(null);
  };

  const handleDelete = async () => {
    if (!selectedWord) return;
    await deleteWord(selectedWord.id);
    setSelectedWord(null);
  };

  const toggleLevelFilter = (value: WordLevel | null) => {
    if (value === null) {
      setLevelFilter([]);
      return;
    }

    setLevelFilter((prev) =>
      prev.includes(value)
        ? prev.filter((lvl) => lvl !== value)
        : [...prev, value],
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Filters */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-xl mx-auto flex flex-col gap-2.5">
          {/* Search */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text3)]"
            />
            <input
              placeholder="Search words…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-bg)] text-[15px] outline-none focus:border-[var(--color-text)] transition-colors"
            />
          </div>

          {/* Language + Level filters */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 shrink-0">
              <Filter size={14} className="text-[var(--color-text3)]" />
              <select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-[8px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-bg)] text-[13px] outline-none focus:border-[var(--color-text)] transition-colors cursor-pointer"
              >
                <option value="">All languages</option>
                {languages.filter((l) => l.is_favorite).length > 0 && (
                  <optgroup label="Favorites">
                    {languages
                      .filter((l) => l.is_favorite)
                      .map((lang) => (
                        <option key={lang.id} value={lang.id}>
                          {lang.name}
                        </option>
                      ))}
                  </optgroup>
                )}
                {languages.filter((l) => !l.is_favorite).length > 0 && (
                  <optgroup label="Other">
                    {languages
                      .filter((l) => !l.is_favorite)
                      .map((lang) => (
                        <option key={lang.id} value={lang.id}>
                          {lang.name}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {LEVEL_FILTER.map((lvl) => {
                const active =
                  lvl.value === null
                    ? levelFilter.length === 0
                    : levelFilter.includes(lvl.value);
                const bgColor =
                  lvl.value === null
                    ? active
                      ? "var(--color-text)"
                      : "var(--color-surface)"
                    : active
                      ? `var(--color-word-${lvl.value}-bg)`
                      : "var(--color-bg2)";
                const textColor =
                  lvl.value === null
                    ? active
                      ? "var(--color-surface)"
                      : "var(--color-text2)"
                    : active
                      ? lvl.value === 5
                        ? "var(--color-text2)"
                        : `var(--color-word-${lvl.value}-text)`
                      : "var(--color-text2)";
                const borderColor =
                  lvl.value !== null && active
                    ? lvl.value === 5
                      ? "var(--color-border)"
                      : `var(--color-word-${lvl.value}-text)`
                    : "transparent";
                return (
                  <button
                    key={lvl.label}
                    onClick={() => toggleLevelFilter(lvl.value)}
                    className="px-2.5 py-1 rounded-[8px] text-[12px] font-semibold border-[1.5px] transition-all shrink-0"
                    style={{
                      backgroundColor: bgColor,
                      borderColor: borderColor,
                      color: textColor,
                    }}
                  >
                    {lvl.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Word count */}
      <div className="shrink-0 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <span className="text-[12px] text-[var(--color-text3)]">
            {filteredWords.length} word{filteredWords.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Word list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="max-w-xl mx-auto flex flex-col gap-2">
          {loading && (
            <div className="text-center py-10 text-[var(--color-text3)]">
              Loading…
            </div>
          )}

          {filteredWords.map((word) => (
            <div
              key={word.id}
              className="group text-left bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[12px] p-3.5 flex items-start gap-3 hover:bg-[var(--color-bg)] transition-colors"
            >
              <button
                onClick={() => setSelectedWord(word)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="font-bold text-[15px]"
                    lang={languageCodeMap.get(word.language_id)}
                    dir="auto"
                  >
                    {word.word}
                  </span>
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        word.level === 5
                          ? "transparent"
                          : `var(--color-word-${word.level}-bg)`,
                      border:
                        word.level === 5
                          ? "2px solid var(--color-border)"
                          : "none",
                    }}
                    title={
                      ["Unseen", "Unknown", "Seen", "Ok-ish", "Good", "Known"][
                        word.level
                      ]
                    }
                  />
                  {word.is_phrase && (
                    <span className="text-[10px] font-medium text-[var(--color-text3)] bg-[var(--color-bg2)] px-1.5 py-0.5 rounded-md">
                      phrase
                    </span>
                  )}
                </div>
                {word.note && (
                  <p className="text-[13px] text-[var(--color-text2)] line-clamp-1 mb-1">
                    {word.note}
                  </p>
                )}
                <div className="flex items-center gap-2 text-[11px] text-[var(--color-text3)]">
                  <span>
                    {languageMap.get(word.language_id) || word.language_id}
                  </span>
                </div>
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${word.word}"?`)) {
                    await deleteWord(word.id);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 p-2 rounded-[10px] hover:bg-[var(--color-red-bg)] text-[var(--color-text3)] hover:text-[var(--color-red)] transition-all shrink-0"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {!loading && filteredWords.length === 0 && (
            <div className="text-center py-10 text-[var(--color-text3)]">
              <MessageSquare size={36} className="mx-auto mb-2.5" />
              <p className="text-[15px]">No words found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Word Popup */}
      {selectedWord && (
        <WordPopup
          wordText={selectedWord.word}
          sourceSentence={selectedWord.word}
          languageCode={languageCodeMap.get(selectedWord.language_id)}
          existingWord={selectedWord}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setSelectedWord(null)}
        />
      )}
    </div>
  );
}
