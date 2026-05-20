import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";
import { supabase } from "../lib/supabase";

const OFFLINE_ACCESS_STORAGE_KEY = "lwt.offline-access-enabled";

function readOfflineAccessFlag() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(OFFLINE_ACCESS_STORAGE_KEY) === "1";
}

function writeOfflineAccessFlag(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (enabled) {
    window.localStorage.setItem(OFFLINE_ACCESS_STORAGE_KEY, "1");
    return;
  }

  window.localStorage.removeItem(OFFLINE_ACCESS_STORAGE_KEY);
}

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  // Derived helper used by PrivateRoute and API layer
  token: string | null;
  canUseOffline: boolean;
  _setSession: (session: Session | null) => void;
  _setAuthReady: () => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  token: null,
  canUseOffline: readOfflineAccessFlag(),
  _setSession: (session) =>
    set((state) => {
      const canUseOffline = state.canUseOffline || Boolean(session);

      if (session) {
        writeOfflineAccessFlag(true);
      }

      return {
        session,
        user: session?.user ?? null,
        token: session?.access_token ?? null,
        isLoading: false,
        canUseOffline,
      };
    }),
  _setAuthReady: () => set((state) => ({ ...state, isLoading: false })),
  logout: async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      writeOfflineAccessFlag(false);
      set({
        session: null,
        user: null,
        token: null,
        isLoading: false,
        canUseOffline: false,
      });
    }
  },
}));

// Bootstrap: restore session on page load and subscribe to auth state changes.
// Called once from main.tsx before rendering.
export function initAuth() {
  let initialSessionSettled = false;

  const markReadyWithoutSession = () => {
    if (initialSessionSettled) return;
    initialSessionSettled = true;
    useAuthStore.getState()._setAuthReady();
  };

  supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      initialSessionSettled = true;
      useAuthStore.getState()._setSession(session);
    })
    .catch((error) => {
      console.warn(
        "Failed to restore Supabase session during app startup",
        error,
      );
      markReadyWithoutSession();
    });

  supabase.auth.onAuthStateChange((_event, session) => {
    initialSessionSettled = true;
    useAuthStore.getState()._setSession(session);
  });

  // If Supabase never resolves the startup call, the app must still render so
  // offline users can reach the login screen and cached UI instead of a blank page.
  window.setTimeout(markReadyWithoutSession, 3000);
}
