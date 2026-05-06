import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
    }
    // Navigation is handled by onAuthStateChange in authStore -> App.tsx route guard
    setLoading(false);
  };

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
              onChange={(e) => setEmail(e.target.value)}
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
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-3 rounded-[10px] border-[1.5px] border-[var(--color-border)] bg-[var(--color-surface)] text-[15px] outline-none focus:border-[var(--color-text)] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-1 py-3.5 px-5 rounded-[10px] bg-[var(--color-text)] text-[var(--color-surface)] font-semibold text-[15px] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>{" "}
          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}{" "}
        </form>
      </div>
    </div>
  );
}
