# Handover — 2026-07-30 (onboarding dashboard + IKEA room wizard)

Session context for whoever (human or agent) picks this repo up next. Written because the
conversation that produced this work ran long enough that a fresh chat/agent is the likely next
step. Delete or replace this file once its contents have been absorbed / are stale.

## ⚠️ Start here: the most important open problem

**Single-room and multi-room are currently the same data structure and the same route, and that's
now actively confusing users.** The user flagged this explicitly and asked that it be the first
thing addressed next session. Full detail in "Critical next step" below — read that before doing
anything else in this codebase.

## State of the repo right now

- Branch: `release`. Working tree has **uncommitted changes** — the whole onboarding dashboard +
  IKEA wizard effort described below (`git status`/`git diff` for the full list). Deliberately
  left uncommitted: never asked to commit this session (see `.claude` memory,
  "autonomous work comfort").
- New files: `src/routes/dashboard.tsx`, `src/hooks/use-settings.ts`, `src/lib/settings.ts`,
  `src/lib/single-room-templates.ts`, `src/lib/room-shapes.ts`,
  `src/components/dashboard/{Dashboard,CreateSingleRoomFlow,CreateFloorFlow,RecentlyOpened,
  IkeaRoomWizard,RoomShapeCanvas}.tsx`, `src/components/planner/SettingsDialog.tsx`,
  `tests/room-shapes.test.ts`.
- Modified: `routes/index.tsx` (now a pure redirect gate), `routes/rooms.$roomId.tsx`,
  `routes/rooms.index.tsx`, `hooks/use-room-planner.ts`, `lib/default-apartment.ts` (5 room
  builders now exported), `lib/hallway-shapes.ts` (+`lineIntersection`, exported `NAMED_WALLS`),
  `lib/multi-room-actions.ts` (+`createRoomLayoutWithCorners`), `components/planner/Header.tsx`,
  `components/planner/canvas/RoomDimensionBadge.tsx`, `types/planner.ts`,
  `tests/hallway-shapes.test.ts`, `todo.md`.
- Earlier in this same session (already **committed** to `release`, not part of the diff above):
  catalog expansion (164→208 presets, commit `2b66049`), a dev-server perf fix (three.js
  lazy-loading, same commit), and full Lovable-platform removal (commit `7656267`). Nothing to do
  there.
- `npx tsc --noEmit`, `npm test` (496 tests), and `npx eslint` all clean — lint baseline is 36
  pre-existing errors / 19 warnings, all unrelated to this session's changes (confirmed via diff
  hunks, not just line-count comparison). Re-run all three before trusting this if time has passed.

## What shipped this session

**Phase 1 — onboarding dashboard.** `/` no longer renders the room planner directly; it's now a
pure redirect gate (`routes/index.tsx`) that sends you to `/dashboard` (the actual dashboard,
`routes/dashboard.tsx`) or straight to your last-active room/floor if the new "quick entry" setting
is on. Dashboard offers: create a single room (from scratch / from example / guided), create a
floor (from scratch / from example), load saved rooms, and a Settings dialog (theme, language,
default view/zoom, collision default, quick entry). Found and fixed two real pre-existing bugs
along the way: `rooms.index.tsx` was unconditionally regenerating the default apartment the first
time `/rooms` ever mounted in a page session (silently discarding real data), and `defaultView`/
`defaultZoom`/`collisionDefault` settings existed in the UI but were never actually wired to
anything.

**Phase 2 — IKEA-style room wizard.** A "Guided (Pick a Shape)" option: pick a shape (Rectangle /
L-Shape / Cut Corner, `lib/room-shapes.ts`), drag any wall to resize it (`dragWallEdge()` —
constrained so both endpoints of the dragged wall move together and every other wall keeps its own
angle, `RoomShapeCanvas.tsx`), then click directly on a wall to place doors/windows, then name it.
Went through two real user-feedback rounds after the initial autonomous build:
1. Canvas was visibly "zooming" during drags (SVG `viewBox` was being recomputed from the live
   corners every frame) → fixed with `computeStableViewBox()`, computed once per shape pick, held
   fixed thereafter.
2. The first version's openings step reused the existing dropdown-based `OpeningsDialog` — user
   feedback: "too hard to guess how it will look" → replaced entirely with click-to-place directly
   on the canvas.
3. Dimension displays showed ~15 decimal digits (line-intersection math produces long floats) →
   rounded at the source in `dragWallEdge`/`resizeRoomShape`, plus defensively in
   `RoomDimensionBadge.tsx`'s display.
4. Dimension label *font size* was still scaling during drags even after the viewBox was
   stabilized (SVG `<text>`'s size is a function of viewBox scale, and stabilizing the viewBox
   doesn't stabilize something whose own size is derived from the live shape) → labels moved out of
   SVG entirely into plain HTML overlay `<div>`s with a fixed Tailwind size, positioned by
   percentage within the stable viewBox.

All of this is browser-verified, not just unit-tested — see `todo.md`'s matching sections for the
detailed verification notes on each round.

## Critical next step: separate single-room and multi-room, for real

The user's own words: *"the single-room and multi-room areas are totally conflated, which is very
confusing... These must be treated as two very distinct areas and separated both in the UI and in
the data structure."*

### The problem, precisely

There is currently **no data-model concept of a standalone single room.** Every "single room"
created via the dashboard (`CreateSingleRoomFlow.tsx`'s from-scratch/from-example, and
`IkeaRoomWizard.tsx`'s finish step) is implemented as a **one-room `Floor`**, created via
`createFloor([room])` and appended to the exact same `planner-multi-floors` array that the real
multi-room/floor system (`/rooms`) manages. Concretely:

- `CreateSingleRoomFlow.tsx` lines ~61-62 and ~72-79: `createRoomLayout(...)` →
  `saveFloors([...floors, createFloor([room])])`.
- `IkeaRoomWizard.tsx` lines ~148-156: `createRoomLayoutWithCorners(...)` → same pattern, plus
  `saveActiveFloorId(floor.id)`.
- Both then `navigate({ to: "/rooms/$roomId", params: { roomId: room.id } })` — the **same route**
  used for a room that's genuinely part of a multi-room floor.
- `routes/rooms.$roomId.tsx` line 302 passes `backUrl="/rooms"` to `CanvasArea`
  **unconditionally** — it has no way to know whether the room it's showing is "really" part of a
  floor with siblings, or a standalone room that just happens to be *stored* as a floor of one.

The visible symptoms the user hit: finishing the wizard shows a "Back to Overview" button (bottom
left) that doesn't make sense for something the user thinks of as just one room, and clicking it
lands you in the multi-room floor-switcher UI — where that "single room" now permanently exists as
its own floor, cluttering the floor list every single time someone creates a "single" room.

### Proposed fix (not implemented — for next session)

Genuinely separate storage and routing, matching what the user explicitly asked for:

1. **New storage**: a `planner-single-rooms` (or similar) localStorage key holding `RoomLayout[]`
   directly — **no `Floor` wrapper**. New helpers (new `lib/single-rooms.ts`, or extend
   `lib/floors.ts`) mirroring `createRoomLayout`/`createRoomLayoutWithCorners` but without the
   floor-wrapping step: `loadSingleRooms()`, `saveSingleRooms()`.
2. **New route**: something like `/room/$roomId` (singular — deliberately distinct from the
   existing plural `/rooms/$roomId`) for standalone single rooms. Renders the same
   `useRoomPlanner`-driven editor UI, but:
   - Loads/saves via the new single-room store, not `lib/floors.ts`.
   - Passes **no** `backUrl` to `CanvasArea` (or points it at `/dashboard` instead of `/rooms` —
     needs a product decision, "no back button at all" vs "back to dashboard").
   - `useRoomPlanner(roomId)` needs to either grow a way to select which backend to read/write
     (an explicit mode param), or — less invasive — try the single-room store first and fall back
     to `floors.ts`, remembering which one it found the room in for the save-back effect. Worth
     designing carefully; this hook is large (~1400 lines) and load-bearing, don't rush the change.
   - `/rooms` and `/rooms/$roomId` stay **completely unchanged** — still exclusively the
     multi-room/floor system.
3. **Rewire the three creation call sites** (`CreateSingleRoomFlow.tsx` x2,
   `IkeaRoomWizard.tsx` x1) to save into the new single-room store and navigate to the new
   `/room/$roomId` route instead of `createFloor`/`/rooms/$roomId`.
4. **Migration**: don't bother migrating any single-room-as-floor artifacts that already exist from
   this session's own testing (or the user's own use) — just leave them as ordinary floors in
   `/rooms`; harmless clutter, not worth the complexity of detecting/converting them.

A simpler alternative was considered and **deliberately rejected**: just add a flag (e.g.
`Floor.isStandaloneSingleRoom`) to suppress the back button and skip floor-list visibility, keeping
everything in the same `planner-multi-floors` store. This would be much less invasive, but the user
was explicit that they want real separation "in the UI **and in the data structure**" — don't
re-propose the flag shortcut without checking with them first, they already ruled it out.

### Two content-correctness follow-ups (same conversation, smaller, need user input)

1. **Single-room "from example"** — user asked that this show "the default office I supplied to
   you in the import JSON... matching the original entry into the app." This is very likely
   already correct: `buildDefaultOfficeItems()`/`buildDefaultOfficeOpenings()` in
   `hooks/use-room-planner.ts` carry a doc comment saying they're "the user's own hand-tuned pass
   over the generated default (exported 2026-07, re-imported here verbatim)," and
   `lib/single-room-templates.ts`'s "Home Office" entry already uses them. **But confirm with the
   user** whether they mean (a) just double-check that entry is byte-correct, or (b) they actually
   want "from example" to skip the 6-item gallery entirely and go straight to the office demo,
   matching how `/` used to work pre-dashboard (a single example, not a picker). Don't guess which.
2. **Multi-room "from example"** — same ask, for `generateDefaultApartmentLayout()` in
   `lib/default-apartment.ts`. That file's extremely precise, non-round decimal coordinates (e.g.
   `16.5569247483989`) strongly suggest it's *also* already a real hand-tuned export, not
   synthetic data — but this hasn't been explicitly confirmed against whatever "apartment floor
   JSON" the user is referring to. Ask them where that JSON lives if it's not already correctly
   reflected here (check whether it's a file already in the repo/conversation history first).
3. **Multi-room "from scratch"** (`CreateFloorFlow.tsx`'s empty-floor path) — the user's described
   expectation ("empty ground floor canvas where they can place rooms and hallways from the
   original sidebar") already matches current behavior (`createFloor([])` → `/rooms`, which already
   has that add-room/add-hallway sidebar). Just re-verify this doesn't regress as a side effect of
   the single/multi separation work above — it shouldn't, since `CreateFloorFlow.tsx` isn't
   involved in that fix at all, but confirm after.

## Other open items (lower priority, from earlier in this session)

From `todo.md`'s Phase 2 sections, still not done, roughly in priority order:
- Drag-sensitivity tuning on shallow/diagonal walls (a moderate drag on the Cut Corner shape's
  diagonal wall can hit the minimum-size rejection sooner than an axis-aligned wall would — correct
  behavior, just worth a closer look once there's more usage).
- Mobile/touch support for both the wall-drag and click-to-place interactions in
  `RoomShapeCanvas.tsx` (pointer events should mostly work on touch already via the Pointer Events
  API, but genuinely untested on a touch device).
- General visual polish on the wizard — deliberately not a priority per the user ("leave most of
  the visual and ux testing to me").
- The wizard ships 3 shapes (Rectangle/L/Cut Corner), not 4 — "T-shape" was dropped as an
  autonomous scope call (uncommon for a single room; the existing hallway system already covers
  T-junctions). Never explicitly confirmed with the user; revisit if they ask for it.

## Patterns worth knowing before touching this code

- **The Floor/RoomLayout data model has no bare-room concept** — this is the root cause of the
  critical issue above. `Floor { id, name, rooms: RoomLayout[] }` is the only way a `RoomLayout` is
  ever persisted today. Any future "create a room" flow needs to reckon with this until the fix
  above lands.
- **`dragWallEdge()`** (`lib/room-shapes.ts`) — "constrained whole-wall parallel translation":
  projects the drag delta onto the wall's own outward normal (an along-wall component is a no-op),
  translates the wall, re-intersects with each *unchanged* neighboring wall's line
  (`lineIntersection`, `lib/hallway-shapes.ts`) for the two new corner positions, rejects the whole
  drag if it would invert a neighbor or shrink the room's bounding box below ~60cm. Rounds every
  committed result to 2 decimals — don't remove that, it's the fix for a real "15 decimal digits"
  bug, not a stylistic choice.
- **Stable-viewBox + fixed-size-text pattern** (`RoomShapeCanvas.tsx`,
  `computeStableViewBox()` in `room-shapes.ts`) — any future "live-editable shape in an SVG
  viewBox" UI in this app should follow this: (1) compute the viewBox once, from the *starting*
  shape, never from the live one being edited; (2) `vector-effect="non-scaling-stroke"` keeps line
  widths visually constant regardless of viewBox scale, but there's **no SVG equivalent for
  `font-size`** — any text that needs to stay a constant on-screen size has to be plain HTML
  (absolutely-positioned, percentage-mapped into the viewBox), not SVG `<text>`.
- **`TOUR_KEY`** (exported from `hooks/use-room-planner.ts`) — the onboarding tour auto-opens the
  first time `useRoomPlanner` ever mounts, unconditionally. Every dashboard-driven room-creation
  path marks it done at creation time (`window.localStorage.setItem(TOUR_KEY, "1")`) so the tour
  doesn't ambush a room the user just deliberately built. Any *new* room-creation entry point needs
  to do the same.
- **`useSettings()`'s `hydrated` flag** (`hooks/use-settings.ts`) — the hook starts at
  `DEFAULT_SETTINGS` (SSR-safe placeholder) and only reflects the real localStorage value after its
  own effect fires. Anything that needs to seed *other* state from a setting exactly once (like
  `use-room-planner.ts` applying `defaultView`/`defaultZoom`/`collisionDefault`) must gate on
  `hydrated` flipping true, not just read `settings` directly — otherwise it silently captures the
  placeholder forever (a `useState` initializer/one-shot effect only runs once).

## Testing/verification conventions

- `npx tsc --noEmit`, `npm test`, `npx eslint <files>` — when checking for *new* lint issues, diff
  individual diagnostic lines/hunks against a baseline rather than trusting the summary footer
  count alone.
- Dev server: `.claude/launch.json` has a `room-planner-dev` config (port 8080). If port 8080 is
  already in use by a live `node` process when starting the preview, that's very likely a dev
  server already running (possibly the user's own, possibly left over from an earlier turn in the
  same session) — connect to it directly (`preview_start` with `{url: "http://localhost:8080"}`)
  rather than trying to kill/replace it.
- **Coordinate-space gotcha, confirmed again this session**: `computer{action:"screenshot"}`
  returns a scaled-down image (e.g. 800×450 for a 1280×720 real viewport) that does not map 1:1 to
  real click coordinates. For anything needing precision (dragging a specific SVG wall, clicking a
  specific small element), query the DOM directly via `javascript_tool`
  (`element.getBoundingClientRect()`, scaled by screenshot-width/real-width) rather than eyeballing
  screenshot pixels — cost real time more than once this session before being applied consistently.
- **A drag that "does nothing" isn't necessarily a bug** — verify via before/after DOM state
  (attribute values, computed styles) before concluding an interaction is broken. This session hit
  a case where a large wall-drag was being *correctly* rejected by `dragWallEdge`'s own degeneracy
  guard, which looked identical to "the click didn't register" from the outside.
- **A long-lived browser tab's console history isn't reliable evidence of current state** — HMR
  hot-swaps can leave stale error messages (e.g. a `ReferenceError` for an identifier removed two
  edits ago) sitting in `read_console_messages`'s output. Open a fresh tab or hard-reload before
  trusting a console error as still-current.
- Test onboarding/first-run flows (tours, first-visit defaults, "is anything saved yet" branches)
  against a genuinely empty/fresh browser profile, not just one with existing data — existing data
  masks exactly the kind of first-visit-only bugs this session found twice.

## Gotchas from this and earlier sessions worth not repeating

- **Never let a background Agent run `git stash`/`git reset`/`git checkout`** on a repo with other
  uncommitted work in flight, even as an internal "diffing trick" — happened once in an earlier
  session, self-corrected, but cost a full re-verification pass. Explicitly forbid this in any
  file-editing agent prompt.
- Mobile/view-only mode (`useMobileViewOnly`, <1024px viewport width) hides the entire Sidebar and
  most editing chrome. If a browser-driven test seems to be failing to select/interact with
  something that should obviously be there, check the viewport width first.
- Don't auto-commit. Nothing in this session was committed by the agent; that's deliberate standing
  behavior, not an oversight — confirm with the user first.
