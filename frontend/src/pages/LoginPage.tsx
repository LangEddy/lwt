import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const setToken = useAuthStore(s => s.setToken)
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Dev auth: any email/password works, token is the dev token
    setTimeout(() => {
      setToken(import.meta.env.VITE_DEV_AUTH_TOKEN || 'dev-token-change-me')
      setLoading(false)
      navigate('/')
    }, 600)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-bg)]">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-9">
          <div className="font-serif text-4xl mb-1.5 tracking-tight">LWT</div>
          <p className="text-[15px] text-[var(--color-text2)] leading-relaxed">
            Learn vocabulary by reading.
            <br />
            Click words, track progress.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-[var(--color-text2)] uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3.5 py-3 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] text-[15px] outline-none focus:border-[var(--color-text)] transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-[var(--color-text2)] uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3.5 py-3 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] text-[15px] outline-none focus:border-[var(--color-text)] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-1 py-3.5 px-5 rounded-[10px] bg-[var(--color-text)] text-[var(--color-surface)] font-semibold text-[15px] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[var(--color-border)]" />
          <span className="text-xs text-[var(--color-text3)] font-medium">or</span>
          <div className="flex-1 h-px bg-[var(--color-border)]" />
        </div>

        <button
          onClick={handleSubmit}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] font-semibold text-[15px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg)]"
        >
          Continue with Google
        </button>
      </div>
    </div>
  )
}
