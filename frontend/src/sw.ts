/// <reference lib="webworker" />
//
// Custom service worker for the LWT PWA.
//
// Mental model:
//   1. The browser downloads this file once per deployment (the build hash
//      changes via the injected `__WB_MANIFEST`, which forces a byte-diff).
//   2. On `install` we precache every app-shell asset listed in the manifest.
//   3. On `activate` we drop any precaches from older deploys.
//   4. On every `fetch`, our routes decide: serve from cache, hit the network,
//      or some mix. Anything we don't match falls through to the network.
//
// The `skipWaiting` is gated on a message from the page so the user gets to
// confirm the reload (see registerSW.ts and the prompt UI we'll add later).

import { clientsClaim } from "workbox-core";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope;

// `self.__WB_MANIFEST` is replaced at build time by vite-plugin-pwa with the
// list of precachable build artifacts (hashed filenames + revisions).
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA navigation fallback: any request the browser tags as a navigation
// (top-level document load) is answered with the precached index.html.
// React Router then renders the right page. denylist keeps the API and the
// service worker itself out of this catch-all.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//, /^\/sw\.js$/, /^\/manifest\.webmanifest$/],
  }),
);

// Google Fonts stylesheet — small, changes rarely. Stale-while-revalidate
// returns the cached copy instantly and refreshes in the background.
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new StaleWhileRevalidate({ cacheName: "google-fonts-stylesheets" }),
);

// Google Fonts files (woff2). Cache-first with a long expiry — these never
// change for a given URL.
registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts-webfonts",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// Anything to Supabase or our own /api is user-scoped and auth-bound.
// We deliberately do NOT cache it in the SW; the app's Dexie/IndexedDB
// layer handles local persistence where it makes sense. Returning early
// (no `registerRoute` match) makes the request fall through to the network.

// Allow the page to tell the new SW to take over immediately when the user
// accepts the "update available" prompt.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Once activated, control any open tabs without requiring a reload.
clientsClaim();
