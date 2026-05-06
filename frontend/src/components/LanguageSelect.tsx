import { Star } from 'lucide-react'
import { useLanguages } from '../hooks/useLanguages'

interface LanguageSelectProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
}

export default function LanguageSelect({
  value,
  onChange,
  placeholder = 'Select language…',
  required = false,
}: LanguageSelectProps) {
  const { languages, toggleFavorite } = useLanguages()

  const handleChange = (langId: string) => {
    const lang = languages.find(l => l.id === langId)
    if (lang && !lang.is_favorite) {
      toggleFavorite(langId, true)
    }
    onChange(langId)
  }

  const favorites = languages.filter(l => l.is_favorite)
  const others = languages.filter(l => !l.is_favorite)

  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => handleChange(e.target.value)}
        required={required}
        className="w-full px-3.5 py-3 pr-10 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] text-[15px] outline-none focus:border-[var(--color-text)] transition-colors appearance-none cursor-pointer"
      >
        <option value="" disabled>
          {placeholder}
        </option>

        {favorites.length > 0 && (
          <optgroup label="Favorites">
            {favorites.map(l => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </optgroup>
        )}

        {others.length > 0 && (
          <optgroup label="Other">
            {others.map(l => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {/* Star toggle */}
      {value && (
        <button
          type="button"
          onClick={e => {
            e.preventDefault()
            const lang = languages.find(l => l.id === value)
            if (lang) toggleFavorite(value, !lang.is_favorite)
          }}
          className="absolute right-8 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-[var(--color-bg2)] transition-colors"
          title={languages.find(l => l.id === value)?.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star
            size={16}
            className={
              languages.find(l => l.id === value)?.is_favorite
                ? 'fill-[var(--color-amber)] text-[var(--color-amber)]'
                : 'text-[var(--color-text3)]'
            }
          />
        </button>
      )}
    </div>
  )
}
