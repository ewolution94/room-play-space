import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createCensus } from "../census.js";
import { isRedirectGate } from "@/lib/census";

// A stand-in for Census's ingest port, recording what the forwarder sends it.
type Seen = {
  method?: string;
  url?: string;
  headers: http.IncomingHttpHeaders;
  body: string;
};
let upstream: http.Server;
let upstreamUrl = "";
let seen: Seen[] = [];

before(async () => {
  upstream = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      seen.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: Buffer.concat(chunks).toString(),
      });
      if (req.url === "/_e.js") {
        if (req.headers["if-none-match"] === '"b1"') {
          res.writeHead(304, { etag: '"b1"' }).end();
          return;
        }
        res
          .writeHead(200, {
            "content-type": "text/javascript; charset=utf-8",
            "cache-control": "no-cache",
            etag: '"b1"',
            "x-internal": "no",
          })
          .end("/* beacon */");
        return;
      }
      res.writeHead(204).end();
    });
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
});

after(() => upstream.close());

const on = (path: string, init?: RequestInit) => new Request(`http://planum.test${path}`, init);

describe("census forwarder", () => {
  test("passes the beacon through, with its caching headers and nothing else", async () => {
    seen = [];
    const census = createCensus({ target: upstreamUrl, site: "planum" });
    const res = (await census(on("/_e.js")))!;
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "/* beacon */");
    assert.equal(res.headers.get("etag"), '"b1"');
    assert.equal(res.headers.get("cache-control"), "no-cache");
    assert.equal(res.headers.get("x-internal"), null);

    const again = (await census(on("/_e.js", { headers: { "if-none-match": '"b1"' } })))!;
    assert.equal(again.status, 304);
  });

  test("forwards a page view with the headers Census reads, and its own X-Site", async () => {
    seen = [];
    const census = createCensus({ target: upstreamUrl, site: "planum" });
    const view = on("/_e", {
      method: "POST",
      body: '{"t":"pv","p":"/dashboard"}',
      headers: {
        "content-type": "text/plain;charset=UTF-8",
        "user-agent": "Mozilla/5.0 test",
        "cf-connecting-ip": "203.0.113.7",
        "cf-ipcountry": "DE",
        "sec-gpc": "1",
        "x-site": "landing",
        "x-forwarded-for": "198.51.100.1",
        cookie: "a=b",
      },
    });
    const res = (await census(view, "::ffff:192.168.178.20"))!;
    assert.equal(res.status, 204);
    const [hit] = seen;
    assert.equal(hit.method, "POST");
    assert.equal(hit.url, "/_e");
    assert.equal(hit.body, '{"t":"pv","p":"/dashboard"}');
    assert.equal(hit.headers["x-site"], "planum");
    assert.equal(hit.headers["user-agent"], "Mozilla/5.0 test");
    assert.equal(hit.headers["cf-connecting-ip"], "203.0.113.7");
    assert.equal(hit.headers["cf-ipcountry"], "DE");
    assert.equal(hit.headers["sec-gpc"], "1");
    assert.equal(hit.headers["x-forwarded-for"], "192.168.178.20");
    assert.equal(hit.headers.cookie, undefined);
  });

  test("refuses oversized bodies and wrong methods without calling Census", async () => {
    seen = [];
    const census = createCensus({ target: upstreamUrl, site: "planum" });
    const big = "x".repeat(5000);
    assert.equal((await census(on("/_e", { method: "POST", body: big })))!.status, 413);
    assert.equal((await census(on("/_e")))!.status, 405);
    assert.equal((await census(on("/_e.js", { method: "POST", body: "" })))!.status, 405);
    assert.equal(seen.length, 0);
  });

  test("refuses an oversized body that arrives as a stream with no Content-Length", async () => {
    seen = [];
    const census = createCensus({ target: upstreamUrl, site: "planum" });
    const chunk = new TextEncoder().encode("x".repeat(1000));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent++ < 5) controller.enqueue(chunk);
        else controller.close();
      },
    });
    const req = on("/_e", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    assert.equal(req.headers.get("content-length"), null);
    assert.equal((await census(req))!.status, 413);
    assert.equal(seen.length, 0);
  });

  test("leaves every other path alone", async () => {
    const census = createCensus({ target: upstreamUrl, site: "planum" });
    for (const path of ["/", "/_e/x", "/_e.json", "/dashboard"]) {
      assert.equal(await census(on(path)), null, path);
    }
  });

  test("answers 502 when Census is unreachable", async () => {
    const census = createCensus({ target: "http://127.0.0.1:9", site: "planum", timeout: 1000 });
    assert.equal((await census(on("/_e.js")))!.status, 502);
    assert.equal((await census(on("/_e", { method: "POST", body: "{}" })))!.status, 502);
  });

  test("without a target: an empty beacon, and views go nowhere", async () => {
    seen = [];
    const census = createCensus({ target: "", site: "planum" });
    const res = (await census(on("/_e.js")))!;
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /javascript/);
    assert.equal(await res.text(), "");
    assert.equal((await census(on("/_e", { method: "POST", body: "{}" })))!.status, 204);
    assert.equal(seen.length, 0);
  });
});

describe("isRedirectGate (where the beacon must not load yet)", () => {
  test("the entry gate and the legacy /rooms routes redirect", () => {
    for (const path of ["/", "/rooms", "/rooms/", "/rooms/abc"]) {
      assert.equal(isRedirectGate(path), true, path);
    }
  });

  test("real pages count", () => {
    for (const path of ["/dashboard", "/room/abc", "/home/h1", "/home/h1/room/r1"]) {
      assert.equal(isRedirectGate(path), false, path);
    }
  });
});
