// The forwarder for Census, the self-hosted visit counter (development/census). No
// dependencies, and only fetch, Request and Response, so Bun runs it in entry.js and Node runs
// it in the tests. A port of Cantina's server/census.mjs, which is written against node:http.
//
// The browser loads /_e.js and posts page views to /_e on this origin. Both are passed through
// unchanged to the Census container over the NAS's shared Docker network (`ewolution`), with only
// the headers Census reads, plus X-Site naming this app. It computes nothing: the hashing and the
// opt-out and bot rules all live in Census.
//
// With no target configured (local runs, or PLANUM_CENSUS unset on the NAS), it answers with an
// empty beacon and accepts views without sending them anywhere, so nothing is counted.

const FORWARDED = [
  "user-agent",
  "cf-connecting-ip",
  "cf-ipcountry",
  "sec-gpc",
  "dnt",
  "content-type",
  "if-none-match",
];
const RETURNED = ["content-type", "cache-control", "etag", "x-content-type-options"];
/** A page view is well under 1 KB; Census refuses more than that anyway. */
const MAX_BODY = 2048;

/**
 * @param {{ target?: string, site: string, timeout?: number }} options
 *   target  Census's ingest origin, e.g. http://census:4901; empty turns forwarding off
 * @returns {(request: Request, clientAddress?: string) => Promise<Response | null>}
 *   the answer when the request was one of ours, null to let the app handle it
 */
export function createCensus({ target, site, timeout = 5000 }) {
  return async function census(request, clientAddress = "") {
    const { pathname } = new URL(request.url);
    if (pathname !== "/_e" && pathname !== "/_e.js") return null;

    const script = pathname === "/_e.js";
    if (
      script ? request.method !== "GET" && request.method !== "HEAD" : request.method !== "POST"
    ) {
      return new Response(null, { status: 405 });
    }

    let body;
    if (!script) {
      body = await readBody(request, MAX_BODY);
      if (body === null) return new Response(null, { status: 413 });
    }

    if (!target) {
      if (!script) return new Response(null, { status: 204 });
      return new Response("", {
        headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" },
      });
    }

    // The visitor's address: Cloudflare's header when it's there; Census falls back to this one
    // for a visit over the LAN. Whatever the client sent as X-Forwarded-For or X-Site is dropped.
    const headers = { "x-site": site, "x-forwarded-for": clientAddress.replace(/^::ffff:/, "") };
    for (const name of FORWARDED) {
      const value = request.headers.get(name);
      if (value !== null) headers[name] = value;
    }

    try {
      const upstream = await fetch(new URL(pathname, target), {
        method: request.method,
        headers,
        body,
        signal: AbortSignal.timeout(timeout),
      });
      const out = {};
      for (const name of RETURNED) {
        const value = upstream.headers.get(name);
        if (value) out[name] = value;
      }
      // A Response can't be built with a body for these, even an empty one.
      const bodiless =
        request.method === "HEAD" || upstream.status === 204 || upstream.status === 304;
      return new Response(bodiless ? null : await upstream.arrayBuffer(), {
        status: upstream.status,
        headers: out,
      });
    } catch {
      // Census down, or not on the network yet: the beacon gives up quietly, the page doesn't care.
      return new Response(null, { status: 502 });
    }
  };
}

/** The whole body, or null once it passes `limit` bytes. */
async function readBody(request, limit) {
  if (Number(request.headers.get("content-length")) > limit) return null;
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const whole = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    whole.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return whole;
}
