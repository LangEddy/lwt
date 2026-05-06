import { Brain, CheckCircle2, Eye, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useReviews } from "../hooks/useReviews";

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

function formatIntervalLabel(days: number): string {
  if (days <= 1) return "1 day";
  return `${days} days`;
}

function calculateInterval(
  interval: number | undefined,
  repetitions: number | undefined,
  easeFactor: number | undefined,
  rating: number,
): string {
  if (rating === 0) return "< 10 min";

  const currentInterval = interval ?? 1;
  const currentRepetitions = repetitions ?? 0;
  const currentEaseFactor = easeFactor ?? 2.5;

  const nextInterval =
    currentRepetitions === 0
      ? 1
      : currentRepetitions === 1
        ? 6
        : Math.round(currentInterval * currentEaseFactor);

  return formatIntervalLabel(nextInterval);
}

export default function LearnPage() {
  const { activeCards, totalCards, loading, fetchDue, submitAnswer } =
    useReviews();
  const [showAnswer, setShowAnswer] = useState(false);
  const [answerNote, setAnswerNote] = useState("");
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
  const progress =
    totalCards > 0 ? (totalCards - activeCards.length) / totalCards : 0;

  const handleShowAnswer = () => {
    setAnswerNote(current?.example_note ?? "");
    setShowAnswer(true);
  };

  const handleAnswer = async (rating: number) => {
    if (!current) return;
    await submitAnswer(current.example_id, rating);
    setSessionStats((prev) => ({
      ...prev,
      again: prev.again + (rating === 0 ? 1 : 0),
      hard: prev.hard + (rating === 1 ? 1 : 0),
      good: prev.good + (rating === 2 ? 1 : 0),
      easy: prev.easy + (rating === 3 ? 1 : 0),
    }));
    setShowAnswer(false);
    setAnswerNote("");
    if (activeCards.length <= 1) {
      setFinished(true);
    }
  };

  const handleRestart = () => {
    setShowAnswer(false);
    setAnswerNote("");
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
        <div className="max-w-xl mx-auto flex flex-col h-full justify-center">
          {/* Card */}
          <div
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[16px] p-6 mb-6 min-h-[180px] flex flex-col justify-center"
            dir={current.language_direction}
          >
            <div className="text-[12px] font-semibold text-[var(--color-text3)] uppercase tracking-[0.06em] mb-4">
              Translate this sentence
            </div>

            {/* Target word highlight in sentence */}
            <p className="text-[19px] leading-[1.8] text-[var(--color-text)] font-serif">
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

                {current.translation && (
                  <div className="text-[16px] text-[var(--color-text2)] mb-3">
                    {current.translation}
                  </div>
                )}

                <div className="text-[12px] font-semibold text-[var(--color-text3)] uppercase tracking-[0.06em] mb-2">
                  Your note
                </div>

                <div className="text-[15px] text-[var(--color-text)] mb-3">
                  {current.word_note ||
                    current.example_note ||
                    "No note added yet"}
                </div>

                <textarea
                  value={answerNote}
                  onChange={(event) => setAnswerNote(event.target.value)}
                  placeholder="Update your note..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg)] text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text3)] outline-none resize-none"
                />
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
                      {calculateInterval(
                        current.interval,
                        current.repetitions,
                        current.ease_factor,
                        btn.rating,
                      )}
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
