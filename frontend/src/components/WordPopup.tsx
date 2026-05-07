import {
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  MessageSquare,
  Plus,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useExamples } from "../hooks/useExamples";
import type { Word, WordLevel } from "../types";

const LEVELS: { value: WordLevel; label: string; short: string }[] = [
  { value: 1, label: "Unknown", short: "L1" },
  { value: 2, label: "Seen", short: "L2" },
  { value: 3, label: "Ok-ish", short: "L3" },
  { value: 4, label: "Good", short: "L4" },
  { value: 5, label: "Known", short: "L5" },
];

interface WordPopupProps {
  wordText: string;
  sourceSentence: string;
  languageCode?: string;
  existingWord?: Word;
  onSave: (
    level: WordLevel,
    note: string,
    isPhrase: boolean,
    pendingExample?: {
      sentence: string;
      translation?: string;
      note?: string;
    },
  ) => void | Promise<void>;
  onDelete: () => void;
  onClose: () => void;
  onExpandLeft?: () => void;
  onExpandRight?: () => void;
  onShrinkLeft?: () => void;
  onShrinkRight?: () => void;
  canExpandLeft?: boolean;
  canExpandRight?: boolean;
  ttsEnabled?: boolean;
  dictionaryEnabled?: boolean;
  onSpeakWord?: (text: string) => void;
  onSpeakSource?: (text: string) => void;
  onSpeakExample?: (text: string) => void;
  onOpenDictionary?: (text: string) => void;
}

// Outer wrapper keys the content on the selected target so internal state
// resets cleanly whenever the parent points the popup at a new word/sentence.
export default function WordPopup(props: WordPopupProps) {
  const resetKey = props.existingWord?.id ?? `new:${props.sourceSentence}`;
  return <WordPopupContent key={resetKey} {...props} />;
}

function WordPopupContent({
  wordText,
  sourceSentence,
  languageCode,
  existingWord,
  onSave,
  onDelete,
  onClose,
  onExpandLeft,
  onExpandRight,
  onShrinkLeft,
  onShrinkRight,
  canExpandLeft,
  canExpandRight,
  ttsEnabled,
  dictionaryEnabled,
  onSpeakWord,
  onSpeakSource,
  onSpeakExample,
  onOpenDictionary,
}: WordPopupProps) {
  const [level, setLevel] = useState<WordLevel>(existingWord?.level ?? 1);
  const [note, setNote] = useState(existingWord?.note ?? "");
  const [showExampleForm, setShowExampleForm] = useState(false);
  const [exampleSentence, setExampleSentence] = useState("");
  const [exampleTranslation, setExampleTranslation] = useState("");
  const [exampleNote, setExampleNote] = useState("");
  const [editingExampleId, setEditingExampleId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    examples,
    loading: examplesLoading,
    fetchExamples,
    updateExample,
    deleteExample,
  } = useExamples(existingWord?.id);

  useEffect(() => {
    if (existingWord) {
      fetchExamples();
    }
  }, [existingWord, fetchExamples]);

  const startAddExample = () => {
    setEditingExampleId(null);
    setExampleSentence(sourceSentence);
    setExampleTranslation("");
    setExampleNote("");
    setShowExampleForm(true);
  };

  const commitEditingExample = async () => {
    if (!editingExampleId || !exampleSentence.trim()) return;
    await updateExample(editingExampleId, {
      sentence: exampleSentence.trim(),
      translation: exampleTranslation.trim() || undefined,
      note: exampleNote.trim() || undefined,
    });
  };

  const handleUpdateExample = async () => {
    await commitEditingExample();
    cancelExampleForm();
  };

  const getPendingExample = () => {
    if (!showExampleForm || editingExampleId) return undefined;
    const sentence = exampleSentence.trim();
    if (!sentence) return undefined;
    return {
      sentence,
      translation: exampleTranslation.trim() || undefined,
      note: exampleNote.trim() || undefined,
    };
  };

  const handleSaveAll = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await commitEditingExample();
      await onSave(level, note, false, getPendingExample());
      cancelExampleForm();
    } finally {
      setIsSaving(false);
    }
  };

  const startEditExample = (ex: {
    id: string;
    sentence: string;
    translation?: string;
    note?: string;
  }) => {
    setEditingExampleId(ex.id);
    setExampleSentence(ex.sentence);
    setExampleTranslation(ex.translation ?? "");
    setExampleNote(ex.note ?? "");
    setShowExampleForm(true);
  };

  const cancelExampleForm = () => {
    setShowExampleForm(false);
    setEditingExampleId(null);
    setExampleSentence("");
    setExampleTranslation("");
    setExampleNote("");
  };

  const visibleExampleCount = existingWord
    ? examples.length
    : showExampleForm
      ? 1
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Popup */}
      <div className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 bg-[var(--color-surface)] rounded-[12px] shadow-xl border border-[var(--color-border)] animate-slide-up overflow-hidden max-h-[85vh] flex flex-col">
        {/* Drag handle */}
        <div className="shrink-0 flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-[var(--color-border)]" />
        </div>

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <h3
            className="font-bold text-[24px] break-words font-serif"
            lang={languageCode}
            dir="auto"
          >
            {wordText}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--color-bg2)] text-[var(--color-text3)] transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {(ttsEnabled || dictionaryEnabled) && (
          <div className="shrink-0 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] flex items-center gap-2 flex-wrap">
            {ttsEnabled && (
              <>
                <button
                  onClick={() => onSpeakWord?.(wordText)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-bg2)] transition-colors"
                >
                  <Volume2 size={14} />
                  Word
                </button>
                {sourceSentence.trim() && (
                  <button
                    onClick={() => onSpeakSource?.(sourceSentence)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-bg2)] transition-colors"
                  >
                    <Volume2 size={14} />
                    Sentence
                  </button>
                )}
              </>
            )}
            {dictionaryEnabled && (
              <button
                onClick={() => onOpenDictionary?.(wordText)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-bg2)] transition-colors"
              >
                <ExternalLink size={14} />
                Dictionary
              </button>
            )}
          </div>
        )}

        {/* Phrase expand / shrink row — only shown when selection can change */}
        {(canExpandLeft || canExpandRight || onShrinkLeft || onShrinkRight) && (
          <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
            <span className="text-[11px] font-semibold text-[var(--color-text3)] uppercase tracking-wide">
              Phrase
            </span>
            <div className="flex items-center gap-1">
              {canExpandLeft && (
                <button
                  onClick={onExpandLeft}
                  className="flex items-center gap-1 px-2 py-1 rounded-[8px] text-[12px] font-medium bg-[var(--color-bg2)] text-[var(--color-text2)] hover:bg-[var(--color-bg3)] transition-colors"
                  title="Add word on left"
                >
                  <ChevronLeft size={14} />
                  Add
                </button>
              )}
              {onShrinkLeft && (
                <button
                  onClick={onShrinkLeft}
                  className="flex items-center gap-1 px-2 py-1 rounded-[8px] text-[12px] font-medium bg-[var(--color-bg2)] text-[var(--color-text2)] hover:bg-[var(--color-red-bg)] hover:text-[var(--color-red)] transition-colors"
                  title="Remove word from left"
                >
                  <ChevronRight size={14} />
                  Remove
                </button>
              )}
              {onShrinkRight && (
                <button
                  onClick={onShrinkRight}
                  className="flex items-center gap-1 px-2 py-1 rounded-[8px] text-[12px] font-medium bg-[var(--color-bg2)] text-[var(--color-text2)] hover:bg-[var(--color-red-bg)] hover:text-[var(--color-red)] transition-colors"
                  title="Remove word from right"
                >
                  Remove
                  <ChevronLeft size={14} />
                </button>
              )}
              {canExpandRight && (
                <button
                  onClick={onExpandRight}
                  className="flex items-center gap-1 px-2 py-1 rounded-[8px] text-[12px] font-medium bg-[var(--color-bg2)] text-[var(--color-text2)] hover:bg-[var(--color-bg3)] transition-colors"
                  title="Add word on right"
                >
                  Add
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Level selector */}
          <div className="px-4 py-3">
            <label className="text-[13px] font-semibold text-[var(--color-text2)] mb-2 block">
              Knowledge level
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {LEVELS.map((lvl) => {
                const active = level === lvl.value;
                const bgVar = active
                  ? `var(--color-word-${lvl.value}-bg)`
                  : "var(--color-bg2)";
                const textVar = active
                  ? `var(--color-word-${lvl.value}-text)`
                  : "var(--color-text2)";

                return (
                  <button
                    key={lvl.value}
                    onClick={() => setLevel(lvl.value)}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-[10px] border-[1.5px] transition-all"
                    style={{
                      backgroundColor: bgVar,
                      borderColor: active ? textVar : "transparent",
                      color: textVar,
                    }}
                  >
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{
                        backgroundColor:
                          lvl.value === 5
                            ? "transparent"
                            : `var(--color-word-${lvl.value}-bg)`,
                        border:
                          lvl.value === 5
                            ? "2px solid var(--color-border)"
                            : "none",
                      }}
                    />
                    <span className="text-[10px] font-medium leading-tight">
                      {lvl.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note */}
          <div className="px-4 pb-3">
            <label className="text-[13px] font-semibold text-[var(--color-text2)] mb-1.5 block">
              Note / Translation
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note or translation..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-bg)] text-[15px] outline-none focus:border-[var(--color-text)] transition-colors resize-none"
            />
          </div>

          {/* Examples */}
          <div className="px-4 pb-3 border-t border-[var(--color-border)]">
            <div className="flex items-center justify-between py-2">
              <label className="text-[13px] font-semibold text-[var(--color-text2)] flex items-center gap-1.5">
                <MessageSquare size={14} />
                Learning sentences
                <span className="text-[11px] text-[var(--color-text3)] font-normal">
                  ({visibleExampleCount})
                </span>
              </label>
              {!showExampleForm && (
                <button
                  onClick={startAddExample}
                  className="flex items-center gap-1 px-2 py-1 rounded-[8px] text-[12px] font-semibold bg-[var(--color-bg2)] text-[var(--color-text2)] hover:bg-[var(--color-bg3)] transition-colors"
                >
                  <Plus size={13} />
                  Add
                </button>
              )}
            </div>

            {examplesLoading && (
              <div className="text-[12px] text-[var(--color-text3)] py-2">
                Loading…
              </div>
            )}

            {showExampleForm && (
              <div className="bg-[var(--color-bg)] rounded-[10px] p-3 mb-2 border border-[var(--color-border)]">
                <div
                  className="w-full px-3 py-2 rounded-[8px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] text-[14px] text-[var(--color-text2)] leading-relaxed mb-2"
                  lang={languageCode}
                  dir="auto"
                >
                  {exampleSentence ||
                    sourceSentence ||
                    "No sentence context available."}
                </div>
                <textarea
                  value={exampleTranslation}
                  onChange={(e) => setExampleTranslation(e.target.value)}
                  placeholder="Translation (optional)..."
                  rows={1}
                  className="w-full px-3 py-2 rounded-[8px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] text-[14px] outline-none focus:border-[var(--color-text)] transition-colors resize-none mb-2"
                />
                <textarea
                  value={exampleNote}
                  onChange={(e) => setExampleNote(e.target.value)}
                  placeholder="Note (optional)..."
                  rows={1}
                  className="w-full px-3 py-2 rounded-[8px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] text-[14px] outline-none focus:border-[var(--color-text)] transition-colors resize-none mb-2"
                />
                {editingExampleId ? (
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={cancelExampleForm}
                      className="px-3 py-1.5 rounded-[8px] text-[12px] font-semibold text-[var(--color-text2)] hover:bg-[var(--color-bg2)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateExample}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] text-[12px] font-semibold bg-[var(--color-text)] text-[var(--color-surface)] hover:opacity-90 transition-opacity"
                    >
                      <Check size={13} />
                      Update
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-[var(--color-text3)]">
                      This example will be saved with the main Save button.
                    </p>
                    <button
                      onClick={cancelExampleForm}
                      className="px-3 py-1.5 rounded-[8px] text-[12px] font-semibold text-[var(--color-text2)] hover:bg-[var(--color-bg2)] transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )}

            {existingWord && (
              <div className="flex flex-col gap-2">
                {examples.map((ex) => (
                  <div
                    key={ex.id}
                    className="bg-[var(--color-bg)] rounded-[10px] p-3 border border-[var(--color-border)]"
                  >
                    <p
                      className="text-[14px] text-[var(--color-text)] leading-relaxed mb-1"
                      lang={languageCode}
                      dir="auto"
                    >
                      {ex.sentence}
                    </p>
                    {ex.translation && (
                      <p className="text-[13px] text-[var(--color-text2)] italic leading-relaxed mb-1">
                        {ex.translation}
                      </p>
                    )}
                    {ex.note && (
                      <p className="text-[12px] text-[var(--color-text3)] leading-relaxed">
                        {ex.note}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-2">
                      {ttsEnabled && (
                        <button
                          onClick={() => onSpeakExample?.(ex.sentence)}
                          className="p-1.5 rounded-md hover:bg-[var(--color-bg2)] text-[var(--color-text3)] transition-colors"
                          title="Speak example"
                        >
                          <Volume2 size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => startEditExample(ex)}
                        className="p-1.5 rounded-md hover:bg-[var(--color-bg2)] text-[var(--color-text3)] transition-colors"
                        title="Edit"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm("Delete this example?")) {
                            await deleteExample(ex.id);
                          }
                        }}
                        className="p-1.5 rounded-md hover:bg-[var(--color-red-bg)] text-[var(--color-text3)] hover:text-[var(--color-red)] transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-t border-[var(--color-border)]">
          {existingWord && (
            <button
              onClick={() => {
                if (confirm("Delete this word?")) {
                  onDelete();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[13px] font-semibold text-[var(--color-red)] hover:bg-[var(--color-red-bg)] transition-colors"
            >
              <Trash2 size={15} />
              Delete
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-[10px] text-[13px] font-semibold text-[var(--color-text2)] hover:bg-[var(--color-bg2)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-[13px] font-semibold bg-[var(--color-text)] text-[var(--color-surface)] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          >
            <Check size={15} />
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
