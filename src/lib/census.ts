/**
 * Census, the self-hosted visit counter: no cookies, nothing stored on the device. The beacon
 * comes from our own origin (census.js, wired into entry.js, forwards /_e.js and /_e).
 *
 * The beacon counts every path change as a page view, so it's loaded only once the first route
 * is settled: `/` and the legacy `/rooms…` routes replace themselves with the real page as soon as
 * they arrive (routes/index.tsx waits for the settings first), and loading it on one of those
 * would count that one visit twice. Production only, like the service worker.
 */
let loaded = false;

/** Routes that only ever redirect: routes/index.tsx, routes/rooms.index.tsx, routes/rooms.$roomId.tsx. */
export function isRedirectGate(pathname: string): boolean {
  return pathname === "/" || pathname === "/rooms" || pathname.startsWith("/rooms/");
}

export function loadCensus() {
  if (loaded || !import.meta.env.PROD) return;
  loaded = true;
  const script = document.createElement("script");
  script.src = "/_e.js";
  document.head.append(script);
}
