import { test } from "node:test";
import assert from "node:assert/strict";
import { isPhoneViewport } from "@/lib/viewport";

// CSS-pixel viewports of real devices, portrait and landscape.
const phones: [string, number, number][] = [
  ["iPhone SE", 375, 667],
  ["iPhone 15", 393, 852],
  ["iPhone 15 Pro Max", 430, 932],
  ["Pixel 8", 412, 915],
];
const tablets: [string, number, number][] = [
  ["iPad mini", 744, 1133],
  ["iPad 10th gen", 820, 1180],
  ["iPad Pro 11", 834, 1194],
  ["iPad Pro 12.9", 1024, 1366],
];

test("a phone is look-only in both orientations", () => {
  for (const [name, w, h] of phones) {
    assert.equal(isPhoneViewport(w, h), true, `${name} portrait`);
    assert.equal(isPhoneViewport(h, w), true, `${name} landscape`);
  }
});

test("a tablet gets the editor in both orientations, portrait included", () => {
  for (const [name, w, h] of tablets) {
    assert.equal(isPhoneViewport(w, h), false, `${name} portrait`);
    assert.equal(isPhoneViewport(h, w), false, `${name} landscape`);
  }
});

test("a desktop window counts by its short side too", () => {
  assert.equal(isPhoneViewport(1440, 900), false);
  assert.equal(isPhoneViewport(900, 700), false); // narrow, but not a phone
  assert.equal(isPhoneViewport(1200, 500), true); // squashed very flat
});
