# Homes: floors belong to something (a proposal)

Written 2026-08-03.

**Status: Phases 0 and 1 are built, tested and verified in the browser.
Phases 2-3 are not started.**
`lib/homes.ts` is now the store the whole app runs on: `/home/$homeId` and
`/home/$homeId/room/$roomId` are the real routes, the dashboard lists Homes,
and `lib/floors.ts` keeps only the floor *helpers* (naming, `createFloor`,
`parseImportedFloors`) — it no longer persists anything. `/rooms` and
`/rooms/$roomId` redirect. What's left is Phase 2 (home-level export/import)
and Phase 3 (a copy pass). See todo.md's Phase 1 entry for what landed.

## The bug, stated precisely

There is exactly **one implicit building**, and the dashboard lists its
*floors* as though each were a separate document.

- `lib/floors.ts` stores `planner-multi-floors` as a flat `Floor[]`. That
  array **is** the building. There is no object representing it.
- `FloorPlansList.tsx` renders one dashboard row per `Floor`.
- `CreateFloorFlow`'s "from scratch" does `saveFloors([...floors, floor])`
  — it appends a **storey to the one building**.

So: create a floor plan, go back to the dashboard, create another — and the
second one becomes "1st Floor" of the first. Exactly what you described.

The tell is in the type system. `LastActiveTarget` has
`{ type: "floor" }` with **no id** (`types/planner.ts:334`), because there is
only ever one thing it could point at. Compare `{ type: "single-room";
roomId }`. That missing id is the whole misunderstanding in one line.

Single rooms already work the way you want: `planner-single-rooms` is a list
of independent documents, each with its own dashboard row and its own route.
Floors never got that treatment.

## The model

```ts
interface Home {
  id: string;
  name: string;
  floors: Floor[];   // 1..N, ordered, index 0 = ground floor
}
```

Storage becomes `planner-homes-v1: Home[]` — a list of independent
documents, exactly parallel to `planner-single-rooms`. `Floor` itself is
**unchanged**; it just stops being a top-level concept.

One dashboard entry per home. Open it, and floors are switched and
added *inside* it, with the existing `FloorSwitcher` — which already does
select / add / rename / delete / reorder and needs no new features, only
scoping to one home's array instead of the global one.

This is the same "two things that look alike are actually separate
documents" split that `docs/LEARNINGS.md` describes for single rooms vs
floor rooms. The lesson there applies verbatim: **nothing should infer which
home it's in — the route knows, so pass it.**

### Naming — decided

**"Home"** (2026-08-03). You raised the idea as "apartment"; we settled on
Home because it covers a flat *and* a house with storeys, where "apartment"
would be wrong for the latter and "Building" reads industrial for a home
planner.

So: "Create a Home" / "Your Homes", `Home`, `lib/homes.ts`,
`planner-homes-v1`, `/home/$homeId`. German: *Zuhause* (singular),
*Deine Zuhause* reads badly — prefer **"Dein Zuhause"** for the card and
**"Deine Wohnungen & Häuser"** or simply **"Deine Zuhause-Pläne"** for the
list; worth a look with real copy on screen rather than deciding here.

## What this deletes

Worth stating, because it's a real simplification and not just churn:

- **The "Replace the ground floor?" confirmation goes away entirely.**
  `CreateFloorFlow`'s example path targets floor index 0 and asks before
  overwriting an occupied ground floor. All of that exists *only* because
  there was one shared building to collide with. "From example" simply
  becomes "make a new home containing the example ground floor" —
  nothing to overwrite, nothing to confirm.
- **`loadActiveFloorId(floors)`'s global pointer** becomes per-home
  state, which removes a class of "which floor am I on?" bugs across
  navigation.

## Storage and migration — the risky part

This codebase has been bitten **twice** by exactly this class of change, both
documented in `LEARNINGS.md`. Both apply directly here:

1. **An empty collection is a legitimate saved state.** `isFloorArray()` once
   required `length > 0`, so a deliberately-emptied building was judged
   invalid, `loadFloors()` fell through to its legacy-migration branch, and
   **re-saved the old rooms on every load** — a deleted floor came back
   forever. The new `isHomeArray()` must accept `[]`.
2. **Testing migration on a cleared browser profile proves nothing**, because
   clearing wipes the very key that triggers the bug. Plant the old keys
   explicitly.

There are now **three** storage generations to handle, and the order matters:

| Key | Shape | Migrates to |
|---|---|---|
| `planner-homes-v1` | `Home[]` | current, used as-is |
| `planner-multi-floors` | `Floor[]` | **one** home wrapping them all |
| `planner-multi-rooms` | `RoomLayout[]` | one floor → one home (legacy of the legacy) |

Read them strictly newest-first, and only fall through when the newer key is
**absent or unparseable** — never when it's merely empty. Migration should
write the new key and leave the old ones alone (don't delete: a rollback
should not lose data).

The migrated home needs a name. I'd reuse nothing and call it
"My Home" / "Meine Wohnung" — see open question 2.

## Every seam that has to change

Grounded in what's actually there — 8 files import `@/lib/floors` today.

| Where | Change |
|---|---|
| `types/planner.ts` | new `Home`; `LastActiveTarget`'s `{type:"floor"}` → `{type:"home"; homeId}` |
| `lib/floors.ts` → `lib/homes.ts` | the store: load/save/create/find/add/update/remove + the 3-generation migration. `createFloor`, `defaultFloorName`, `floorDisplayName` stay as floor helpers |
| `routes/rooms.index.tsx` | becomes the *home* view, keyed by an id from the URL rather than reading the one global array |
| `routes/rooms.$roomId.tsx` | a room inside an home's floor |
| `hooks/use-room-planner.ts` | `getInitialRoomData` and the save-back effect both iterate `floors` — now `homes → floors`. This is the save path; it must not regress |
| `components/dashboard/FloorPlansList.tsx` | → `HomesList`: one row per home, `N floors · N rooms · N items`, delete removes the whole home |
| `components/dashboard/CreateFloorFlow.tsx` | → `CreateHomeFlow`: both paths create a **new** home; the replace-confirm dialog is deleted |
| `components/dashboard/Dashboard.tsx` | card copy: "Create an Home" / "Your Homes" |
| `components/dashboard/RecentlyOpened.tsx` | resume card resolves an home by id instead of `loadActiveFloorId` |
| `components/planner/FloorSwitcher.tsx` | unchanged in behaviour, scoped to one home's floors |
| `lib/settings.ts` | normalize the new `lastActive` variant; old `{type:"floor"}` resolves to the migrated home |
| `lib/planner-schema.ts` | `floorsArrayImportSchema` (`Floor[]`, min 1 max 100) gains an home wrapper; **old floor-array exports must still import**, as a new home |
| `routes/index.tsx` | the quick-entry gate follows the new `lastActive` |

### Routing

Today: `/rooms` (the building) and `/rooms/$roomId` (a room in it).

Proposed:

- `/home/$homeId` — the floor-plan overview for one home
- `/home/$homeId/room/$roomId` — a room inside it

Putting the home id in the room URL is deliberate, even though room ids
are UUIDs and could be found by searching every home. `use-room-planner`
already searches all floors for a room id — extending that to "search all
homes" would work, but it's precisely the "look it up and guess"
pattern `LEARNINGS.md` warns against, and the back-link needs the home
id anyway to know where to return to.

`/rooms` and `/rooms/$roomId` should redirect rather than 404 — `lastActive`
and any bookmark will still point at them. See open question 3.

## Phasing

Phase 1 is inherently atomic: swapping the store touches the dashboard, the
routes and the editor together, and there's no half-state where the app
works. Don't try to split it.

| Phase | Scope | Risk |
|---|---|---|
| **0** | ✅ **DONE** — `lib/homes.ts` + the 3-generation migration + 34 tests. Not wired to anything; zero behaviour change | Low. Same approach as the slopes geometry layer, which worked well here |
| **1** | ✅ **DONE** — wired: routes, dashboard list + create flows, `use-room-planner`, `FloorSwitcher` scoping, `lastActive`. The `/rooms` redirects were pulled forward from Phase 3, since leaving the old route live on the old store would have been a genuinely broken half-state | **Medium-high.** The one that had to land in one piece |
| **2** | Export/import (home-level, accepting old floor-array files) | Low |
| **3** | Copy pass, `/rooms` redirects, delete the dead replace-confirm dialog | Low |

Phase 0 is worth doing on its own even if Phase 1 waits: it's where the
migration risk lives, and it can be proven with tests alone.

### How to verify Phase 0/1 (do not skip)

Per `LEARNINGS.md`, against a **real** profile, not a cleared one:

1. Plant `planner-multi-floors` with 2 floors → expect exactly **one**
   home containing both, and the dashboard showing **one** row.
2. Plant only `planner-multi-rooms` (the pre-floors key) → one home,
   one floor, those rooms.
3. Plant `planner-homes-v1: []` **alongside** a populated
   `planner-multi-floors` → must stay empty. This is the resurrection bug;
   it is the single most important test in the batch.
4. Create two homes from the dashboard → two rows, and adding a floor
   inside one must not appear in the other.
5. Read `localStorage` directly at each step rather than trusting the UI.

## Decided (2026-08-03)

- **"Home"**, not "Apartment" or "Building" — see Naming above.
- **A new Home starts with one empty Ground Floor.** It opens straight into
  a usable floor with the add-room sidebar, and the overview already assumes
  an active floor exists, so it's also the smaller change. Note this does
  *not* contradict the "a route must never create data just by being
  visited" rule from `LEARNINGS.md` — creating on an explicit "create" click
  is exactly where creation belongs.
- **`/rooms` and `/rooms/$roomId` redirect** to the migrated Home rather
  than being removed, so a stored `lastActive` or a bookmark can't land on a
  404 after the migration.
- **The last floor in a Home cannot be deleted from the Home route** (the
  existing `FloorSwitcher` rule, unchanged) — deleting the whole Home is a
  dashboard action.
- **German copy**: "Erstelle ein Zuhause" (create) and "Deine geplanten
  Zuhauses" (the list). Settles the plural question.
- **The user's own localStorage gets cleared once, by hand, at the end of
  Phase 1** — a clean slate on their machine only. No data-deleting code
  ships: the migration writes the new key and leaves the old ones alone. The
  example room and example ground floor stay exactly as they are, reworded
  to the Home vocabulary.

## Still open

1. ~~What is your existing building called after migration?~~ Settled by
   building it: a Home with no name of its own shows a position-based
   default, so the migrated one reads **"My Home"** and a second reads
   **"Home 2"** — the same convention `Floor.name` already uses, which means
   it re-translates on a language switch and re-numbers if one is deleted.
2. ~~Can you delete the last floor inside a Home?~~ **No** — the switcher's
   existing can't-delete-the-last-one rule is unchanged, and deleting the
   whole Home from the dashboard is how you remove everything.
3. **Should a Home be renameable?** Still open, and now the most obvious
   gap: floors rename in the switcher, Homes have no rename surface at all,
   so "Home 2" is stuck being called that. Additive; a good first follow-up.
4. **German copy.** Built as decided ("Erstelle ein Zuhause" / "Deine
   geplanten Zuhauses"), but *Zuhauses* is not a real German plural — worth
   a look now that it's on screen. "Deine Wohnungen & Häuser" is the honest
   alternative.
