import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Language } from '../types'

export function useLanguages() {
  const [languages, setLanguages] = useState<Language[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLanguages = useCallback(() => {
    setLoading(true)
    api.get<Language[]>('/api/languages')
      .then(data => {
        setLanguages(data)
        setError(null)
      })
      .catch(err => {
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchLanguages()
  }, [fetchLanguages])

  const toggleFavorite = useCallback(async (languageId: string, isFavorite: boolean) => {
    await api.put(`/api/languages/${languageId}/settings`, { is_favorite: isFavorite })
    setLanguages(prev =>
      prev.map(l =>
        l.id === languageId ? { ...l, is_favorite: isFavorite } : l
      )
    )
  }, [])

  return { languages, loading, error, fetchLanguages, toggleFavorite }
}
