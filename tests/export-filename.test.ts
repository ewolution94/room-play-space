import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { slugify, buildExportFilename, sanitizeFilenameForDownload } from "@/lib/export-filename";

describe("slugify", () => {
  test("lowercases and hyphenates spaces", () => {
    assert.equal(slugify("Home Office"), "home-office");
  });

  test("strips accents instead of dropping the whole word", () => {
    assert.equal(slugify("Büro"), "buro");
  });

  test("strips punctuation and collapses runs of separators", () => {
    assert.equal(slugify("Kitchen (Ground Floor)!!"), "kitchen-ground-floor");
  });

  test("trims leading/trailing hyphens left over from stripped punctuation", () => {
    assert.equal(slugify("--Guest Room--"), "guest-room");
  });

  test("falls back to 'layout' for a label with nothing slug-worthy", () => {
    assert.equal(slugify(""), "layout");
    assert.equal(slugify("   "), "layout");
    assert.equal(slugify("!!!"), "layout");
  });
});

describe("buildExportFilename", () => {
  test("combines the slugified label with today's date and a .json extension", () => {
    const name = buildExportFilename("Home Office");
    assert.match(name, /^home-office-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

describe("sanitizeFilenameForDownload", () => {
  test("trims whitespace", () => {
    assert.equal(sanitizeFilenameForDownload("  my-room  "), "my-room.json");
  });

  test("strips filesystem-illegal characters", () => {
    assert.equal(sanitizeFilenameForDownload('my/cool:file*name?"<>|'), "mycoolfilename.json");
  });

  test("replaces internal whitespace with hyphens", () => {
    assert.equal(sanitizeFilenameForDownload("my cool room"), "my-cool-room.json");
  });

  test("appends .json when missing", () => {
    assert.equal(sanitizeFilenameForDownload("plain-name"), "plain-name.json");
  });

  test("normalizes an existing .json extension regardless of case instead of doubling it", () => {
    assert.equal(sanitizeFilenameForDownload("already-named.json"), "already-named.json");
    assert.equal(sanitizeFilenameForDownload("already-named.JSON"), "already-named.json");
  });

  test("swaps out a different extension for .json rather than keeping both", () => {
    assert.equal(sanitizeFilenameForDownload("export.txt"), "export.txt.json");
  });

  test("falls back to 'layout.json' for an empty/whitespace-only name", () => {
    assert.equal(sanitizeFilenameForDownload(""), "layout.json");
    assert.equal(sanitizeFilenameForDownload("   "), "layout.json");
  });
});
