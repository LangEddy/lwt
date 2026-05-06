import { ExternalLink, X } from "lucide-react";
import { useMemo, useState } from "react";

interface DictionaryViewerProps {
  open: boolean;
  title: string;
  url: string;
  onClose: () => void;
}

export default function DictionaryViewer({
  open,
  title,
  url,
  onClose,
}: DictionaryViewerProps) {
  const [loadFailed, setLoadFailed] = useState(false);

  const src = useMemo(() => {
    try {
      return new URL(url).toString();
    } catch {
      return "";
    }
  }, [url]);

  if (!open || !src) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full h-[92vh] sm:h-[86vh] sm:max-w-4xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-t-[14px] sm:rounded-[14px] shadow-xl overflow-hidden flex flex-col">
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold truncate">Dictionary</p>
            <p className="text-[12px] text-[var(--color-text3)] truncate">
              {title}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-semibold text-[var(--color-text2)] hover:bg-[var(--color-bg2)] transition-colors"
            >
              <ExternalLink size={14} />
              Open externally
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-[8px] text-[var(--color-text3)] hover:bg-[var(--color-bg2)] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {loadFailed ? (
            <div className="h-full flex flex-col items-center justify-center px-6 text-center">
              <p className="text-[15px] font-semibold mb-1">
                Cannot open inside app
              </p>
              <p className="text-[13px] text-[var(--color-text3)] mb-4">
                This dictionary blocks in-app embedding. Open it in a browser
                tab.
              </p>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[var(--color-text)] text-[var(--color-surface)] text-[13px] font-semibold"
              >
                <ExternalLink size={15} />
                Open dictionary
              </a>
            </div>
          ) : (
            <iframe
              title={`Dictionary for ${title}`}
              src={src}
              className="w-full h-full border-0"
              onError={() => setLoadFailed(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
