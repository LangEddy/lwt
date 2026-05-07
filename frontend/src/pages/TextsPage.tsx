import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Plus, Search, Trash2 } from 'lucide-react'
import { useTexts } from '../hooks/useTexts'
import { contentToPlainText } from '../lib/contentParser'

export default function TextsPage() {
  const [search, setSearch] = useState('')
  const { texts, loading, deleteText } = useTexts()
  const navigate = useNavigate()

  const previews = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of texts) {
      map.set(t.id, contentToPlainText(t.content, t.content_type))
    }
    return map
  }, [texts])

  const needle = search.toLowerCase()
  const filtered = texts.filter(t => {
    const preview = previews.get(t.id) ?? ''
    return (
      t.title.toLowerCase().includes(needle) ||
      preview.toLowerCase().includes(needle)
    )
  })

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Search bar */}
      <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="relative max-w-xl mx-auto">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text3)]"
          />
          <input
            placeholder="Search texts…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2.5 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-bg)] text-[15px] outline-none focus:border-[var(--color-text)] transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="max-w-xl mx-auto flex flex-col gap-2">
          <button
            onClick={() => navigate('/texts/new')}
            className="flex items-center justify-center gap-2 py-3.5 rounded-[12px] border-[1.5px] border-dashed border-[var(--color-border)] text-[15px] font-semibold text-[var(--color-text2)] hover:bg-[var(--color-bg)] transition-colors"
          >
            <Plus size={18} />
            New Text
          </button>

          {loading && (
            <div className="text-center py-10 text-[var(--color-text3)]">Loading…</div>
          )}

          {filtered.map(t => (
            <div
              key={t.id}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[12px] p-3.5 flex items-start gap-3"
            >
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => navigate(`/texts/${t.id}`)}
              >
                <div className="flex gap-2 items-center mb-1">
                  <span className="font-bold text-[15px]">{t.title}</span>
                  <span className="inline-flex items-center px-[7px] py-0.5 rounded-md bg-[var(--color-bg2)] text-[var(--color-text2)] text-[11px] font-bold tracking-wider">
                    {t.language_code.toUpperCase()}
                  </span>
                </div>
                <p className="text-[13px] text-[var(--color-text2)] leading-relaxed line-clamp-2">
                  {previews.get(t.id) ?? ''}
                </p>
                <div className="text-[11px] text-[var(--color-text3)] mt-1">
                  {new Date(t.created_at).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={async () => {
                  if (confirm('Delete this text?')) {
                    await deleteText(t.id)
                  }
                }}
                className="p-2 text-[var(--color-text3)] hover:text-[var(--color-red)] transition-colors shrink-0"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-10 text-[var(--color-text3)]">
              <BookOpen size={36} className="mx-auto mb-2.5" />
              <p className="text-[15px]">No texts yet. Add one!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
