import {
  CalendarClock,
  Check,
  Edit3,
  MessageSquare,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLanguages } from "../hooks/useLanguages";
import { useSentences } from "../hooks/useSentences";
import type { SentenceItem } from "../types";

type SortMode =
  | "next_repetition"
  | "recently_updated"
  | "oldest_first"
  | "word_az"
  | "sentence_az";

function formatNextReview(nextReviewAt: string | null | undefined) {
  if (!nextReviewAt) return "Not scheduled yet";

  const date = new Date(nextReviewAt);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const base = date.toLocaleString();
  if (date.getTime() <= Date.now()) return `${base} (due)`;
  return base;
}

export default function SentencesPage() {
  const [search, setSearch] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("next_repetition");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTranslation, setDraftTranslation] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { languages } = useLanguages();
  const { sentences, loading, error, updateSentence, deleteSentence } =
    useSentences(languageFilter || null);

  const filteredSentences = useMemo(() => {
    if (!search.trim()) return sentences;
    const q = search.toLowerCase();

    return sentences.filter(
      (item) =>
        item.word.toLowerCase().includes(q) ||
        item.sentence.toLowerCase().includes(q) ||
        (item.translation?.toLowerCase().includes(q) ?? false) ||
        (item.note?.toLowerCase().includes(q) ?? false),
    );
  }, [sentences, search]);

  const sortedSentences = useMemo(() => {
    const items = [...filteredSentences];

    const byDateAsc = (a: string, b: string) =>
      new Date(a).getTime() - new Date(b).getTime();
    const byDateDesc = (a: string, b: string) =>
      new Date(b).getTime() - new Date(a).getTime();

    switch (sortMode) {
      case "next_repetition":
        return items.sort((a, b) => {
          const aTs = a.next_review_at
            ? new Date(a.next_review_at).getTime()
            : Infinity;
          const bTs = b.next_review_at
            ? new Date(b.next_review_at).getTime()
            : Infinity;
          if (aTs !== bTs) return aTs - bTs;
          return byDateDesc(a.updated_at, b.updated_at);
        });
      case "recently_updated":
        return items.sort((a, b) => byDateDesc(a.updated_at, b.updated_at));
      case "oldest_first":
        return items.sort((a, b) => byDateAsc(a.created_at, b.created_at));
      case "word_az":
        return items.sort((a, b) => a.word.localeCompare(b.word));
      case "sentence_az":
        return items.sort((a, b) => a.sentence.localeCompare(b.sentence));
      default:
        return items;
    }
  }, [filteredSentences, sortMode]);

  const startEditing = (item: SentenceItem) => {
    setEditingId(item.id);
    setDraftTranslation(item.translation ?? "");
    setDraftNote(item.note ?? "");
    setFormError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraftTranslation("");
    setDraftNote("");
    setFormError(null);
  };

  const handleSave = async () => {
    if (!editingId || saving) return;

    setSaving(true);
    try {
      await updateSentence(editingId, {
        translation: draftTranslation.trim() || undefined,
        note: draftNote.trim() || undefined,
      });
      cancelEditing();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-xl mx-auto flex flex-col gap-2.5">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text3)]"
            />
            <input
              placeholder="Search sentences…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-bg)] text-[15px] outline-none focus:border-[var(--color-text)] transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
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
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="px-2.5 py-1.5 rounded-[8px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-bg)] text-[13px] outline-none focus:border-[var(--color-text)] transition-colors cursor-pointer"
            >
              <option value="next_repetition">Next repetition</option>
              <option value="recently_updated">Recently updated</option>
              <option value="oldest_first">Oldest first</option>
              <option value="word_az">Word A-Z</option>
              <option value="sentence_az">Sentence A-Z</option>
            </select>
            <span className="text-[12px] text-[var(--color-text3)]">
              Next repetition is read-only
            </span>
          </div>
        </div>
      </div>

      <div className="shrink-0 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <span className="text-[12px] text-[var(--color-text3)]">
            {sortedSentences.length} sentence
            {sortedSentences.length !== 1 ? "s" : ""}
          </span>
          {error && (
            <span className="text-[12px] text-[var(--color-red)]">{error}</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="max-w-xl mx-auto flex flex-col gap-2">
          {loading && (
            <div className="text-center py-10 text-[var(--color-text3)]">
              Loading…
            </div>
          )}

          {sortedSentences.map((item) => {
            const isEditing = editingId === item.id;

            return (
              <div
                key={item.id}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[12px] p-3.5"
              >
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <div
                      className="w-full px-3 py-2 rounded-[8px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-bg)] text-[14px] text-[var(--color-text2)] leading-relaxed"
                      lang={item.language_code}
                      dir="auto"
                    >
                      {item.sentence}
                    </div>
                    <textarea
                      value={draftTranslation}
                      onChange={(e) => setDraftTranslation(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-[8px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-bg)] text-[14px] outline-none focus:border-[var(--color-text)] transition-colors resize-y"
                      placeholder="Translation (optional)"
                    />
                    <textarea
                      value={draftNote}
                      onChange={(e) => setDraftNote(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-[8px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-bg)] text-[14px] outline-none focus:border-[var(--color-text)] transition-colors resize-y"
                      placeholder="Note (optional)"
                    />
                    {formError && (
                      <p className="text-[12px] text-[var(--color-red)]">
                        {formError}
                      </p>
                    )}
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={cancelEditing}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-semibold text-[var(--color-text2)] hover:bg-[var(--color-bg2)] transition-colors"
                      >
                        <X size={13} />
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-semibold bg-[var(--color-text)] text-[var(--color-surface)] hover:opacity-90 disabled:opacity-60 transition-opacity"
                      >
                        <Check size={13} />
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p
                      className="font-semibold text-[15px] leading-relaxed"
                      lang={item.language_code}
                      dir="auto"
                    >
                      {item.sentence}
                    </p>
                    {item.translation && (
                      <p
                        className="text-[13px] text-[var(--color-text2)] italic mt-1"
                        dir="auto"
                      >
                        {item.translation}
                      </p>
                    )}
                    {item.note && (
                      <p
                        className="text-[12px] text-[var(--color-text3)] mt-1"
                        dir="auto"
                      >
                        {item.note}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--color-text3)] flex-wrap">
                      <span className="px-1.5 py-0.5 rounded-md bg-[var(--color-bg2)] text-[var(--color-text2)] font-semibold">
                        {item.language_code.toUpperCase()}
                      </span>
                      <span
                        className="font-medium"
                        lang={item.language_code}
                        dir="auto"
                      >
                        {item.word}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock size={12} />
                        {formatNextReview(item.next_review_at)}
                      </span>
                      {typeof item.repetitions === "number" && (
                        <span>reps: {item.repetitions}</span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <button
                        onClick={() => startEditing(item)}
                        className="p-1.5 rounded-md hover:bg-[var(--color-bg2)] text-[var(--color-text3)] transition-colors"
                        title="Edit sentence"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm("Delete this sentence?")) {
                            await deleteSentence(item.id);
                          }
                        }}
                        className="p-1.5 rounded-md hover:bg-[var(--color-red-bg)] text-[var(--color-text3)] hover:text-[var(--color-red)] transition-colors"
                        title="Delete sentence"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {!loading && sortedSentences.length === 0 && (
            <div className="text-center py-10 text-[var(--color-text3)]">
              <MessageSquare size={36} className="mx-auto mb-2.5" />
              <p className="text-[15px]">No sentences found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
