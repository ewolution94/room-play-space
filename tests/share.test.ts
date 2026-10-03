import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { decodeShare, encodeShare, shareUrl, MAX_SHARE_BYTES, ShareLinkError } from "@/lib/share";
import {
  buildDefaultOfficeItems,
  buildDefaultOfficeOpenings,
  DEFAULT_ROOM_W,
  DEFAULT_ROOM_L,
} from "@/hooks/use-room-planner";
import { importSchema } from "@/lib/planner-schema";

// The shipped home-office example, as a share link carries it.
const office = {
  version: 3,
  name: "Home Office",
  color: "#14b8a6",
  room: { width: DEFAULT_ROOM_W, length: DEFAULT_ROOM_L },
  openings: buildDefaultOfficeOpenings(),
  items: buildDefaultOfficeItems(),
};

const rejects = (fragment: string, message: RegExp) =>
  assert.rejects(decodeShare(fragment), (err: unknown) => {
    assert.ok(err instanceof ShareLinkError, String(err));
    assert.match((err as Error).message, message);
    return true;
  });

describe("share links", () => {
  test("a room survives the round trip, and still passes the import schema", async () => {
    const back = await decodeShare(await encodeShare(office));
    assert.deepEqual(back, JSON.parse(JSON.stringify(office)));
    assert.equal(importSchema.safeParse(back).success, true);
  });

  test("the fragment is URL-safe and compact: the furnished example office stays under 3 KB", async () => {
    const encoded = await encodeShare(office);
    assert.match(encoded, /^r1\.[A-Za-z0-9_-]+$/);
    const json = JSON.stringify(office).length;
    assert.ok(encoded.length < 3000, `${encoded.length} chars for ${json} chars of JSON`);
  });

  test("a leading # is fine, and the link is origin + /share#", async () => {
    const encoded = await encodeShare({ a: 1 });
    assert.deepEqual(await decodeShare(`#${encoded}`), { a: 1 });
    assert.equal(
      shareUrl("https://planum.example", encoded),
      `https://planum.example/share#${encoded}`,
    );
  });

  test("refuses what isn't one of ours, or is damaged", async () => {
    await rejects("", /isn't a PLANUM room link/);
    await rejects("x1.abc", /isn't a PLANUM room link/);
    await rejects("r1.not*base64", /damaged/);
    await rejects("r1.AAAA", /damaged/); // valid base64, not deflate data
    // Valid deflate data that isn't JSON: "{oops", compressed by hand.
    const stream = new Blob([new TextEncoder().encode("{oops")])
      .stream()
      .pipeThrough(new CompressionStream("deflate-raw"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    const b64 = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    await rejects(`r1.${b64}`, /damaged/);
  });

  test("a link that would inflate past the cap is refused, not unpacked", async () => {
    // Zeros compress to almost nothing: a tiny link standing for a huge payload.
    const bomb = await encodeShare("0".repeat(MAX_SHARE_BYTES + 10));
    assert.ok(bomb.length < 20_000, `${bomb.length} chars`);
    await rejects(bomb, /more than a room/);
  });
});
