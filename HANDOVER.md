# Handover — 2026-07-26/27 overnight session

Session context for whoever (human or agent) picks this repo up next. Written because the
conversation that produced this work ran long enough that a fresh chat/agent is the likely next
step. Delete or replace this file once its contents have been absorbed / are stale.

## State of the repo right now

- Branch: `release`. Working tree has **uncommitted changes** (the "place on top of" feature —
  see `git status`/`git diff`). Deliberately left uncommitted: this session was never asked to
  commit, per standing instruction (see `.claude` memory, "autonomous work comfort").
- Commit `66032d9` ("add collapsible sidebar functionality and implement hover tooltips across UI
  components") already captures everything from earlier in this same session — collapsible
  sidebar, header restructure, app-wide custom tooltips, and the new catalog models (trash bin
  variants, baby gate, ball pit). That commit was made mid-session by the user directly, not by
  the agent.
- `git stash list` still has one entry (`stash@{0}`, "WIP on release: 151257e...") left over from
  a mid-session incident (see Gotchas below) — it's redundant now that everything landed safely,
  but it was deliberately left as a safety net rather than dropped. Safe to `git stash drop` once
  someone's confirmed nothing in it is still needed (it predates commit `66032d9`, so almost
  certainly not).
- `npx tsc --noEmit` clean, full test suite passing (452 tests), `eslint` introduces no new issues
  over baseline. Re-run all three before trusting this doc if much time has passed.

## What shipped this session

Two batches. Full detail lives in `todo.md` (the actionable checklist — checked items are done,
unchecked items under "From the codebase audit" are the open backlog) and in this Claude Code
installation's memory system (`project_custom_catalog_ikea_2026-07.md` has the fullest narrative,
if whoever's reading this has access to it).

**Batch 1** — Custom Catalog + IKEA integration + a mobile nav bug fix, then three rounds of user
feedback on top of it. See `todo.md`'s "Custom Catalog & IKEA Integration" section.

**Batch 2** — a "Next steps" list of five items, all shipped and verified:
1. 3D view: windows now fade with their wall (glass `transmission` wasn't responding to `opacity`).
2. Collapsible sidebar (manual toggle, independent of the automatic mobile cutoff).
3. Header actions regrouped (Undo/Redo segment, theme toggle, File dropdown, More dropdown) on
   both `Header.tsx` and `routes/rooms.index.tsx`'s inline header.
4. Native `title=` tooltips replaced app-wide with a themed, fast (150ms) custom tooltip
   (`components/ui/hover-tooltip.tsx` + restyled `components/ui/tooltip.tsx`).
5. New catalog items: small/large trash bin, recycling box, baby gate ("Babygitter" — a
   border-only frame, no solid panel), ball pit ("Bällebad").

**Batch 3** — "place on top of" attachment, requested mid-batch-2-wrapup. `Item.placedOnId` lets
any item ride on any other placed item regardless of layer, with position following on drag and
elevation auto-derived from the host's current height (`resolveEffectiveElevation` in
`lib/planner-presets.ts`, recomputed fresh every render — not cached). See `todo.md` and the
memory file for the full design writeup; the short version is in the "Open questions" section
below since one part of it was never confirmed by the user.

## Open questions / immediate next steps

Both now tracked in `todo.md` under "Quick win still open":

1. **Host-deletion behavior for "place on top of"** — right now, deleting a host item detaches
   whatever was riding on it (keeps it in place, un-attached) rather than deleting it too. This
   was a genuine open question put to the user that got deferred, not answered. Confirm which
   behavior is wanted; the code to change is `removeItem`/`removeSelected` in
   `hooks/use-room-planner.ts` if it needs to become cascade-delete instead.
2. **Duplicate React keys on IKEA catalog tiles** — pre-existing bug (predates this session's
   work), found and flagged but not fixed. `lib/custom-catalog.ts`'s `customCatalogItemToPreset()`
   uses `item.sourceKey` as the list `key`, and several `IKEA_CATALOG` entries share a sourceKey
   on purpose (multiple beds/bookshelves/sofas/dining tables), so React logs "duplicate key"
   errors on the Add tab. A background task for this was already spawned (chip should still be
   visible in-session); if it wasn't picked up, it's safe to just do directly — the fix and a
   regression test are both spelled out in the `todo.md` entry.

Beyond those two, `todo.md`'s "From the codebase audit" section has the rest of the standing
backlog (unrelated to this session, pre-existing) — nothing in it is urgent.

## Patterns worth knowing before touching this code

- **`customCatalogItemToPreset()`** (`lib/custom-catalog.ts`) is the adapter that lets both "My
  Own Catalog" and IKEA items reuse the entire existing rendering/collision/3D pipeline by
  converting into a real `Preset` rather than forking any of that logic. Documented in
  `docs/LEARNINGS.md`. Extend this, don't build a parallel path, if adding another catalog source.
- **`resolveEffectiveElevation()`** (`lib/planner-presets.ts`, re-exported from
  `ThreeDView.tsx` alongside `getDefaultHeight`) is the render-time-only elevation resolver for
  attached items — deliberately not stored/cached, so resizing a host item never requires a sync
  step. Only two call sites need it (both in `ThreeDView.tsx`); the 2D canvas never reads
  elevation at all. Don't confuse this with the older, unrelated `findOnTopHost`/
  `computeOnTopElevation` in `lib/planner-math.ts`, which is a purely position/footprint-based
  auto-settle for "on-top"-layer items only, recomputed once at drag-drop with no stored
  relationship — the two mechanisms coexist without conflicting (verified), but they're solving
  adjacent, not identical, problems.
- **`HoverTooltip`** (`components/ui/hover-tooltip.tsx`) is now the house tooltip — use it instead
  of a native `title=` attribute anywhere new. One gotcha: if the tooltipped element is *also* a
  trigger for something else (`DropdownMenuTrigger asChild`, `PopoverTrigger asChild`,
  `DrawerTrigger asChild`), `HoverTooltip` must wrap **outside** that trigger, not inside it — it
  doesn't forward arbitrary extra props the way Radix's own `Slot`-based components do, so nesting
  it inside a `*Trigger asChild` silently breaks that trigger's click handling.
- **`useSidebarCollapsed()`** (`hooks/use-sidebar-collapsed.ts`) — same SSR-safe
  false-then-hydrate-in-an-effect pattern as the pre-existing `useMobileViewOnly`, for the same
  reason (avoid a hydration mismatch). Follow this pattern for any new persisted-boolean-affecting-
  layout hook.

## Testing/verification conventions (unchanged from before this session)

- `npx tsc --noEmit`, `npm test` (node:test + node:assert/strict, no jsdom — only pure `lib/`
  functions get unit tests, no component/hook tests exist yet), `npx eslint <files>` — when
  checking for *new* lint issues, diff individual diagnostic lines against a baseline rather than
  trusting the summary footer count (it's been observed to be inconsistent), and filter out
  `prettier/prettier` (formatting, not correctness).
- Dev server: `.claude/launch.json` has a `room-planner-dev` config (port 8080) for the
  `mcp__Claude_Browser__*` preview tools. When clicking in that browser pane, prefer `ref`-based
  clicks from `read_page`/`find` over eyeballed screenshot coordinates — screenshots and the real
  viewport aren't reliably the same pixel scale, confirmed to cause real mis-clicks more than
  once. For the 2D canvas specifically, plain `computer{action:"left_click"}` did not reliably hit
  the SVG/canvas item elements this session (unclear root cause — possibly a custom pointer-event
  contract); clicking the same item's row in the sidebar's "Elements" list, or dispatching a real
  `PointerEvent`/`.click()` on the DOM node found via `document.elementFromPoint`/text search, both
  worked reliably instead.

## Gotchas from this session worth not repeating

- **Never let a background Agent run `git stash`/`git reset`/`git checkout` on a repo with other
  uncommitted work in flight**, even as an internal "diffing trick." One did this mid-task and
  briefly reverted ~20 files' worth of other-in-progress work to the last commit before
  self-correcting via `git stash show`/`git checkout stash@{0} -- <path>` — nothing was lost, but
  it cost a full re-verification pass to confirm that. Explicitly forbid this in any future
  file-editing agent prompt: "only edit files directly; git status/diff read-only if needed."
- Mobile/view-only mode (`useMobileViewOnly`, <1024px viewport width) hides the entire Sidebar and
  most editing chrome. If a browser-driven test seems to be failing to select/interact with
  something that should obviously be there, check the viewport width first before assuming a code
  bug — this cost real time twice this session.
