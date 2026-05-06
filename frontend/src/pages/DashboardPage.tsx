import { BookOpen, Brain, List, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTexts } from "../hooks/useTexts";
import { useWords } from "../hooks/useWords";

export default function DashboardPage() {
  const navigate = useNavigate();
  // null = fetch all words (no language filter); undefined would skip the fetch
  const { words, loading: wordsLoading } = useWords(null);
  const { texts, loading: textsLoading } = useTexts();

  const wordsTracked = words.length;
  const known = words.filter((w) => w.level === 5).length;
  const learning = words.filter((w) => w.level < 5 && w.level >= 1).length;
  const withExamples = 0; // placeholder — requires examples count from backend

  const recentTexts = texts.slice(0, 3);

  return (
    <div className="p-4 pb-6">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-7">
          <h1 className="font-serif text-[32px] font-normal tracking-tight mb-1.5">
            LWT
          </h1>
          <p className="text-[15px] text-[var(--color-text2)] leading-relaxed">
            Learn vocabulary by reading.
            <br />
            Paste text, click words, track your progress.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {[
            {
              label: "Words Tracked",
              value: wordsTracked,
              color: "var(--color-text)",
            },
            { label: "Known", value: known, color: "var(--color-green)" },
            { label: "Learning", value: learning, color: "var(--color-amber)" },
            {
              label: "With Examples",
              value: withExamples,
              color: "var(--color-green)",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[var(--color-surface)] rounded-[14px] border border-[var(--color-border)] p-4"
            >
              <div
                className="text-[30px] font-bold leading-none"
                style={{ color: stat.color }}
              >
                {wordsLoading ? "–" : stat.value}
              </div>
              <div className="text-[13px] text-[var(--color-text2)] mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2.5 mb-7">
          <button
            onClick={() => navigate("/texts/new")}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-[10px] bg-[var(--color-text)] text-[var(--color-surface)] font-semibold text-[15px] transition-opacity hover:opacity-90"
          >
            <Plus size={18} />
            Start Reading
          </button>
          <button
            onClick={() => navigate("/learn")}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] font-semibold text-[15px] transition-colors hover:bg-[var(--color-bg)]"
          >
            <Brain size={18} />
            Learn
          </button>
          <button
            onClick={() => navigate("/words")}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] font-semibold text-[15px] transition-colors hover:bg-[var(--color-bg)]"
          >
            <List size={18} />
            Word List
          </button>
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-[17px] font-bold">Recent Texts</h2>
            <button
              onClick={() => navigate("/texts")}
              className="text-[13px] text-[var(--color-text2)] hover:text-[var(--color-text)] transition-colors"
            >
              See all
            </button>
          </div>
          {textsLoading ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-[12px] bg-[var(--color-bg2)] animate-pulse"
                />
              ))}
            </div>
          ) : recentTexts.length === 0 ? (
            <div className="text-center py-10 text-[var(--color-text3)]">
              <BookOpen size={36} className="mx-auto mb-2.5" />
              <p className="text-[15px]">No texts yet. Add one!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentTexts.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/texts/${t.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[12px] bg-[var(--color-surface)] border border-[var(--color-border)] text-left hover:bg-[var(--color-bg2)] transition-colors"
                >
                  <BookOpen
                    size={18}
                    className="shrink-0 text-[var(--color-text3)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold truncate">
                      {t.title}
                    </p>
                    <p className="text-[12px] text-[var(--color-text3)] uppercase tracking-wide mt-0.5">
                      {t.language_code}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
