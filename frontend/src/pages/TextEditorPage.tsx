import { BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LanguageSelect from "../components/LanguageSelect";
import { useTexts } from "../hooks/useTexts";
import { api } from "../lib/api";
import type { Text, TextContentType } from "../types";

export default function TextEditorPage() {
  const { id } = useParams();
  const { texts, loading, createText, updateText } = useTexts();

  const isEdit = Boolean(id);
  const existing = isEdit ? texts.find((t) => t.id === id) : null;

  if (!isEdit) {
    return <TextForm onCreate={createText} onUpdate={updateText} />;
  }

  if (existing) {
    return (
      <TextForm
        key={existing.id}
        existing={existing}
        onCreate={createText}
        onUpdate={updateText}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text3)]">
        Loading…
      </div>
    );
  }

  // Edit mode but the text wasn't in the cached list — fetch directly.
  return (
    <TextFormFromApi
      textId={id!}
      onCreate={createText}
      onUpdate={updateText}
    />
  );
}

interface TextFormProps {
  existing?: Text;
  onCreate: (text: {
    language_id: string;
    title: string;
    content: string;
    content_type?: TextContentType;
  }) => Promise<Text>;
  onUpdate: (
    id: string,
    text: Partial<{
      language_id: string;
      title: string;
      content: string;
      content_type: TextContentType;
    }>,
  ) => Promise<Text>;
}

function TextForm({ existing, onCreate, onUpdate }: TextFormProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [languageId, setLanguageId] = useState(existing?.language_id ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [contentType, setContentType] = useState<TextContentType>(
    existing?.content_type ?? "plain",
  );
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(existing);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      if (isEdit && existing) {
        await onUpdate(existing.id, {
          title,
          language_id: languageId,
          content,
          content_type: contentType,
        });
        navigate(`/texts/${existing.id}`);
      } else {
        if (!languageId) {
          setSaving(false);
          return;
        }
        await onCreate({
          language_id: languageId,
          title: title || "Untitled",
          content,
          content_type: contentType,
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
            Format
          </label>
          <div className="flex gap-1.5">
            {(["plain", "markdown", "html"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setContentType(opt)}
                className={`flex-1 px-3 py-2 rounded-[10px] border-[1.5px] text-[13px] font-semibold capitalize transition-colors ${
                  contentType === opt
                    ? "border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-surface)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text2)] hover:bg-[var(--color-bg)]"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-[var(--color-text2)] uppercase tracking-wider">
            Text Content
          </label>
          <textarea
            placeholder={
              contentType === "markdown"
                ? "# Heading\n\nParagraph with **bold** and *italic*…"
                : contentType === "html"
                  ? "<h1>Heading</h1>\n<p>Paragraph…</p>"
                  : "Paste your text here…"
            }
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            className="w-full px-3.5 py-3 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] text-[15px] outline-none focus:border-[var(--color-text)] transition-colors resize-y leading-relaxed font-mono"
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

interface TextFormFromApiProps extends Omit<TextFormProps, "existing"> {
  textId: string;
}

function TextFormFromApi({ textId, ...rest }: TextFormFromApiProps) {
  const [fetched, setFetched] = useState<Text | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Text>(`/api/texts/${textId}`)
      .then((data) => {
        if (!cancelled) setFetched(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [textId]);

  if (error) {
    return <TextForm {...rest} />;
  }

  if (!fetched) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text3)]">
        Loading…
      </div>
    );
  }

  return <TextForm key={fetched.id} existing={fetched} {...rest} />;
}
