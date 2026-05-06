import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";
import { supabase } from "../lib/supabase";

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  // Derived helper used by PrivateRoute and API layer
  token: string | null;
  _setSession: (session: Session | null) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  token: null,
  _setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      token: session?.access_token ?? null,
      isLoading: false,
    }),
  logout: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, token: null, isLoading: false });
  },
}));

// Bootstrap: restore session on page load and subscribe to auth state changes.
// Called once from main.tsx before rendering.
export function initAuth() {
  supabase.auth.getSession().then(({ data: { session } }) => {
    useAuthStore.getState()._setSession(session);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState()._setSession(session);
  });
}
