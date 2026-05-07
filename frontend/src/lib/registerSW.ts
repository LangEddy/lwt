// Registers the service worker built from src/sw.ts.
//
// `virtual:pwa-register` is a virtual module from vite-plugin-pwa that wraps
// the registration boilerplate. It returns a function that, when called,
// registers the SW and gives us callbacks for two interesting moments:
//
//   - onNeedRefresh: a NEW service worker has installed but is waiting to
//     take over (the user has the OLD app loaded). We expose a hook so the
//     UI can prompt for a reload.
//   - onOfflineReady: the FIRST install finished and the app shell is
//     cached — the app will work offline from now on.
//
// We keep this module side-effect free at import time and call register()
// from main.tsx so we control timing.

import { registerSW } from "virtual:pwa-register";

export type SWHooks = {
  onNeedRefresh?: (reload: () => Promise<void>) => void;
  onOfflineReady?: () => void;
};

export function setupServiceWorker(hooks: SWHooks = {}) {
  if (typeof window === "undefined") return;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      hooks.onNeedRefresh?.(async () => {
        // `updateSW(true)` posts SKIP_WAITING to the new SW and reloads the
        // page once it's controlling.
        await updateSW(true);
      });
    },
    onOfflineReady() {
      hooks.onOfflineReady?.();
    },
    onRegisterError(err) {
      console.error("SW registration failed", err);
    },
  });
}
