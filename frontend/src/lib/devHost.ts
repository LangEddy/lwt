// Rewrites a configured URL whose host is localhost/127.0.0.1 to use the
// host the page was opened from. Lets `npm run dev` work from a phone or
// another LAN device without having to edit env files per IP.
export function rewriteLocalhostHost(configured: string): string {
  if (!configured || typeof window === "undefined") return configured;
  try {
    const url = new URL(configured);
    const isConfiguredLocal =
      url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const currentHost = window.location.hostname;
    const isCurrentLocal =
      currentHost === "localhost" || currentHost === "127.0.0.1";
    if (isConfiguredLocal && !isCurrentLocal) {
      url.hostname = currentHost;
      return url.toString().replace(/\/$/, "");
    }
    return configured;
  } catch {
    return configured;
  }
}
