/**
 * Shareable links: a room travels inside the link itself, after the `#`. Browsers never send
 * the fragment to a server, so a shared room never leaves the two browsers involved -- the same
 * promise as the rest of the app (no account, no backend).
 *
 * Format: `r1.` + base64url(deflate-raw(JSON)). The JSON is the room export payload
 * (buildRoomExportPreview) plus the room's name and colour; `r1` is there so a later format can
 * be told apart. CompressionStream is built into every current browser and Node, so this needs
 * no dependency.
 */
const PREFIX = "r1.";

/**
 * A decoded link may inflate to at most this many bytes. A real room is a few KB (an import is
 * capped at 1000 items anyway); the cap is there so a crafted link can't inflate into hundreds
 * of megabytes in someone's tab.
 */
export const MAX_SHARE_BYTES = 2_000_000;

export class ShareLinkError extends Error {}

async function pipe(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
  limit = Infinity,
) {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new ShareLinkError("The link holds more than a room can be.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new ShareLinkError("The link is damaged.");
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** The part after `#` for `payload`. */
export async function encodeShare(payload: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(payload));
  return PREFIX + toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

/**
 * The payload a link's fragment (with or without the leading `#`) carries. Throws ShareLinkError
 * for anything that isn't one of ours, damaged or too big; what it returns still has to go
 * through importSchema like any other import.
 */
export async function decodeShare(fragment: string): Promise<unknown> {
  const body = fragment.replace(/^#/, "");
  if (!body.startsWith(PREFIX)) throw new ShareLinkError("This isn't a PLANUM room link.");
  let json: Uint8Array<ArrayBuffer>;
  try {
    json = await pipe(
      fromBase64Url(body.slice(PREFIX.length)),
      new DecompressionStream("deflate-raw"),
      MAX_SHARE_BYTES,
    );
  } catch (err) {
    if (err instanceof ShareLinkError) throw err;
    throw new ShareLinkError("The link is damaged.");
  }
  try {
    return JSON.parse(new TextDecoder().decode(json));
  } catch {
    throw new ShareLinkError("The link is damaged.");
  }
}

export function shareUrl(origin: string, encoded: string): string {
  return `${origin}/share#${encoded}`;
}
