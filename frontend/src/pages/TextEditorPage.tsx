import { BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LanguageSelect from "../components/LanguageSelect";
import { useTexts } from "../hooks/useTexts";
import { api } from "../lib/api";
import type { Text } from "../types";

export default function TextEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { texts, loading, createText, updateText } = useTexts();

  const isEdit = Boolean(id);

  const existing = isEdit ? texts.find((t) => t.id === id) : null;

  const [title, setTitle] = useState("");
  const [languageId, setLanguageId] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [prefilledTextId, setPrefilledTextId] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit || !existing) return;
    if (prefilledTextId === existing.id) return;

    setTitle(existing.title);
    setLanguageId(existing.language_id);
    setContent(existing.content);
    setPrefilledTextId(existing.id);
  }, [isEdit, existing, prefilledTextId]);

  useEffect(() => {
    if (!isEdit || !id || existing || loading) return;

    let cancelled = false;
    api
      .get<Text>(`/api/texts/${id}`)
      .then((data) => {
        if (cancelled) return;
        setTitle(data.title);
        setLanguageId(data.language_id);
        setContent(data.content);
        setPrefilledTextId(data.id);
      })
      .catch(() => {
        // Keep form empty if the text cannot be loaded.
      });

    return () => {
      cancelled = true;
    };
  }, [isEdit, id, existing, loading]);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      if (isEdit && id) {
        await updateText(id, { title, language_id: languageId, content });
        navigate(`/texts/${id}`);
      } else {
        if (!languageId) {
          setSaving(false);
          return;
        }
        await createText({
          language_id: languageId,
          title: title || "Untitled",
          content,
        });
        navigate("/texts");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 pb-6 overflow-y-auto">
      <div className="max-w-xl mx-auto flex flex-col gap-4">
        <h2 className="text-[22px] font-bold tracking-tight">
          {isEdit ? "Edit Text" : "New Reading Text"}
        </h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-[var(--color-text2)] uppercase tracking-wider">
            Title
          </label>
          <input
            placeholder="e.g., Chapter 1: The Beginning"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3.5 py-3 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] text-[15px] outline-none focus:border-[var(--color-text)] transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-[var(--color-text2)] uppercase tracking-wider">
            Language
          </label>
          <LanguageSelect
            value={languageId}
            onChange={setLanguageId}
            placeholder="Select language…"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-[var(--color-text2)] uppercase tracking-wider">
            Text Content
          </label>
          <textarea
            placeholder="Paste your text here…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            className="w-full px-3.5 py-3 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] text-[15px] outline-none focus:border-[var(--color-text)] transition-colors resize-y leading-relaxed"
          />
        </div>

        <div className="flex gap-2.5 pb-4">
          <button
            onClick={handleSubmit}
            disabled={saving || !content.trim() || !languageId}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-[10px] bg-[var(--color-text)] text-[var(--color-surface)] font-semibold text-[15px] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <BookOpen size={16} />
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Read Text"}
          </button>
          <button
            onClick={() => navigate("/texts")}
            className="py-3.5 px-5 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] font-semibold text-[15px] transition-colors hover:bg-[var(--color-bg)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
