import { create } from 'zustand'

interface AuthState {
  token: string | null
  user: { id: string; email: string } | null
  isLoading: boolean
  setToken: (token: string | null) => void
  setUser: (user: { id: string; email: string } | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('access_token'),
  user: null,
  isLoading: false,
  setToken: (token) => {
    if (token) {
      localStorage.setItem('access_token', token)
    } else {
      localStorage.removeItem('access_token')
    }
    set({ token })
  },
  setUser: (user) => set({ user }),
  logout: () => {
    localStorage.removeItem('access_token')
    set({ token: null, user: null })
  },
}))
