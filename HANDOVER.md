# Handover — 2026-07-31 (PLANUM rebrand, sloped ceilings, wizard polish)

Session state for whoever picks this up next. **Delete this file once it's been
absorbed** — durable engineering knowledge belongs in `docs/LEARNINGS.md`, and
the running work log belongs in `todo.md`. This file is only the bits that go
stale: what's in flight right now and what to do next.

## Read these first, in this order

1. `todo.md` — the work log. The most recent sections are at the bottom and
   describe everything below in more detail.
2. `docs/SLOPED-WALLS-PROPOSAL.md` — the design for sloped ceilings
   (Dachschrägen). Phases 0–4 are **built**; the doc's phasing table records
   what each phase covered and what's deliberately out of scope.
3. `docs/LEARNINGS.md` — the "why" notes for the trickiest parts of the
   codebase. New sections this session cover the two-stores model, the
   hydration-gate trap, and live-editable SVG canvases.

## State of the repo

Branch `release`. Four commits landed this session, ending at `27cb46a`.

**Committed and done:**

- Single-room / multi-room split (separate store, separate `/room/$roomId`
  route), the onboarding dashboard, saved-lists with delete for both halves.
- Sloped ceilings, phases 0–4: `RoomLayout.ceilingHeight` + `wallSlopes`, the
  2D slope overlay, furniture fit warnings, and the 3D ceiling + knee walls.
- The floors-resurrection fix (`isFloorArray` accepting an empty building).

**Uncommitted — the whole working tree is one coherent batch, all verified:**

- **PLANUM rebrand.** Name, tagline, meta, README, new `public/logo.svg`.
- **Ceiling opacity fix.** The ceiling was pinned near 10% opacity from every
  angle; it now uses the identical fade rule as walls.
- **Openings vs slopes.** Openings are refused on a sloped wall; adding a slope
  to a wall that has them asks first, then deletes them.
- **Inspector scrolling.** Wheel events inside floating panels no longer zoom
  the canvas.
- **L×W×H item labels** (canvas + Elements list) with a translated tooltip.
  Note this *reordered* the first two numbers from the old `width×length`.
- **Wizard:** larger dialog/canvas, `setWallLength()` so dimension labels are
  editable on every shape, screen-pixel label offsets, label collision
  separation, and the reworked openings step (plan symbols, ghost preview,
  centre snap, drag-to-reposition, per-opening width presets).

`npx tsc --noEmit` clean · `npm test` 552/552 · `npx eslint src/` 18 errors /
19 warnings against a **36 / 19 baseline** (fewer than we started with; every
remaining one is pre-existing). Re-run all three before trusting this.

Nothing here was committed by the agent — that's standing behaviour on this
repo, not an oversight.

## What to do next

In the order I'd tackle it:

1. **Look at the uncommitted batch and commit it** if it holds up. It's large
   but coherent. The two things most worth your own eye, because I verified
   them structurally rather than by taste: the **ceiling in 3D** (does the
   fade feel right as you orbit?) and the **wizard's openings step** (door
   swing arcs, the ghost preview, the width presets).
2. **Same room-creation flows inside `/rooms`.** The floor layout's "add room"
   sidebar still has a bare name+size form while the dashboard has
   from-scratch / from-example / guided. This is the biggest remaining
   inconsistency in the app.
3. Then the smaller open items listed at the bottom of `todo.md` — walls
   perpendicular to a slope still render as full-height rectangles, openings
   aren't height-validated against a knee wall, and the ceiling's lighting is
   a flat ambient boost rather than a real relight.

## Things that will bite you

These cost real time this session. Most are now also captured in
`docs/LEARNINGS.md`, but these are the ones specific to working *here*.

- **Testing storage/migration behaviour on a cleared browser profile proves
  nothing.** A deleted floor kept resurrecting for the user and I twice
  "verified" it fixed, because `localStorage.clear()` wipes the very legacy
  key (`planner-multi-rooms`) that caused it. Plant the old key explicitly
  when testing anything that touches `loadFloors()`.
- **The 3D controls panel takes 15–20s to mount** in the preview browser (lazy
  three.js chunk + scene build). Automated polling will race it repeatedly and
  report "not found" long after the code is fine. Wait, then re-query.
- **The screenshot tool frequently returns a stale frame** here. When a
  screenshot disagrees with a DOM query, trust the DOM query. Several
  "regressions" this session were stale frames.
- **`THREE.ShapeGeometry` is indexed.** Reading its `position` attribute in
  threes runs off the end of a 4-corner polygon and yields NaN vertices, which
  three.js only reports much later as `computeBoundingSphere(): Computed
  radius is NaN`. Walk `getIndex()`.
- **An SVG used from `<img>` needs explicit `width`/`height`** — a bare
  `viewBox` gives it no intrinsic size and it renders as *nothing*. And XML
  comments may not contain a double hyphen; one in the first logo draft made
  the whole file fail to parse, which presents identically to a missing file.
- **`resolveWallSegment` walks "bottom" and "left" in reverse winding order**,
  deliberately, so existing rectangular rooms render identically. Any normal
  derived from `a`→`b` is therefore inverted on those two walls. Use
  `inwardNormal()` (`lib/wall-slopes.ts`), which probes the polygon instead.
- **Don't auto-commit, and never let a background agent run `git stash` /
  `reset` / `checkout`** on this repo — there's usually uncommitted work in
  flight.

## Open questions the user has already answered

Don't re-litigate these:

- Ceiling is a **checkbox, off by default** — that's what kept a lighting
  overhaul off the critical path.
- Too-tall furniture **warns, never blocks**.
- Openings on sloped walls are **not supported at all** (removed with a
  confirm), rather than half-modelled.
- Slopes and ceiling height are **per-room**, edited in the Inspector.
- Dormers, hipped ends and multi-pitch roofs are **out of scope**.
- The app is called **PLANUM**.
