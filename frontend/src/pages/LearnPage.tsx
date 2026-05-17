import { Brain, CheckCircle2, Edit3, Eye, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Rating, State, createEmptyCard, fsrs, type Card } from "ts-fsrs";
import { useReviews, type DueReview } from "../hooks/useReviews";

const BUTTONS = [
  {
    rating: 0,
    label: "Again",
    color: "var(--color-red)",
    bg: "var(--color-red-bg)",
  },
  {
    rating: 1,
    label: "Hard",
    color: "var(--color-amber)",
    bg: "var(--color-amber-bg)",
  },
  {
    rating: 2,
    label: "Good",
    color: "var(--color-green)",
    bg: "var(--color-green-bg)",
  },
  {
    rating: 3,
    label: "Easy",
    color: "oklch(55% 0.14 230)",
    bg: "oklch(94% 0.04 230)",
  },
] as const;

const scheduler = fsrs();

function pluralize(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

function formatIntervalLabel(nextDue: Date): string {
  const diffMs = Math.max(nextDue.getTime() - Date.now(), 0);
  const minutes = Math.round(diffMs / 60_000);

  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return pluralize(minutes, "min");

  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 24) return pluralize(hours, "hr");

  const days = Math.round(diffMs / 86_400_000);
  return pluralize(Math.max(days, 1), "day");
}

function mapRating(rating: number) {
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

function buildFsrsCard(review?: DueReview): Card {
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

function calculateInterval(
  review: DueReview | undefined,
  rating: number,
): string {
  const preview = scheduler.repeat(buildFsrsCard(review), new Date());
  return formatIntervalLabel(preview[mapRating(rating)].card.due);
}

export default function LearnPage() {
  const {
    activeCards,
    totalCards,
    loading,
    fetchDue,
    submitAnswer,
    updateCardTranslation,
    removeCardExample,
  } = useReviews();
  const [showAnswer, setShowAnswer] = useState(false);
  const [translationDraft, setTranslationDraft] = useState("");
  const [isEditingTranslation, setIsEditingTranslation] = useState(false);
  const [isSavingTranslation, setIsSavingTranslation] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [isRemovingExample, setIsRemovingExample] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });

  useEffect(() => {
    fetchDue();
  }, [fetchDue]);

  const current = activeCards[0];
  const currentTranslation = current?.translation?.trim() ?? "";
  const hasTranslation = currentTranslation.length > 0;
  const progress =
    totalCards > 0 ? (totalCards - activeCards.length) / totalCards : 0;

  const handleShowAnswer = () => {
    const initialTranslation = current?.translation?.trim() ?? "";
    setTranslationDraft(initialTranslation);
    setIsEditingTranslation(initialTranslation.length === 0);
    setTranslationError(null);
    setShowAnswer(true);
  };

  const handleEditTranslation = () => {
    if (!current) return;
    setTranslationDraft(current.translation?.trim() ?? "");
    setIsEditingTranslation(true);
    setTranslationError(null);
  };

  const handleCancelTranslationEdit = () => {
    setTranslationDraft(currentTranslation);
    setIsEditingTranslation(false);
    setTranslationError(null);
  };

  const handleSaveTranslation = async () => {
    if (!current) return;

    const nextTranslation = translationDraft.trim();
    if (!nextTranslation) {
      setTranslationError("Translation cannot be empty.");
      return;
    }

    try {
      setIsSavingTranslation(true);
      setTranslationError(null);
      const savedTranslation = await updateCardTranslation(
        current.example_id,
        nextTranslation,
      );
      setTranslationDraft(savedTranslation ?? nextTranslation);
      setIsEditingTranslation(false);
    } catch (error) {
      setTranslationError(
        error instanceof Error ? error.message : "Failed to save translation.",
      );
    } finally {
      setIsSavingTranslation(false);
    }
  };

  const handleOpenRemoveDialog = () => {
    setRemoveError(null);
    setShowRemoveDialog(true);
  };

  const handleCancelRemoveDialog = () => {
    if (isRemovingExample) return;
    setShowRemoveDialog(false);
    setRemoveError(null);
  };

  const handleConfirmRemoveExample = async () => {
    if (!current) {
      setShowRemoveDialog(false);
      return;
    }

    try {
      setIsRemovingExample(true);
      setRemoveError(null);
      await removeCardExample(current.example_id);
      setShowRemoveDialog(false);
      setShowAnswer(false);
      setTranslationDraft("");
      setIsEditingTranslation(false);
      setTranslationError(null);

      if (activeCards.length <= 1) {
        setFinished(true);
      }
    } catch (error) {
      setRemoveError(
        error instanceof Error
          ? error.message
          : "Failed to remove this sentence.",
      );
    } finally {
      setIsRemovingExample(false);
    }
  };

  const handleAnswer = async (rating: number) => {
    if (!current) return;
    await submitAnswer(current, rating);
    setSessionStats((prev) => ({
      ...prev,
      again: prev.again + (rating === 0 ? 1 : 0),
      hard: prev.hard + (rating === 1 ? 1 : 0),
      good: prev.good + (rating === 2 ? 1 : 0),
      easy: prev.easy + (rating === 3 ? 1 : 0),
    }));
    setShowAnswer(false);
    setTranslationDraft("");
    setIsEditingTranslation(false);
    setTranslationError(null);
    if (activeCards.length <= 1) {
      setFinished(true);
    }
  };

  const handleRestart = () => {
    setShowAnswer(false);
    setTranslationDraft("");
    setIsEditingTranslation(false);
    setTranslationError(null);
    setFinished(false);
    setSessionStats({ again: 0, hard: 0, good: 0, easy: 0 });
    fetchDue();
  };

  if (loading && activeCards.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text3)]">
        Loading…
      </div>
    );
  }

  if (finished || activeCards.length === 0) {
    const total =
      sessionStats.again +
      sessionStats.hard +
      sessionStats.good +
      sessionStats.easy;
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center">
        <CheckCircle2 size={48} className="text-[var(--color-green)] mb-4" />
        <h2 className="text-[20px] font-bold mb-2">
          {total > 0 ? "Session complete!" : "All caught up!"}
        </h2>
        <p className="text-[15px] text-[var(--color-text2)] mb-6">
          {total > 0
            ? `You reviewed ${total} card${total > 1 ? "s" : ""}.`
            : "No cards are due for review right now."}
        </p>
        {total > 0 && (
          <div className="flex items-center gap-3 mb-6">
            <StatBadge
              label="Again"
              count={sessionStats.again}
              color="var(--color-red)"
            />
            <StatBadge
              label="Hard"
              count={sessionStats.hard}
              color="var(--color-amber)"
            />
            <StatBadge
              label="Good"
              count={sessionStats.good}
              color="var(--color-green)"
            />
            <StatBadge
              label="Easy"
              count={sessionStats.easy}
              color="oklch(55% 0.14 230)"
            />
          </div>
        )}
        <button
          onClick={handleRestart}
          className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[14px] font-semibold bg-[var(--color-text)] text-[var(--color-surface)] hover:opacity-90 transition-opacity"
        >
          <RotateCcw size={16} />
          {total > 0 ? "Review again" : "Check for new cards"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Brain size={18} className="text-[var(--color-text3)]" />
              <span className="text-[13px] font-semibold text-[var(--color-text2)]">
                Review
              </span>
            </div>
            <span className="text-[12px] text-[var(--color-text3)]">
              {totalCards - activeCards.length + 1} / {totalCards}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1 rounded-full bg-[var(--color-bg2)] overflow-hidden">
            <div
              className="h-full bg-[var(--color-text)] transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-xl mx-auto flex flex-col h-full justify-start md:justify-center">
          {/* Card */}
          <div
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[16px] p-6 mb-6 min-h-[180px] flex flex-col justify-center"
            dir={current.language_direction}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="text-[12px] font-semibold text-[var(--color-text3)] uppercase tracking-[0.06em]">
                Translate this sentence
              </div>
              <div className="shrink-0 text-[11px] font-semibold text-[var(--color-text2)] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-full px-2.5 py-1">
                {current.language_code.toUpperCase()}
              </div>
            </div>

            {/* Target word highlight in sentence */}
            <p
              className="text-[19px] leading-[1.8] text-[var(--color-text)] font-serif"
              lang={current.language_code}
            >
              {current.sentence
                .split(
                  new RegExp(
                    `(${current.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
                    "i",
                  ),
                )
                .map((part, i) => {
                  const isMatch =
                    part.toLowerCase() === current.word.toLowerCase();
                  if (isMatch) {
                    return (
                      <mark
                        key={i}
                        className="rounded-[4px] px-[2px] font-bold"
                        style={{
                          backgroundColor: `var(--color-word-${current.word_level}-bg)`,
                          color: `var(--color-word-${current.word_level}-text)`,
                        }}
                      >
                        {part}
                      </mark>
                    );
                  }
                  return <span key={i}>{part}</span>;
                })}
            </p>

            {showAnswer && (
              <div className="animate-fade-in mt-4">
                <div className="border-t border-[var(--color-border)] pt-4" />

                <div className="flex items-center justify-between mb-2">
                  <div className="text-[12px] font-semibold text-[var(--color-text3)] uppercase tracking-[0.06em]">
                    Translation
                  </div>
                  {hasTranslation && !isEditingTranslation && (
                    <button
                      onClick={handleEditTranslation}
                      title="Edit translation"
                      className="p-1.5 rounded-md hover:bg-[var(--color-bg2)] text-[var(--color-text3)] transition-colors"
                    >
                      <Edit3 size={13} />
                    </button>
                  )}
                </div>

                {isEditingTranslation || !hasTranslation ? (
                  <div>
                    <textarea
                      value={translationDraft}
                      onChange={(event) => {
                        setTranslationDraft(event.target.value);
                        if (translationError) {
                          setTranslationError(null);
                        }
                      }}
                      placeholder="Add translation..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg)] text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text3)] outline-none resize-none"
                    />

                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={handleSaveTranslation}
                        disabled={
                          isSavingTranslation ||
                          translationDraft.trim().length === 0
                        }
                        className="px-3 py-1.5 rounded-[8px] text-[12px] font-semibold bg-[var(--color-text)] text-[var(--color-surface)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSavingTranslation ? "Saving..." : "Save translation"}
                      </button>

                      {hasTranslation && (
                        <button
                          onClick={handleCancelTranslationEdit}
                          disabled={isSavingTranslation}
                          className="px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border border-[var(--color-border)] text-[var(--color-text2)] hover:text-[var(--color-text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    {translationError && (
                      <p className="text-[12px] text-[var(--color-red)] mt-2">
                        {translationError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-[16px] text-[var(--color-text2)] mb-1">
                    {currentTranslation}
                  </div>
                )}

                <div className="border-t border-[var(--color-border)] mt-4 pt-3">
                  <button
                    onClick={handleOpenRemoveDialog}
                    className="text-[12px] font-semibold text-[var(--color-red)] hover:opacity-80 transition-opacity"
                  >
                    Stop repeating this sentence
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Answer area */}
          {showAnswer ? (
            <div className="animate-fade-in">
              <div className="text-[13px] font-semibold text-[var(--color-text2)] text-center mb-3">
                How well did you know it?
              </div>

              {/* Rating buttons */}
              <div className="grid grid-cols-4 gap-2">
                {BUTTONS.map((btn) => (
                  <button
                    key={btn.rating}
                    onClick={() => handleAnswer(btn.rating)}
                    className="flex flex-col items-center gap-1 py-3 rounded-[10px] border-[1.5px] transition-all active:scale-95"
                    style={{
                      backgroundColor: btn.bg,
                      borderColor: "transparent",
                    }}
                  >
                    <span
                      className="text-[15px] font-bold"
                      style={{ color: btn.color }}
                    >
                      {btn.label}
                    </span>
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: btn.color }}
                    >
                      {calculateInterval(current, btn.rating)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button
              onClick={handleShowAnswer}
              className="mx-auto flex items-center gap-2 px-6 py-3 rounded-[10px] text-[15px] font-semibold bg-[var(--color-text)] text-[var(--color-surface)] hover:opacity-90 transition-opacity"
            >
              <Eye size={18} />
              Show Answer
            </button>
          )}
        </div>
      </div>

      {showRemoveDialog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-lg">
            <h3 className="text-[16px] font-bold text-[var(--color-text)] mb-2">
              Remove this sentence from reviews?
            </h3>
            <p className="text-[13px] text-[var(--color-text2)] leading-[1.5]">
              This will delete the example sentence and stop showing it in
              spaced repetition. This action cannot be undone.
            </p>

            {removeError && (
              <p className="text-[12px] text-[var(--color-red)] mt-3">
                {removeError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={handleCancelRemoveDialog}
                disabled={isRemovingExample}
                className="px-3 py-1.5 rounded-[8px] text-[12px] font-semibold border border-[var(--color-border)] text-[var(--color-text2)] hover:text-[var(--color-text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemoveExample}
                disabled={isRemovingExample}
                className="px-3 py-1.5 rounded-[8px] text-[12px] font-semibold bg-[var(--color-red)] text-white hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isRemovingExample ? "Removing..." : "Delete sentence"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBadge({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  if (count === 0) return null;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[11px] font-semibold" style={{ color }}>
        {label}
      </span>
      <span className="text-[15px] font-bold" style={{ color }}>
        {count}
      </span>
    </div>
  );
}
