import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { COALESCE_MS, startsNewStep, type CoalesceRun } from "@/lib/history-coalesce";

/** Feeds a series of changes through, the way the hook does; returns how many steps they took. */
function steps(changes: [key: string, at: number][]): number {
  let run: CoalesceRun | null = null;
  let taken = 0;
  for (const [key, at] of changes) {
    if (startsNewStep(run, key, at)) taken++;
    run = { key, at };
  }
  return taken;
}

describe("startsNewStep", () => {
  test("the first change takes a step", () => {
    assert.equal(startsNewStep(null, "wallColors", 0), true);
  });

  test("a picker drag, a report every 16 ms for 3 s, is one step", () => {
    const drag = Array.from({ length: 188 }, (_, i): [string, number] => ["wallColors", i * 16]);
    assert.equal(steps(drag), 1);
  });

  test("the window runs from the last change, not the first", () => {
    const slowDrag = Array.from({ length: 10 }, (_, i): [string, number] => [
      "flooring",
      i * (COALESCE_MS - 1),
    ]);
    assert.equal(steps(slowDrag), 1);
  });

  test("a pick after a pause is a new step", () => {
    assert.equal(
      steps([
        ["wallColors", 0],
        ["wallColors", COALESCE_MS],
      ]),
      2,
    );
  });

  test("a different setting is a new step, however soon", () => {
    assert.equal(
      steps([
        ["wallColors", 0],
        ["flooring", 10],
        ["wallColors", 20],
      ]),
      3,
    );
  });
});
