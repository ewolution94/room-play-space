/**
 * The offline shell, the same pattern as Clinch's (clinch/client/public/sw.js).
 *
 * PLANUM keeps everything in the browser's localStorage, so with its code
 * cached it needs no server at all. Installed to a home screen it should open
 * like an app, instantly, and open with no signal too, instead of a browser
 * error, straight into the rooms that are already on the device.
 *
 * Every byte of this lives in the visitor's own browser cache, and clearing
 * site data removes all of it (the plans themselves are in localStorage and
 * are not touched by anything here).
 *
 * Three rules, and the reasoning matters more than the code:
 *
 *  - **Navigations go to the network first.** Cached HTML is only served when
 *    the network actually fails. Cache-first would be faster still, but then a
 *    deploy could not reach anyone who keeps the app installed.
 *  - **Fingerprinted files go to the cache first.** Everything under /assets/
 *    carries a content hash, and the Kenney models under /models/ never change
 *    in place, so a hit is always correct and a miss just fetches.
 *  - **Everything else of ours is network-first, cache as a fallback**: the
 *    icons, favicon and manifest keep their names across deploys.
 *
 * ⚠️ The offline page is the root route's HTML, served for every route, and
 * that relies on TanStack Start. Its pages are rendered on the server, one
 * route at a time, so unlike Clinch no single page is "the" document. But
 * served at another URL, the root route's HTML makes the client router notice
 * that the last server-rendered match isn't the one the URL asks for, and it
 * switches to SPA mode: it loads that route in the browser instead of
 * hydrating it (router-core ssr-client.js, `isSpaMode`). "/" renders nothing
 * of its own (it's the redirect gate), so there's nothing to mismatch.
 *
 * ⚠️ The whole app is precached, from the build's own list, and kept current
 * after every deploy — and that is what makes offline real rather than
 * apparent. Clinch reads the files to cache out of its shell's HTML, which is
 * enough there because its shell names its whole app. Here each page names
 * only its own route's chunks: with that approach a room that had never been
 * opened online showed "This page didn't load" offline. Measured, not assumed.
 * And because sw.js itself rarely changes, install alone would stop at the
 * first deploy's files; hence the top-up on every online page load.
 *
 * To retire this worker, ship one whose `install` calls
 * `self.registration.unregister()` — deleting the file only leaves the last
 * installed copy running.
 */

/** Bump to evict everything a previous version cached. */
const VERSION = "v1";
const SHELL = `planum-shell-${VERSION}`;
const ASSETS = `planum-assets-${VERSION}`;
const MINE = [SHELL, ASSETS];

/** The document every route falls back to when offline. */
const SHELL_URL = "/";

/** Every file under /assets/ in the running build, and the 3D models; written by vite.config.ts. */
const PRECACHE_LIST = "/precache.json";

const CACHE_FIRST = ["/assets/", "/models/"];

/**
 * Brings the asset cache in line with the deployed build: fetches whatever
 * the build's list names that isn't cached yet, and drops what it no longer
 * names. Only does real work when the list changed since the last run, so on
 * an ordinary page load it costs one small request.
 *
 * It's about 4.8 MB, most of it the 3D view (1.8 MB) and the Kenney models
 * (1.5 MB): the price of a room opening in 3D offline, furniture and all. The
 * code is paid again once per deploy, in the background; the models almost
 * never change, so they're fetched once.
 */
async function syncAssets() {
  const response = await fetch(PRECACHE_LIST, { cache: "no-store" });
  if (!storable(response)) return;
  const text = await response.clone().text();

  const shell = await caches.open(SHELL);
  const known = await shell.match(PRECACHE_LIST);
  if (known && (await known.text()) === text) return;

  const wanted = new Set(JSON.parse(text));
  const assets = await caches.open(ASSETS);
  const cached = new Set((await assets.keys()).map((request) => new URL(request.url).pathname));
  const missing = [...wanted].filter((href) => !cached.has(href));
  const results = await Promise.allSettled(
    missing.map((href) => assets.add(new Request(href, { cache: "reload" }))),
  );

  // Only a complete copy is recorded as current, so a sync cut short by a
  // dropped connection is retried on the next page load.
  if (results.every((result) => result.status === "fulfilled")) {
    await shell.put(PRECACHE_LIST, response);
    // Files of past deploys are unreachable now: the pages that named them
    // are gone from the server and from this cache.
    for (const href of cached) {
      if (!wanted.has(href)) await assets.delete(href);
    }
  }
}

async function precacheShell() {
  const response = await fetch(SHELL_URL, { cache: "reload" });
  if (storable(response)) await (await caches.open(SHELL)).put(SHELL_URL, response);
  await syncAssets();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    precacheShell()
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !MINE.includes(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Only a real, own-origin 200 is worth keeping. */
function storable(response) {
  return response && response.status === 200 && response.type === "basic";
}

/**
 * Looked up by opening the cache rather than via `caches.match`'s `cacheName`
 * option — the option is spec'd but is one more thing that has behaved
 * differently between engines, and this path is the one that has to work on the
 * engine we cannot test here.
 */
async function matchIn(cacheName, request) {
  const cache = await caches.open(cacheName);
  return cache.match(request);
}

/** Cache first: these never change under a given URL. */
async function fromCacheFirst(request) {
  const hit = await matchIn(ASSETS, request);
  if (hit) return hit;

  const response = await fetch(request);
  if (storable(response)) {
    const copy = response.clone();
    void caches.open(ASSETS).then((cache) => cache.put(request, copy));
  }
  return response;
}

/** Network first, cache as a fallback. */
async function fromNetworkFirst(request, cacheName) {
  try {
    // `no-store`, because otherwise "network first" quietly means "HTTP cache
    // first": the browser can answer this fetch from its own cache, and then a
    // redeployed file never lands. Clinch measured exactly that.
    const response = await fetch(request, { cache: "no-store" });
    if (storable(response)) {
      const copy = response.clone();
      void caches.open(cacheName).then((cache) => cache.put(request, copy));
    }
    return response;
  } catch (error) {
    const hit = await matchIn(cacheName, request);
    if (hit) return hit;
    throw error;
  }
}

/**
 * The offline shell and the asset cache, both brought up to the deploy the
 * server is running now. Called after any full page load that reached the
 * network; in-app navigation never gets here. The shell is 3 kB.
 */
async function refresh(pathname, response) {
  const shell = await caches.open(SHELL);
  if (pathname === SHELL_URL) {
    await shell.put(SHELL_URL, response);
  } else {
    const fresh = await fetch(SHELL_URL, { cache: "no-store", credentials: "same-origin" });
    if (storable(fresh)) await shell.put(SHELL_URL, fresh);
  }
  await syncAssets();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Census's beacon (census.js): always from the network, never into a cache.
  if (url.pathname === "/_e.js" || url.pathname === "/_e") return;

  if (request.mode === "navigate") {
    // Fetched by URL rather than by passing the request on: a navigation
    // request cannot be re-created with different options (the constructor
    // rejects mode "navigate"), and `no-store` is the whole point here.
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request.url, {
            cache: "no-store",
            credentials: "same-origin",
          });
          if (storable(response))
            event.waitUntil(refresh(url.pathname, response.clone()).catch(() => undefined));
          return response;
        } catch {
          return (await matchIn(SHELL, SHELL_URL)) ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (CACHE_FIRST.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(fromCacheFirst(request));
    return;
  }

  event.respondWith(fromNetworkFirst(request, SHELL));
});
