import { useEffect, useState } from "react";
import { setupServiceWorker } from "../lib/registerSW";

type State =
  | { kind: "idle" }
  | { kind: "offline-ready" }
  | { kind: "update-available"; reload: () => Promise<void> };

export function UpdateBanner() {
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    setupServiceWorker({
      onOfflineReady() {
        setState({ kind: "offline-ready" });
      },
      onNeedRefresh(reload) {
        setState({ kind: "update-available", reload });
      },
    });
  }, []);

  useEffect(() => {
    if (state.kind !== "offline-ready") return;
    const id = setTimeout(() => setState({ kind: "idle" }), 4000);
    return () => clearTimeout(id);
  }, [state.kind]);

  if (state.kind === "idle") return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg">
      {state.kind === "offline-ready" ? (
        <span>Ready to work offline.</span>
      ) : (
        <div className="flex items-center gap-3">
          <span>A new version is available.</span>
          <button
            type="button"
            onClick={() => state.reload()}
            className="rounded bg-violet-500 px-3 py-1 font-medium hover:bg-violet-400"
          >
            Reload
          </button>
        </div>
      )}
    </div>
  );
}
