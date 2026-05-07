import { ArrowLeft, BookOpen, Paintbrush, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DictionaryViewer from "../components/DictionaryViewer";
import WordPopup from "../components/WordPopup";
import { useDictionary } from "../hooks/useDictionary";
import { useLanguageSettings } from "../hooks/useLanguageSettings";
import { useTts } from "../hooks/useTts";
import { useWords } from "../hooks/useWords";
import { api } from "../lib/api";
import { initTokenizer, normalizeWord, tokenize } from "../lib/tokenizer";
import type { Text, Word, WordLevel } from "../types";

interface TokenState {
  type: "word" | "separator";
  value: string;
  index: number;
  wordId?: string;
  level?: WordLevel;
  isPhrase?: boolean;
  phraseStart?: number;
  phraseEnd?: number;
}

export default function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [text, setText] = useState<Text | null>(null);
  const [textStatus, setTextStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("loading");
  const [textError, setTextError] = useState<string | null>(null);

  const {
    words,
    loading: wordsLoading,
    createWord,
    updateWord,
    deleteWord,
    getWordByText,
  } = useWords(text?.language_id);

  const [selectedRange, setSelectedRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [dictionaryUrl, setDictionaryUrl] = useState<string | null>(null);

  const { settings: languageSettings } = useLanguageSettings(text?.language_id);
  const { supported: ttsSupported, speak } = useTts(
    text?.language_code,
    languageSettings?.tts_voice,
  );
  const { buildUrl } = useDictionary(languageSettings?.dictionary_url);

  useEffect(() => {
    if (!id) return;
    initTokenizer().then(() =>
      api
        .get<Text>(`/api/texts/${id}`)
        .then((data) => {
          setText(data);
          setTextError(null);
          setTextStatus("ready");
        })
        .catch((err) => {
          setTextError(err.message);
          setTextStatus("error");
        }),
    );
  }, [id]);

  const isTextLoading =
    textStatus === "loading" || (Boolean(id) && text?.id !== id && !textError);

  const tokens = useMemo(() => {
    if (!text) return [];
    return tokenize(text.content);
  }, [text]);

  const tokenStates = useMemo(() => {
    const states: TokenState[] = tokens.map((t, i) => ({ ...t, index: i }));

    // Build a map of normalized single words
    const singleWordMap = new Map<string, Word>();
    for (const w of words) {
      if (!w.is_phrase) {
        singleWordMap.set(normalizeWord(w.word), w);
      }
    }

    // First pass: mark single words
    for (let i = 0; i < states.length; i++) {
      const t = states[i];
      if (t.type !== "word") continue;
      const w = singleWordMap.get(normalizeWord(t.value));
      if (w) {
        states[i].wordId = w.id;
        states[i].level = w.level;
      }
    }

    // Second pass: mark phrases
    const phrases = words.filter((w) => w.is_phrase);
    for (const phrase of phrases) {
      const phraseWords = tokenize(phrase.word)
        .filter((t) => t.type === "word")
        .map((t) => normalizeWord(t.value));
      if (phraseWords.length < 2) continue;

      const wordPositions: number[] = [];
      for (let i = 0; i < states.length; i++) {
        if (states[i].type === "word") {
          wordPositions.push(i);
        }
      }

      for (
        let start = 0;
        start <= wordPositions.length - phraseWords.length;
        start++
      ) {
        let match = true;
        for (let k = 0; k < phraseWords.length; k++) {
          const pos = wordPositions[start + k];
          if (
            states[pos].isPhrase ||
            normalizeWord(states[pos].value) !== phraseWords[k]
          ) {
            match = false;
            break;
          }
        }

        if (match) {
          for (let k = 0; k < phraseWords.length; k++) {
            const pos = wordPositions[start + k];
            states[pos].wordId = phrase.id;
            states[pos].level = phrase.level;
            states[pos].isPhrase = true;
            states[pos].phraseStart = wordPositions[start];
            states[pos].phraseEnd =
              wordPositions[start + phraseWords.length - 1];
          }
        }
      }
    }

    return states;
  }, [tokens, words]);

  const handleTokenClick = (index: number) => {
    const t = tokenStates[index];
    if (t.type !== "word") return;

    // If part of a phrase, select the whole phrase
    if (
      t.isPhrase &&
      t.phraseStart !== undefined &&
      t.phraseEnd !== undefined
    ) {
      setSelectedRange({ start: t.phraseStart, end: t.phraseEnd });
    } else {
      setSelectedRange({ start: index, end: index });
    }
    setPopupOpen(true);
  };

  // Full display text (includes separators like commas/spaces between tokens)
  const selectedText = useMemo(() => {
    if (!selectedRange) return "";
    return tokens
      .slice(selectedRange.start, selectedRange.end + 1)
      .map((t) => t.value)
      .join("");
  }, [selectedRange, tokens]);

  // Word-only text used for DB lookup — joins word tokens with single space
  const selectedWordLookupText = useMemo(() => {
    if (!selectedRange) return "";
    return tokens
      .slice(selectedRange.start, selectedRange.end + 1)
      .filter((t) => t.type === "word")
      .map((t) => t.value)
      .join(" ");
  }, [selectedRange, tokens]);

  const selectedWord = useMemo(() => {
    if (!selectedWordLookupText) return undefined;
    return getWordByText(selectedWordLookupText);
  }, [selectedWordLookupText, getWordByText]);

  const selectedSentence = useMemo(() => {
    if (!selectedRange || tokens.length === 0) return "";

    const isSentenceBoundary = (value: string) => /[.!?\n]/.test(value);

    let start = selectedRange.start;
    while (start > 0) {
      const prev = tokens[start - 1];
      if (prev.type === "separator" && isSentenceBoundary(prev.value)) break;
      start--;
    }

    let end = selectedRange.end;
    while (end < tokens.length - 1) {
      const current = tokens[end];
      if (current.type === "separator" && isSentenceBoundary(current.value)) {
        break;
      }
      end++;
    }

    return tokens
      .slice(start, end + 1)
      .map((t) => t.value)
      .join("")
      .trim();
  }, [selectedRange, tokens]);

  const handleSave = async (
    level: WordLevel,
    note: string,
    isPhrase: boolean,
    pendingExample?: {
      sentence: string;
      translation?: string;
      note?: string;
    },
  ) => {
    if (!text || !selectedRange) return;

    const wordText = tokens
      .slice(selectedRange.start, selectedRange.end + 1)
      .filter((t) => t.type === "word")
      .map((t) => t.value)
      .join(" ");

    let savedWord: Word;

    if (selectedWord) {
      savedWord = await updateWord(selectedWord.id, { level, note });
    } else {
      savedWord = await createWord({
        language_id: text.language_id,
        text_id: text.id,
        word: wordText,
        is_phrase: isPhrase || selectedRange.start !== selectedRange.end,
        level,
        note,
      });
    }

    const sentence = pendingExample?.sentence?.trim();
    if (sentence) {
      await api.post(`/api/words/${savedWord.id}/examples`, {
        sentence,
        translation: pendingExample?.translation?.trim() || undefined,
        note: pendingExample?.note?.trim() || undefined,
      });
    }

    setPopupOpen(false);
    setSelectedRange(null);
  };

  const handleDelete = async () => {
    if (!selectedWord) return;
    await deleteWord(selectedWord.id);
    setPopupOpen(false);
    setSelectedRange(null);
  };

  const handleExpandLeft = () => {
    if (!selectedRange) return;
    let newStart = selectedRange.start - 1;
    while (newStart >= 0 && tokenStates[newStart].type !== "word") {
      newStart--;
    }
    if (newStart >= 0) {
      setSelectedRange({ start: newStart, end: selectedRange.end });
    }
  };

  const handleExpandRight = () => {
    if (!selectedRange) return;
    let newEnd = selectedRange.end + 1;
    while (newEnd < tokenStates.length && tokenStates[newEnd].type !== "word") {
      newEnd++;
    }
    if (newEnd < tokenStates.length) {
      setSelectedRange({ start: selectedRange.start, end: newEnd });
    }
  };

  const handleShrinkLeft = () => {
    if (!selectedRange) return;
    let newStart = selectedRange.start + 1;
    while (
      newStart <= selectedRange.end &&
      tokenStates[newStart].type !== "word"
    ) {
      newStart++;
    }
    if (newStart <= selectedRange.end) {
      setSelectedRange({ start: newStart, end: selectedRange.end });
    }
  };

  const handleShrinkRight = () => {
    if (!selectedRange) return;
    let newEnd = selectedRange.end - 1;
    while (
      newEnd >= selectedRange.start &&
      tokenStates[newEnd].type !== "word"
    ) {
      newEnd--;
    }
    if (newEnd >= selectedRange.start) {
      setSelectedRange({ start: selectedRange.start, end: newEnd });
    }
  };

  if (isTextLoading || wordsLoading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text3)]">
        Loading…
      </div>
    );
  }

  if (textError || !text) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-text3)] gap-3">
        <BookOpen size={36} />
        <p className="text-[15px]">{textError || "Text not found"}</p>
        <button
          onClick={() => navigate("/texts")}
          className="px-4 py-2 rounded-[10px] bg-[var(--color-text)] text-[var(--color-surface)] text-[13px] font-semibold"
        >
          Back to texts
        </button>
      </div>
    );
  }

  const direction =
    text.language_code === "ar" || text.language_code === "he" ? "rtl" : "ltr";

  const handleOpenDictionary = (value: string) => {
    const url = buildUrl(value);
    if (!url) return;
    setDictionaryUrl(url);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate("/texts")}
            className="p-2 rounded-[10px] hover:bg-[var(--color-bg2)] text-[var(--color-text2)] transition-colors shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-[17px] truncate">{text.title}</h1>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-wider text-[var(--color-text3)] uppercase">
                {text.language_code}
              </span>
              <span className="text-[11px] text-[var(--color-text3)]">
                {words.length} words tracked
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sweep toolbar */}
      <div className="shrink-0 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          {/* Level legend */}
          <div className="flex items-center gap-2">
            {[
              { level: 0 as const, name: "Unseen" },
              { level: 1 as const, name: "Unknown" },
              { level: 2 as const, name: "Seen" },
              { level: 3 as const, name: "Ok-ish" },
              { level: 4 as const, name: "Good" },
              { level: 5 as const, name: "Known" },
            ].map((l) => (
              <span
                key={l.level}
                className="flex items-center gap-1"
                title={l.name}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      l.level === 5
                        ? "transparent"
                        : `var(--color-word-${l.level}-bg)`,
                    border:
                      l.level === 5 ? "2px solid var(--color-border)" : "none",
                  }}
                />
                <span className="text-[10px] font-medium text-[var(--color-text2)] hidden sm:inline">
                  {l.name}
                </span>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(`/texts/${text.id}/edit`)}
              className="p-2 rounded-[10px] hover:bg-[var(--color-bg2)] text-[var(--color-text3)] hover:text-[var(--color-text)] transition-colors"
              title="Edit text"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={async () => {
                if (confirm("Delete this text?")) {
                  await api.delete(`/api/texts/${text.id}`);
                  navigate("/texts");
                }
              }}
              className="p-2 rounded-[10px] hover:bg-[var(--color-red-bg)] text-[var(--color-text3)] hover:text-[var(--color-red)] transition-colors"
              title="Delete text"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={async () => {
                if (!confirm("Mark all unseen words as Unknown?")) return;
                // Deduplicate by normalized text to avoid creating one entry per occurrence
                const uniqueUnseen = new Map<string, string>();
                for (const t of tokenStates) {
                  if (t.type === "word" && !t.level) {
                    const key = normalizeWord(t.value);
                    if (!uniqueUnseen.has(key)) uniqueUnseen.set(key, t.value);
                  }
                }
                for (const wordValue of uniqueUnseen.values()) {
                  await createWord({
                    language_id: text.language_id,
                    text_id: text.id,
                    word: wordValue,
                    is_phrase: false,
                    level: 1,
                    note: "",
                  });
                }
              }}
              className="flex items-center gap-1 px-2 py-1.5 rounded-[8px] text-[11px] font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text2)] hover:bg-[var(--color-bg2)] transition-colors shrink-0"
            >
              <Paintbrush size={12} />
              Sweep
            </button>
          </div>
        </div>
      </div>

      {/* Text content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-xl mx-auto">
          <div
            className="text-[18px] leading-[1.9] text-[var(--color-text)] whitespace-pre-wrap font-serif"
            dir={direction}
            style={{ textAlign: direction === "rtl" ? "right" : "left" }}
          >
            {tokenStates.map((t) => {
              const i = t.index;
              if (t.type === "separator") {
                return <span key={i}>{t.value}</span>;
              }

              const isSelected =
                selectedRange &&
                i >= selectedRange.start &&
                i <= selectedRange.end;
              const level = t.level;
              const visualLevel: WordLevel = level ?? 1;

              let className =
                "cursor-pointer rounded-[4px] px-[2px] transition-all duration-150 ";
              const style: React.CSSProperties = {};

              if (isSelected) {
                className +=
                  "ring-2 ring-[var(--color-accent)] ring-offset-1 ring-offset-[var(--color-bg)] ";
              }

              if (t.isPhrase) {
                className += "border-b-[1.5px] border-dotted ";
              }

              style.backgroundColor = `var(--color-word-${visualLevel}-bg)`;
              style.color = `var(--color-word-${visualLevel}-text)`;

              return (
                <span
                  key={i}
                  className={className}
                  style={style}
                  onClick={() => handleTokenClick(i)}
                >
                  {t.value}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Word Popup */}
      {popupOpen && selectedRange && (
        <WordPopup
          wordText={selectedText}
          sourceSentence={selectedSentence}
          existingWord={selectedWord}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => {
            setPopupOpen(false);
            setSelectedRange(null);
          }}
          onExpandLeft={handleExpandLeft}
          onExpandRight={handleExpandRight}
          onShrinkLeft={
            selectedRange.start !== selectedRange.end
              ? handleShrinkLeft
              : undefined
          }
          onShrinkRight={
            selectedRange.start !== selectedRange.end
              ? handleShrinkRight
              : undefined
          }
          canExpandLeft={tokenStates
            .slice(0, selectedRange.start)
            .some((t) => t.type === "word")}
          canExpandRight={tokenStates
            .slice(selectedRange.end + 1)
            .some((t) => t.type === "word")}
          ttsEnabled={ttsSupported}
          dictionaryEnabled={Boolean(languageSettings?.dictionary_url)}
          onSpeakWord={(value) => speak(value)}
          onSpeakSource={(value) => speak(value)}
          onSpeakExample={(value) => speak(value)}
          onOpenDictionary={handleOpenDictionary}
        />
      )}

      {dictionaryUrl && (
        <DictionaryViewer
          open={Boolean(dictionaryUrl)}
          title={selectedText}
          url={dictionaryUrl}
          onClose={() => setDictionaryUrl(null)}
        />
      )}
    </div>
  );
}
